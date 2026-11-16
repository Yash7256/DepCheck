import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import * as ts from 'typescript';

import { extractPackageName } from './package-name.js';
import type { ImportKind, ImportReference, ParseDiagnostic, SourceLocation } from './types.js';

function scriptKindForFile(filePath: string): ts.ScriptKind {
  switch (extname(filePath).toLowerCase()) {
    case '.js':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.mjs':
      return ts.ScriptKind.JS;
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.mts':
      return ts.ScriptKind.TS;
    case '.cts':
      return ts.ScriptKind.TS;
    case '.tsx':
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function locationForNode(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    filePath: sourceFile.fileName,
    line: position.line + 1,
    column: position.character + 1,
  };
}

function diagnosticLocation(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
  return locationForNode(sourceFile, node);
}

function diagnostic(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string,
  category: ParseDiagnostic['category'] = 'warning',
): ParseDiagnostic {
  const location = diagnosticLocation(sourceFile, node);
  return { ...location, message, category };
}

function flattenDiagnosticMessage(message: string | ts.DiagnosticMessageChain): string {
  if (typeof message === 'string') return message;
  return (
    message.messageText +
    (message.next ?? []).map((child) => ` ${flattenDiagnosticMessage(child)}`).join('')
  );
}

function parseDiagnosticFromCompilerDiagnostic(
  sourceFile: ts.SourceFile,
  compilerDiagnostic: ts.Diagnostic,
): ParseDiagnostic {
  const position = compilerDiagnostic.start ?? 0;
  const lineAndCharacter = sourceFile.getLineAndCharacterOfPosition(position);
  return {
    filePath: sourceFile.fileName,
    message: flattenDiagnosticMessage(compilerDiagnostic.messageText),
    category: compilerDiagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
    line: lineAndCharacter.line + 1,
    column: lineAndCharacter.character + 1,
  };
}

function staticModuleSpecifier(expression: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return undefined;
}

function addReference(
  references: ImportReference[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  moduleSpecifier: string,
  referenceType: ImportReference['referenceType'],
  importKind: ImportKind,
  isTypeOnly: boolean,
): void {
  references.push({
    filePath: sourceFile.fileName,
    moduleSpecifier,
    packageName: extractPackageName(moduleSpecifier),
    referenceType,
    importKind,
    isTypeOnly,
    location: locationForNode(sourceFile, node),
  });
}

function addNamedImportReferences(
  references: ImportReference[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  moduleSpecifier: string,
  elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[],
  referenceType: 'import' | 're-export',
  allTypeOnly = false,
): void {
  const valueElements = allTypeOnly ? [] : elements.filter((element) => !element.isTypeOnly);
  const typeElements = allTypeOnly ? elements : elements.filter((element) => element.isTypeOnly);
  if (valueElements.length > 0) {
    addReference(references, sourceFile, node, moduleSpecifier, referenceType, 'named', false);
  }
  if (typeElements.length > 0) {
    addReference(references, sourceFile, node, moduleSpecifier, referenceType, 'named', true);
  }
}

function parseImportDeclaration(
  sourceFile: ts.SourceFile,
  node: ts.ImportDeclaration,
  references: ImportReference[],
): void {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return;
  const moduleSpecifier = node.moduleSpecifier.text;
  const importClause = node.importClause;

  if (importClause === undefined) {
    addReference(
      references,
      sourceFile,
      node.moduleSpecifier,
      moduleSpecifier,
      'import',
      'side-effect',
      false,
    );
    return;
  }

  const isTypeOnly = importClause.isTypeOnly;
  if (importClause.name !== undefined) {
    addReference(
      references,
      sourceFile,
      node.moduleSpecifier,
      moduleSpecifier,
      'import',
      'default',
      isTypeOnly,
    );
  }

  if (importClause.namedBindings === undefined) {
    if (importClause.name === undefined) {
      addReference(
        references,
        sourceFile,
        node.moduleSpecifier,
        moduleSpecifier,
        'import',
        'default',
        isTypeOnly,
      );
    }
    return;
  }

  if (ts.isNamespaceImport(importClause.namedBindings)) {
    addReference(
      references,
      sourceFile,
      node.moduleSpecifier,
      moduleSpecifier,
      'import',
      'namespace',
      isTypeOnly,
    );
    return;
  }

  addNamedImportReferences(
    references,
    sourceFile,
    node.moduleSpecifier,
    moduleSpecifier,
    importClause.namedBindings.elements,
    'import',
    isTypeOnly,
  );
}

function parseExportDeclaration(
  sourceFile: ts.SourceFile,
  node: ts.ExportDeclaration,
  references: ImportReference[],
): void {
  if (node.moduleSpecifier === undefined || !ts.isStringLiteral(node.moduleSpecifier)) return;
  const moduleSpecifier = node.moduleSpecifier.text;

  if (node.exportClause === undefined || ts.isNamespaceExport(node.exportClause)) {
    addReference(
      references,
      sourceFile,
      node.moduleSpecifier,
      moduleSpecifier,
      're-export',
      'wildcard',
      node.isTypeOnly,
    );
    return;
  }

  addNamedImportReferences(
    references,
    sourceFile,
    node.moduleSpecifier,
    moduleSpecifier,
    node.exportClause.elements,
    're-export',
    node.isTypeOnly,
  );
}

function isDestructuredRequire(node: ts.CallExpression): boolean {
  const declaration = node.parent;
  return ts.isVariableDeclaration(declaration) && ts.isObjectBindingPattern(declaration.name);
}

function parseCallExpression(
  sourceFile: ts.SourceFile,
  node: ts.CallExpression,
  references: ImportReference[],
  diagnostics: ParseDiagnostic[],
): void {
  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  if (!isDynamicImport && !isRequire) return;

  const argument = node.arguments[0];
  const moduleSpecifier = argument === undefined ? undefined : staticModuleSpecifier(argument);
  if (argument !== undefined && moduleSpecifier !== undefined) {
    addReference(
      references,
      sourceFile,
      argument,
      moduleSpecifier,
      isDynamicImport ? 'dynamic-import' : 'commonjs',
      isDynamicImport ? 'dynamic' : isDestructuredRequire(node) ? 'destructured' : 'commonjs',
      false,
    );
    return;
  }

  diagnostics.push(
    diagnostic(
      sourceFile,
      node,
      `${isDynamicImport ? 'Dynamic import' : 'require call'} has a non-static module expression.`,
    ),
  );
}

function parseImportEqualsDeclaration(
  sourceFile: ts.SourceFile,
  node: ts.ImportEqualsDeclaration,
  references: ImportReference[],
): void {
  if (!ts.isExternalModuleReference(node.moduleReference)) return;
  const expression = node.moduleReference.expression;
  if (expression === undefined) return;
  const moduleSpecifier = staticModuleSpecifier(expression);
  if (moduleSpecifier === undefined) return;
  addReference(references, sourceFile, expression, moduleSpecifier, 'commonjs', 'commonjs', false);
}

export async function parseSourceFile(
  filePath: string,
  transpileModule: typeof ts.transpileModule = ts.transpileModule,
): Promise<{
  references: ImportReference[];
  diagnostics: ParseDiagnostic[];
}> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    return {
      references: [],
      diagnostics: [
        {
          filePath,
          message: `Unable to read source file: ${String(error)}`,
          category: 'error',
          line: 1,
          column: 1,
        },
      ],
    };
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(filePath),
  );
  const references: ImportReference[] = [];
  let diagnostics: ParseDiagnostic[] = [];
  try {
    const transpiled = transpileModule(content, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest },
      fileName: filePath,
      reportDiagnostics: true,
    });
    diagnostics = (transpiled.diagnostics ?? []).map((item) =>
      parseDiagnosticFromCompilerDiagnostic(sourceFile, item),
    );
  } catch (error) {
    diagnostics.push({
      filePath,
      message: `TypeScript parser failed: ${error instanceof Error ? error.message : String(error)}`,
      category: 'error',
      line: 1,
      column: 1,
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) parseImportDeclaration(sourceFile, node, references);
    if (ts.isExportDeclaration(node)) parseExportDeclaration(sourceFile, node, references);
    if (ts.isCallExpression(node)) parseCallExpression(sourceFile, node, references, diagnostics);
    if (ts.isImportEqualsDeclaration(node)) {
      parseImportEqualsDeclaration(sourceFile, node, references);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { references, diagnostics };
}

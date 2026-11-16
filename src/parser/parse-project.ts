import type { AnalyzerProgress } from '../progress/types.js';
import { parseSourceFile } from './parse-source.js';
import type {
  ImportReference,
  ParseDiagnostic,
  ParseProjectResult,
  ParserSummary,
} from './types.js';

function summarize(filesParsed: number, references: ImportReference[]): ParserSummary {
  return {
    filesParsed,
    totalReferences: references.length,
    staticImports: references.filter((reference) => reference.referenceType === 'import').length,
    dynamicImports: references.filter((reference) => reference.referenceType === 'dynamic-import')
      .length,
    commonjsImports: references.filter((reference) => reference.referenceType === 'commonjs')
      .length,
    reExports: references.filter((reference) => reference.referenceType === 're-export').length,
    typeOnlyImports: references.filter((reference) => reference.isTypeOnly).length,
  };
}

export async function parseProjectSourceFiles(
  filePaths: string[],
  onProgress?: AnalyzerProgress,
): Promise<ParseProjectResult> {
  let completed = 0;
  onProgress?.(0, filePaths.length);
  const parsedFiles = await Promise.all(
    filePaths.map(async (filePath) => {
      const result = await parseSourceFile(filePath);
      completed += 1;
      onProgress?.(completed, filePaths.length);
      return result;
    }),
  );
  const references = parsedFiles.flatMap((result) => result.references);
  const diagnostics: ParseDiagnostic[] = parsedFiles.flatMap((result) => result.diagnostics);

  return {
    references,
    diagnostics,
    summary: summarize(filePaths.length, references),
  };
}

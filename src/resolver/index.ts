import { builtinModules } from 'node:module';
import { dirname, isAbsolute, relative } from 'node:path';

import type { ImportReference } from '../parser/types.js';
import type { ProjectScanResult, WorkspaceInfo, PackageManifest } from '../scanner/types.js';
import { readManifest } from '../scanner/manifest.js';
import { readTsconfigAliases } from './tsconfig.js';
import type {
  DeclaredDependency,
  DependencyAlias,
  DependencyIndex,
  DependencyResolutionResult,
  DependencyType,
  ReferenceClassification,
  ResolvedReference,
  ResolutionSummary,
} from './types.js';

const BUILTIN_MODULES = new Set(builtinModules);
const DEPENDENCY_TYPES: readonly DependencyType[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function isBuiltinModule(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith('node:') || BUILTIN_MODULES.has(moduleSpecifier);
}

function isLocalModule(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith('.') || isAbsolute(moduleSpecifier);
}

function parseAlias(version: string): DependencyAlias | undefined {
  if (!version.startsWith('npm:')) return undefined;
  const specifier = version.slice('npm:'.length);
  const atIndex = specifier.startsWith('@') ? specifier.indexOf('@', 1) : specifier.indexOf('@');
  const target = atIndex === -1 ? specifier : specifier.slice(0, atIndex);
  return target.length === 0 ? undefined : { target, specifier };
}

function createDependencyIndex(
  manifest: PackageManifest,
  workspace: WorkspaceInfo | null,
): DependencyIndex {
  const dependencies = new Map<string, DeclaredDependency>();

  for (const type of DEPENDENCY_TYPES) {
    for (const [name, version] of Object.entries(manifest[type])) {
      if (dependencies.has(name)) continue;
      const alias = parseAlias(version);
      dependencies.set(name, {
        name,
        version,
        type,
        manifestPath: manifest.path,
        workspacePath: workspace?.path ?? null,
        ...(alias === undefined ? {} : { alias }),
      });
    }
  }

  return { manifest, workspace, dependencies };
}

function workspaceDirectory(workspace: WorkspaceInfo): string {
  return dirname(workspace.path);
}

function findOwningWorkspace(
  filePath: string,
  workspaces: readonly WorkspaceInfo[],
): WorkspaceInfo | null {
  const matching = workspaces.filter((workspace) => {
    const directory = workspaceDirectory(workspace);
    const pathFromWorkspace = relative(directory, filePath);
    return (
      pathFromWorkspace === '' ||
      (!pathFromWorkspace.startsWith('..') && !isAbsolute(pathFromWorkspace))
    );
  });
  return (
    matching.sort(
      (left, right) => workspaceDirectory(right).length - workspaceDirectory(left).length,
    )[0] ?? null
  );
}

function workspaceMatchesPackage(
  packageName: string,
  workspaces: readonly WorkspaceInfo[],
): boolean {
  return workspaces.some((workspace) => workspace.name === packageName);
}

function matchesAlias(alias: string, aliases: ReadonlySet<string>): boolean {
  for (const pattern of aliases) {
    const starIndex = pattern.indexOf('*');
    if (starIndex === -1 && pattern === alias) return true;
    if (starIndex !== -1) {
      const prefix = pattern.slice(0, starIndex);
      const suffix = pattern.slice(starIndex + 1);
      if (
        alias.startsWith(prefix) &&
        alias.endsWith(suffix) &&
        alias.length >= prefix.length + suffix.length
      ) {
        return true;
      }
    }
  }
  return false;
}

function classifyReference(
  reference: ImportReference,
  index: DependencyIndex,
  workspaceNames: readonly WorkspaceInfo[],
  aliases: ReadonlySet<string>,
): { classification: ReferenceClassification; dependency: DeclaredDependency | null } {
  if (isBuiltinModule(reference.moduleSpecifier)) {
    return { classification: 'builtin', dependency: null };
  }
  if (isLocalModule(reference.moduleSpecifier)) {
    return { classification: 'local', dependency: null };
  }
  if (reference.packageName === null) {
    return { classification: 'unknown', dependency: null };
  }

  const dependency = index.dependencies.get(reference.packageName);
  if (dependency !== undefined) {
    return {
      classification: dependency.alias === undefined ? 'declared' : 'alias',
      dependency,
    };
  }
  if (matchesAlias(reference.moduleSpecifier, aliases)) {
    return { classification: 'local', dependency: null };
  }
  if (workspaceMatchesPackage(reference.packageName, workspaceNames)) {
    return { classification: 'workspace', dependency: null };
  }
  return { classification: 'undeclared', dependency: null };
}

function summaryFor(references: ResolvedReference[]): ResolutionSummary {
  const count = (classification: ReferenceClassification): number =>
    references.filter((reference) => reference.classification === classification).length;
  return {
    totalReferences: references.length,
    declaredReferences: count('declared'),
    aliasReferences: count('alias'),
    builtinReferences: count('builtin'),
    localReferences: count('local'),
    workspaceReferences: count('workspace'),
    undeclaredReferences: count('undeclared'),
    unknownReferences: count('unknown'),
  };
}

export async function buildDependencyIndexes(scan: ProjectScanResult): Promise<DependencyIndex[]> {
  const indexes: DependencyIndex[] = [createDependencyIndex(scan.rootManifest, null)];
  for (const workspace of scan.workspaces) {
    indexes.push(createDependencyIndex(await readManifest(workspace.path), workspace));
  }
  return indexes;
}

export async function resolveDependencies(
  scan: ProjectScanResult,
  references: ImportReference[],
): Promise<DependencyResolutionResult> {
  const indexes = await buildDependencyIndexes(scan);
  const rootIndex = indexes[0];
  if (rootIndex === undefined) return { references: [], summary: summaryFor([]) };
  const workspaceIndexes = new Map(
    indexes
      .filter((index) => index.workspace !== null)
      .map((index) => [index.workspace?.path, index]),
  );
  const aliases = await readTsconfigAliases(scan.rootDirectory);
  const resolved = references.map((reference): ResolvedReference => {
    const workspace = findOwningWorkspace(reference.filePath, scan.workspaces);
    const index =
      workspace === null
        ? rootIndex
        : (workspaceIndexes.get(workspace.path) ?? {
            manifest: scan.rootManifest,
            workspace,
            dependencies: new Map(),
          });
    const classification = classifyReference(reference, index, scan.workspaces, aliases);
    return {
      moduleSpecifier: reference.moduleSpecifier,
      packageName: reference.packageName,
      classification: classification.classification,
      dependency: classification.dependency,
      filePath: reference.filePath,
      line: reference.location.line,
      column: reference.location.column,
      workspace,
      referenceType: reference.referenceType,
      importKind: reference.importKind,
      isTypeOnly: reference.isTypeOnly,
    };
  });

  return { references: resolved, summary: summaryFor(resolved) };
}

export { createDependencyIndex, findOwningWorkspace, isBuiltinModule, parseAlias };

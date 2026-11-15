import type { ImportReference } from '../parser/types.js';
import type { PackageManifest, WorkspaceInfo } from '../scanner/types.js';

export type DependencyType =
  'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

export interface DependencyAlias {
  target: string;
  specifier: string;
}

export interface DeclaredDependency {
  name: string;
  version: string;
  type: DependencyType;
  manifestPath: string;
  workspacePath: string | null;
  alias?: DependencyAlias;
}

export type ReferenceClassification =
  'declared' | 'alias' | 'builtin' | 'local' | 'workspace' | 'undeclared' | 'unknown';

export interface ResolvedReference {
  moduleSpecifier: string;
  packageName: string | null;
  classification: ReferenceClassification;
  dependency: DeclaredDependency | null;
  filePath: string;
  manifestPath: string;
  line: number;
  column: number;
  workspace: WorkspaceInfo | null;
  referenceType: ImportReference['referenceType'];
  importKind: ImportReference['importKind'];
  isTypeOnly: boolean;
}

export interface ResolutionSummary {
  totalReferences: number;
  declaredReferences: number;
  aliasReferences: number;
  builtinReferences: number;
  localReferences: number;
  workspaceReferences: number;
  undeclaredReferences: number;
  unknownReferences: number;
}

export interface DependencyResolutionResult {
  references: ResolvedReference[];
  summary: ResolutionSummary;
}

export interface DependencyIndex {
  manifest: PackageManifest;
  workspace: WorkspaceInfo | null;
  dependencies: ReadonlyMap<string, DeclaredDependency>;
}

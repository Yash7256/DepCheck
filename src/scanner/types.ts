export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export interface DependencyDeclarations {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
}

export interface WorkspaceConfiguration {
  packages: string[];
}

export interface PackageManifest extends DependencyDeclarations {
  path: string;
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  workspaces?: WorkspaceConfiguration;
  packageManager?: string;
}

export interface WorkspaceInfo {
  path: string;
  name?: string;
}

export interface LockfileInfo {
  name: 'package-lock.json' | 'pnpm-lock.yaml' | 'yarn.lock' | 'bun.lock' | 'bun.lockb';
  path: string;
  packageManager: Exclude<PackageManager, 'unknown'>;
}

export interface PackageManagerEvidence {
  declared?: PackageManager;
  lockfiles: PackageManager[];
  conflicts: PackageManager[];
}

export interface ScannerSummary {
  sourceFileCount: number;
  workspaceCount: number;
  lockfileCount: number;
  dependencyDeclarationCount: number;
}

export interface ProjectScanResult {
  rootDirectory: string;
  rootManifest: PackageManifest;
  sourceFiles: string[];
  lockfiles: LockfileInfo[];
  packageManager: PackageManager;
  packageManagerEvidence: PackageManagerEvidence;
  workspaces: WorkspaceInfo[];
  summary: ScannerSummary;
}

import { discoverLockfiles, detectPackageManager } from './lockfiles.js';
import { discoverProject } from './project.js';
import { discoverSourceFiles, type SourceDiscoveryOptions } from './sources.js';
import type { ProjectScanResult } from './types.js';
import { discoverWorkspaces } from './workspaces.js';

export type ScanProjectOptions = SourceDiscoveryOptions;

export async function scanProject(
  projectDirectory: string,
  options: ScanProjectOptions = {},
): Promise<ProjectScanResult> {
  const project = await discoverProject(projectDirectory);
  const [sourceFiles, lockfiles, workspaces] = await Promise.all([
    discoverSourceFiles(project.rootDirectory, options),
    discoverLockfiles(project.rootDirectory),
    discoverWorkspaces(project.rootDirectory, project.rootManifest),
  ]);
  const { packageManager, evidence } = detectPackageManager(project.rootManifest, lockfiles);
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } =
    project.rootManifest;

  return {
    rootDirectory: project.rootDirectory,
    rootManifest: project.rootManifest,
    sourceFiles,
    lockfiles,
    packageManager,
    packageManagerEvidence: evidence,
    workspaces,
    summary: {
      sourceFileCount: sourceFiles.length,
      workspaceCount: workspaces.length,
      lockfileCount: lockfiles.length,
      dependencyDeclarationCount:
        Object.keys(dependencies).length +
        Object.keys(devDependencies).length +
        Object.keys(peerDependencies).length +
        Object.keys(optionalDependencies).length,
    },
  };
}

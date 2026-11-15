import { readManifest } from '../scanner/manifest.js';
import type { PackageManifest, ProjectScanResult, WorkspaceInfo } from '../scanner/types.js';
import type { DependencyResolutionResult, DeclaredDependency } from '../resolver/types.js';
import type { Finding } from './types.js';

const DEPENDENCY_TYPES = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

type DependencyType = (typeof DEPENDENCY_TYPES)[number];

interface ManifestOwner {
  manifest: PackageManifest;
  workspace: WorkspaceInfo | null;
}

function scriptMentionsPackage(script: string, packageName: string): boolean {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^@\\w/-])${escaped}(?=$|[^\\w/-])`).test(script);
}

function dependencyUsed(
  dependency: DeclaredDependency,
  resolution: DependencyResolutionResult,
  scripts: Record<string, string>,
): { used: boolean; evidence: string[] } {
  const references = resolution.references.filter(
    (reference) =>
      reference.dependency?.name === dependency.name &&
      reference.dependency.manifestPath === dependency.manifestPath,
  );
  const scriptEvidence = Object.entries(scripts)
    .filter(([, script]) => scriptMentionsPackage(script, dependency.name))
    .map(([name]) => `script:${name}`);

  return {
    used: references.length > 0 || scriptEvidence.length > 0,
    evidence: [
      ...references.map(
        (reference) => `${reference.filePath}:${reference.line}:${reference.column}`,
      ),
      ...scriptEvidence,
    ],
  };
}

function declaredDependencies(
  manifest: PackageManifest,
  workspace: WorkspaceInfo | null,
): DeclaredDependency[] {
  return DEPENDENCY_TYPES.flatMap((type: DependencyType) =>
    Object.entries(manifest[type]).map(([name, version]) => ({
      name,
      version,
      type,
      manifestPath: manifest.path,
      workspacePath: workspace?.path ?? null,
    })),
  );
}

async function loadManifestOwners(scan: ProjectScanResult): Promise<ManifestOwner[]> {
  const owners: ManifestOwner[] = [{ manifest: scan.rootManifest, workspace: null }];
  for (const workspace of scan.workspaces) {
    owners.push({ manifest: await readManifest(workspace.path), workspace });
  }
  return owners;
}

export async function analyzeUnusedDependencies(
  scan: ProjectScanResult,
  resolution: DependencyResolutionResult,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const owners = await loadManifestOwners(scan);

  for (const owner of owners) {
    for (const dependency of declaredDependencies(owner.manifest, owner.workspace)) {
      const usage = dependencyUsed(dependency, resolution, owner.manifest.scripts ?? {});
      if (usage.used) continue;
      findings.push({
        id: `${'UNUSED_DEPENDENCY'}:${dependency.manifestPath}:${dependency.name}`,
        code: 'UNUSED_DEPENDENCY',
        analyzer: 'unused',
        packageName: dependency.name,
        severity: 'warning',
        confidence: 'low',
        message: `${dependency.name} is declared in ${dependency.type} but no recognizable usage was found.`,
        manifestPath: dependency.manifestPath,
        details: {
          dependencyType: dependency.type,
          declaredVersion: dependency.version,
          workspace: owner.workspace?.name ?? null,
          note: 'Absence of recognizable usage is not proof that the dependency is unused.',
        },
      });
    }
  }

  return findings;
}

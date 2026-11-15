import semver from 'semver';

import { readManifest } from '../scanner/manifest.js';
import type { PackageManifest, ProjectScanResult, WorkspaceInfo } from '../scanner/types.js';
import type { AnalyzerDiagnostic, Finding } from './types.js';

export interface PackageMetadata {
  name: string;
  versions: Record<string, { version?: string }>;
  'dist-tags'?: Record<string, string>;
}

export interface PackageRegistryProvider {
  getPackageMetadata(packageName: string): Promise<PackageMetadata>;
}

export class NpmRegistryProvider implements PackageRegistryProvider {
  private readonly cache = new Map<string, Promise<PackageMetadata>>();

  constructor(private readonly timeoutMs = 10_000) {}

  getPackageMetadata(packageName: string): Promise<PackageMetadata> {
    const cached = this.cache.get(packageName);
    if (cached !== undefined) return cached;
    const controller = new AbortController();
    const request = (async () => {
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(
          `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
          {
            headers: { accept: 'application/json' },
            signal: controller.signal,
          },
        );
        if (response.status === 429) throw new Error('npm registry rate limit exceeded');
        if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
        const value: unknown = await response.json();
        if (typeof value !== 'object' || value === null || Array.isArray(value))
          throw new Error('invalid npm registry response');
        const versions = Reflect.get(value, 'versions');
        if (typeof versions !== 'object' || versions === null || Array.isArray(versions))
          throw new Error('registry response has no versions');
        return value as PackageMetadata;
      } finally {
        clearTimeout(timer);
      }
    })();
    this.cache.set(packageName, request);
    return request;
  }
}

type DependencyType =
  'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

async function manifests(
  scan: ProjectScanResult,
): Promise<Array<{ manifest: PackageManifest; workspace: WorkspaceInfo | null }>> {
  const result = [{ manifest: scan.rootManifest, workspace: null as WorkspaceInfo | null }];
  for (const workspace of scan.workspaces)
    result.push({ manifest: await readManifest(workspace.path), workspace });
  return result;
}

function updateType(
  declared: string,
  latest: string,
): NonNullable<Finding['details']>['updateType'] {
  const from = semver.minVersion(declared);
  const to = semver.parse(latest);
  if (from === null || to === null) return 'unknown';
  if (to.major !== from.major) return 'major';
  if (to.minor !== from.minor) return 'minor';
  if (to.patch !== from.patch) return 'patch';
  return 'up-to-date';
}

export async function analyzeOutdatedDependencies(
  scan: ProjectScanResult,
  provider: PackageRegistryProvider = new NpmRegistryProvider(),
  installedVersions: ReadonlyMap<string, string> = new Map(),
): Promise<{ findings: Finding[]; diagnostics: AnalyzerDiagnostic[] }> {
  const declarations = (await manifests(scan)).flatMap(({ manifest, workspace }) =>
    (
      ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
    ).flatMap((type: DependencyType) =>
      Object.entries(manifest[type]).map(([name, range]) => ({
        name,
        range,
        type,
        manifestPath: manifest.path,
        workspace,
      })),
    ),
  );
  const unique = [...new Map(declarations.map((item) => [item.name, item])).values()];
  const findings: Finding[] = [];
  const diagnostics: AnalyzerDiagnostic[] = [];
  for (let offset = 0; offset < unique.length; offset += 6) {
    await Promise.all(
      unique.slice(offset, offset + 6).map(async (item) => {
        if (
          item.range.startsWith('npm:') ||
          item.range.startsWith('workspace:') ||
          item.range.startsWith('file:') ||
          item.range.startsWith('.') ||
          item.range.includes('://') ||
          !semver.validRange(item.range)
        ) {
          if (
            !item.range.startsWith('npm:') &&
            !item.range.startsWith('workspace:') &&
            !item.range.startsWith('file:') &&
            !item.range.startsWith('.') &&
            !item.range.includes('://')
          )
            diagnostics.push({
              code: 'OUTDATED_INVALID_RANGE',
              message: `Invalid or unsupported version range for ${item.name}: ${item.range}`,
              severity: 'warning',
            });
          return;
        }
        try {
          const metadata = await provider.getPackageMetadata(item.name);
          const versions = Object.keys(metadata.versions).filter(
            (version) => semver.valid(version) !== null,
          );
          const wanted = semver.maxSatisfying(versions, item.range);
          const latest = metadata['dist-tags']?.latest;
          if (wanted === null || latest === undefined || semver.valid(latest) === null) return;
          const kind = updateType(item.range, latest);
          if (kind === 'up-to-date') return;
          findings.push({
            id: `OUTDATED_DEPENDENCY:${item.manifestPath}:${item.name}`,
            code: 'OUTDATED_DEPENDENCY',
            analyzer: 'outdated',
            packageName: item.name,
            severity: 'info',
            confidence: 'high',
            message: `${item.name} has a newer available version.`,
            manifestPath: item.manifestPath,
            details: {
              declaredVersion: item.range,
              installedVersion: installedVersions.get(item.name),
              wantedVersion: wanted,
              latestVersion: latest,
              updateType: kind,
              dependencyType: item.type,
              workspace: item.workspace?.name ?? null,
            },
          });
        } catch (error) {
          diagnostics.push({
            code: 'OUTDATED_REGISTRY_ERROR',
            message: `Unable to retrieve metadata for ${item.name}: ${String(error)}`,
            severity: 'warning',
            details: { packageName: item.name },
          });
        }
      }),
    );
  }
  return { findings, diagnostics };
}

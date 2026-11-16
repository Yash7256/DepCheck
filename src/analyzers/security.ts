import { join } from 'node:path';

import type { AnalyzerProgress } from '../progress/types.js';
import type { DependencyTreeNode, DependencyTreeProvider } from './duplicates.js';
import type { AnalyzerDiagnostic, Finding, FindingSeverity } from './types.js';

export interface Vulnerability {
  id: string;
  summary?: string;
  severity?: string;
  affectedRange?: string;
  fixedVersions?: string[];
  references?: string[];
}

export interface VulnerabilityProvider {
  queryPackage(packageName: string, version: string, ecosystem: string): Promise<Vulnerability[]>;
}

export class OsvVulnerabilityProvider implements VulnerabilityProvider {
  private readonly cache = new Map<string, Promise<Vulnerability[]>>();
  constructor(private readonly timeoutMs = 10_000) {}

  queryPackage(packageName: string, version: string, ecosystem: string): Promise<Vulnerability[]> {
    const key = `${ecosystem}:${packageName}@${version}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const controller = new AbortController();
    const request = (async () => {
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch('https://api.osv.dev/v1/query', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ package: { name: packageName, ecosystem }, version }),
          signal: controller.signal,
        });
        if (response.status === 429) throw new Error('OSV rate limit exceeded');
        if (!response.ok) throw new Error(`OSV returned HTTP ${response.status}`);
        const value: unknown = await response.json();
        const vulnerabilities =
          typeof value === 'object' && value !== null ? Reflect.get(value, 'vulns') : undefined;
        if (vulnerabilities === undefined) return [];
        if (!Array.isArray(vulnerabilities))
          throw new Error('OSV returned invalid vulnerabilities');
        return vulnerabilities.map((item): Vulnerability => {
          if (typeof item !== 'object' || item === null)
            throw new Error('OSV returned invalid vulnerability');
          const rawReferences: unknown = Reflect.get(item, 'references');
          const references = Array.isArray(rawReferences)
            ? rawReferences
                .map((reference: unknown) =>
                  typeof reference === 'object' && reference !== null
                    ? String(Reflect.get(reference, 'url') ?? '')
                    : '',
                )
                .filter(Boolean)
            : undefined;
          const summary = Reflect.get(item, 'summary');
          return {
            id: String(Reflect.get(item, 'id') ?? 'unknown'),
            ...(typeof summary === 'string' ? { summary } : {}),
            ...(references === undefined ? {} : { references }),
          };
        });
      } finally {
        clearTimeout(timer);
      }
    })();
    this.cache.set(key, request);
    return request;
  }
}

function severity(value: string | undefined): FindingSeverity {
  const normalized = value?.toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return 'error';
  if (normalized === 'moderate' || normalized === 'medium' || normalized === 'low')
    return 'warning';
  return 'info';
}

interface TreePackage {
  name: string;
  version: string;
  paths: string[][];
}

function packagesFromTree(
  node: DependencyTreeNode,
  path: string[],
  result: Map<string, TreePackage>,
): void {
  for (const [name, child] of Object.entries(node.dependencies ?? {})) {
    if (child.version === undefined) continue;
    const next = [...path, `${name}@${child.version}`];
    const key = `${name}@${child.version}`;
    const existing = result.get(key) ?? { name, version: child.version, paths: [] };
    existing.paths.push(next);
    result.set(key, existing);
    packagesFromTree(child, next, result);
  }
}

export async function analyzeSecurity(
  treeProvider: DependencyTreeProvider,
  projectRoot: string,
  packageManager: string,
  provider: VulnerabilityProvider = new OsvVulnerabilityProvider(),
  onProgress?: AnalyzerProgress,
): Promise<{ findings: Finding[]; diagnostics: AnalyzerDiagnostic[] }> {
  if (packageManager !== 'npm')
    return {
      findings: [],
      diagnostics: [
        {
          code: 'SECURITY_ANALYSIS_UNSUPPORTED_PACKAGE_MANAGER',
          message: `Security analysis currently supports npm dependency trees only; detected ${packageManager}.`,
          severity: 'error',
        },
      ],
    };
  const treeResult = await treeProvider.getDependencyTree(projectRoot);
  if (treeResult.tree === null)
    return {
      findings: [],
      diagnostics: [
        ...treeResult.diagnostics,
        {
          code: 'SECURITY_ANALYSIS_INCOMPLETE',
          message: 'Security analysis could not obtain a dependency tree.',
          severity: 'error',
        },
      ],
    };
  const packages = new Map<string, TreePackage>();
  packagesFromTree(treeResult.tree, ['project'], packages);
  const total = packages.size;
  let completed = 0;
  onProgress?.(0, total);
  const findings: Finding[] = [];
  const diagnostics: AnalyzerDiagnostic[] = [...treeResult.diagnostics];
  for (const item of packages.values()) {
    try {
      const vulnerabilities = await provider.queryPackage(item.name, item.version, 'npm');
      const unique = new Map<string, Vulnerability>();
      for (const vulnerability of vulnerabilities)
        if (!unique.has(vulnerability.id)) unique.set(vulnerability.id, vulnerability);
      for (const vulnerability of unique.values())
        findings.push({
          id: `SECURITY_VULNERABILITY:${item.name}:${item.version}:${vulnerability.id}`,
          code: 'SECURITY_VULNERABILITY',
          analyzer: 'security',
          packageName: item.name,
          severity: severity(vulnerability.severity),
          confidence: 'high',
          message:
            vulnerability.summary ??
            `${item.name}@${item.version} has vulnerability ${vulnerability.id}.`,
          manifestPath: join(projectRoot, 'package.json'),
          details: {
            installedVersion: item.version,
            vulnerabilityId: vulnerability.id,
            severity: vulnerability.severity ?? 'unknown',
            fixedVersions: vulnerability.fixedVersions ?? [],
            dependencyPaths: item.paths,
            references: vulnerability.references ?? [],
          },
        });
    } catch (error) {
      diagnostics.push({
        code: 'SECURITY_PROVIDER_ERROR',
        message: `Unable to query OSV for ${item.name}@${item.version}: ${String(error)}`,
        severity: 'error',
      });
    } finally {
      completed += 1;
      onProgress?.(completed, total);
    }
  }
  return { findings, diagnostics };
}

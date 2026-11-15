import {
  analyzeDuplicateDependencyVersions,
  NpmDependencyTreeProvider,
  type DependencyTreeProvider,
} from '../analyzers/duplicates.js';
import { analyzeMissingDependencies } from '../analyzers/missing.js';
import { analyzeUnusedDependencies } from '../analyzers/unused.js';
import type { AnalyzerDiagnostic, AuditResult, Finding } from '../analyzers/types.js';
import type { ParseProjectResult } from '../parser/types.js';
import type { DependencyResolutionResult } from '../resolver/types.js';
import type { ProjectScanResult } from '../scanner/types.js';
import { analyzeOutdatedDependencies } from '../analyzers/outdated.js';
import { analyzeSecurity } from '../analyzers/security.js';
import { analyzeDependencyTree } from '../analyzers/tree.js';

function parserDiagnostics(parse: ParseProjectResult): AnalyzerDiagnostic[] {
  return parse.diagnostics.map((diagnostic) => ({
    code: 'SOURCE_PARSE_DIAGNOSTIC',
    message: diagnostic.message,
    severity: diagnostic.category,
    filePath: diagnostic.filePath,
    details: { line: diagnostic.line, column: diagnostic.column },
  }));
}

function auditSummary(findings: Finding[]): AuditResult['summary'] {
  return {
    unused: findings.filter((finding) => finding.code === 'UNUSED_DEPENDENCY').length,
    missing: findings.filter((finding) => finding.code === 'MISSING_DEPENDENCY').length,
    duplicates: findings.filter((finding) => finding.code === 'DUPLICATE_DEPENDENCY_VERSION')
      .length,
    total: findings.length,
  };
}

export async function auditProject(
  scan: ProjectScanResult,
  parse: ParseProjectResult,
  resolution: DependencyResolutionResult,
  dependencyTreeProvider?: DependencyTreeProvider,
  options: { skipSecurity?: boolean; offlineSecurity?: boolean } = {},
): Promise<AuditResult> {
  const treeProvider = dependencyTreeProvider ?? new NpmDependencyTreeProvider();
  const unused = await analyzeUnusedDependencies(scan, resolution);
  const missing = analyzeMissingDependencies(resolution);
  const duplicates = await analyzeDuplicateDependencyVersions(
    scan.rootDirectory,
    scan.packageManager,
    treeProvider,
  );
  const outdated = await analyzeOutdatedDependencies(scan);
  const security = options.skipSecurity
    ? { findings: [], diagnostics: [] }
    : options.offlineSecurity
      ? {
          findings: [],
          diagnostics: [
            {
              code: 'SECURITY_OFFLINE_UNAVAILABLE',
              message:
                'Offline security analysis requires a local vulnerability cache, which is not configured.',
              severity: 'error' as const,
            },
          ],
        }
      : await analyzeSecurity(treeProvider, scan.rootDirectory, scan.packageManager);
  const tree = await analyzeDependencyTree(scan.rootDirectory, scan.packageManager, treeProvider);
  const findings = [
    ...unused,
    ...missing,
    ...duplicates.findings,
    ...outdated.findings,
    ...security.findings,
  ];
  const diagnostics = [
    ...parserDiagnostics(parse),
    ...duplicates.diagnostics,
    ...outdated.diagnostics,
    ...security.diagnostics,
    ...tree.diagnostics,
  ];

  return {
    projectRoot: scan.rootDirectory,
    ...(scan.rootManifest.name === undefined ? {} : { projectName: scan.rootManifest.name }),
    filesParsed: parse.summary.filesParsed,
    findings,
    diagnostics,
    summary: {
      ...auditSummary(findings),
      outdated: outdated.findings.length,
      security: security.findings.length,
      tree: {
        totalResolvedInstances: tree.statistics.totalResolvedInstances,
        uniquePackageNames: tree.statistics.uniquePackageNames,
        uniquePackageVersions: tree.statistics.uniquePackageVersions,
        maximumDepth: tree.statistics.maximumDepth,
      },
    },
    incomplete: diagnostics.length > 0,
    analyzerStatus: {
      unused: 'completed',
      missing: 'completed',
      duplicates: duplicates.diagnostics.length > 0 ? 'incomplete' : 'completed',
      outdated: outdated.diagnostics.length > 0 ? 'incomplete' : 'completed',
      security: security.diagnostics.length > 0 ? 'incomplete' : 'completed',
      'dependency-tree': tree.diagnostics.length > 0 ? 'incomplete' : 'completed',
    },
  };
}

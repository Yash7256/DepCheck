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
import { NOOP_PROGRESS, type ProgressReporter } from '../progress/types.js';

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
  options: { skipSecurity?: boolean; offlineSecurity?: boolean; progress?: ProgressReporter } = {},
): Promise<AuditResult> {
  const progress = options.progress ?? NOOP_PROGRESS;
  const treeProvider = dependencyTreeProvider ?? new NpmDependencyTreeProvider();
  progress.start('Analyzing unused dependencies');
  const unused = await analyzeUnusedDependencies(scan, resolution);
  progress.complete(`Unused dependencies: ${unused.length} finding(s)`);
  progress.start('Analyzing missing dependencies');
  const missing = analyzeMissingDependencies(resolution);
  progress.complete(`Missing dependencies: ${missing.length} finding(s)`);
  progress.start('Checking duplicate dependency versions (npm ls)');
  const duplicates = await analyzeDuplicateDependencyVersions(
    scan.rootDirectory,
    scan.packageManager,
    treeProvider,
  );
  progress.complete(`Duplicate versions: ${duplicates.findings.length} finding(s)`);
  progress.start('Checking outdated dependencies on the npm registry');
  const outdated = await analyzeOutdatedDependencies(
    scan,
    undefined,
    new Map(),
    (completed, total) => progress.update(`Checked ${completed}/${total} packages`),
  );
  progress.complete(`Outdated dependencies: ${outdated.findings.length} finding(s)`);
  let security: { findings: Finding[]; diagnostics: AnalyzerDiagnostic[] };
  if (options.skipSecurity) {
    progress.start('Skipping security analysis');
    security = { findings: [], diagnostics: [] };
    progress.complete('Security analysis skipped');
  } else if (options.offlineSecurity) {
    progress.start('Skipping online security analysis');
    security = {
      findings: [],
      diagnostics: [
        {
          code: 'SECURITY_OFFLINE_UNAVAILABLE',
          message:
            'Offline security analysis requires a local vulnerability cache, which is not configured.',
          severity: 'error',
        },
      ],
    };
    progress.complete('Security analysis skipped (offline)');
  } else {
    progress.start('Checking known vulnerabilities via OSV');
    security = await analyzeSecurity(
      treeProvider,
      scan.rootDirectory,
      scan.packageManager,
      undefined,
      (completed, total) => progress.update(`Checked ${completed}/${total} package versions`),
    );
    progress.complete(`Security vulnerabilities: ${security.findings.length} finding(s)`);
  }
  progress.start('Building dependency-tree statistics (npm ls)');
  const tree = await analyzeDependencyTree(scan.rootDirectory, scan.packageManager, treeProvider);
  progress.complete(`Resolved ${tree.statistics.totalResolvedInstances} dependency instances`);
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

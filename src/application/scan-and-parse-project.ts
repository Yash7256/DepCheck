import { parseProjectSourceFiles } from '../parser/parse-project.js';
import type { ParseProjectResult } from '../parser/types.js';
import { auditProject } from './audit-project.js';
import type { AuditResult } from '../analyzers/types.js';
import { resolveDependencies } from '../resolver/index.js';
import type { DependencyResolutionResult } from '../resolver/types.js';
import { scanProject } from '../scanner/scan.js';
import type { ProjectScanResult } from '../scanner/types.js';

export interface ScanAndParseProjectResult {
  scan: ProjectScanResult;
  parse: ParseProjectResult;
  resolve: DependencyResolutionResult;
  audit: AuditResult;
}

export interface ScanAndParseOptions {
  skipSecurity?: boolean;
  offlineSecurity?: boolean;
  scanOptions?: { include?: string[]; exclude?: string[] };
  config?: import('../config/types.js').DepcheckConfig;
}

export async function scanAndParseProject(
  projectDirectory: string,
  options: ScanAndParseOptions = {},
): Promise<ScanAndParseProjectResult> {
  const scan = await scanProject(projectDirectory, options.scanOptions);
  const parse = await parseProjectSourceFiles(scan.sourceFiles);
  const resolve = await resolveDependencies(scan, parse.references);
  const audit = await auditProject(scan, parse, resolve, undefined, options);
  if (options.config !== undefined) {
    const suppressedFindings = audit.findings.filter(
      (finding) =>
        options.config?.rules.ignoredDependencies.includes(finding.packageName) ||
        options.config?.rules.ignoredFindings.some(
          (rule) =>
            rule.code === finding.code &&
            (rule.packageName === undefined || rule.packageName === finding.packageName),
        ),
    );
    audit.suppressedFindings = suppressedFindings.map((finding) => {
      const rule = options.config?.rules.ignoredFindings.find(
        (item) =>
          item.code === finding.code &&
          (item.packageName === undefined || item.packageName === finding.packageName),
      );
      return { ...finding, suppressionReason: rule?.reason ?? 'Ignored dependency rule' };
    });
    audit.findings = audit.findings.filter((finding) => !suppressedFindings.includes(finding));
    audit.summary = {
      ...audit.summary,
      unused: audit.findings.filter((finding) => finding.code === 'UNUSED_DEPENDENCY').length,
      missing: audit.findings.filter((finding) => finding.code === 'MISSING_DEPENDENCY').length,
      duplicates: audit.findings.filter(
        (finding) => finding.code === 'DUPLICATE_DEPENDENCY_VERSION',
      ).length,
      outdated: audit.findings.filter((finding) => finding.code === 'OUTDATED_DEPENDENCY').length,
      security: audit.findings.filter((finding) => finding.code === 'SECURITY_VULNERABILITY')
        .length,
      total: audit.findings.length,
    };
  }
  return { scan, parse, resolve, audit };
}

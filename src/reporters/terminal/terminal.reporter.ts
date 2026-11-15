import type { AuditResult } from '../../analyzers/types.js';
import type { Reporter } from '../interfaces/reporter.interface.js';
import type { ReportOptions } from '../shared/report.types.js';

export class TerminalReporter implements Reporter {
  constructor(private readonly options: ReportOptions = {}) {}

  async generate(result: AuditResult): Promise<string> {
    if (this.options.quiet) return '';
    const lines = [
      'DepCheck',
      'Dependency Health Report',
      '',
      `Project: ${result.projectName ?? result.projectRoot}`,
      `Scanned: ${result.filesParsed ?? 0} files`,
      '',
      'Audit Summary',
      '',
      `Unused Dependencies:      ${result.summary.unused}`,
      `Missing Dependencies:     ${result.summary.missing}`,
      `Duplicate Versions:       ${result.summary.duplicates}`,
      `Outdated Dependencies:    ${result.summary.outdated ?? 0}`,
      `Security Vulnerabilities: ${result.summary.security ?? 0}`,
      '',
      `Total Findings:           ${result.summary.total}`,
      '',
    ];
    for (const analyzer of ['unused', 'missing', 'duplicates', 'outdated', 'security'] as const) {
      const findings = result.findings.filter((finding) => finding.analyzer === analyzer);
      if (findings.length === 0) continue;
      lines.push(analyzer.toUpperCase(), '');
      for (const finding of findings)
        lines.push(
          `  ${finding.packageName}`,
          `  Severity: ${finding.severity}`,
          `  Confidence: ${finding.confidence}`,
          `  ${finding.message}`,
          `  Manifest: ${finding.manifestPath}`,
          '',
        );
    }
    if (result.diagnostics.length > 0) {
      lines.push('DIAGNOSTICS', '');
      for (const diagnostic of result.diagnostics)
        lines.push(`  ${diagnostic.code}: ${diagnostic.message}`);
      lines.push('');
    }
    lines.push(
      result.incomplete
        ? 'Audit completed with incomplete analysis.'
        : result.findings.length > 0
          ? 'Audit completed with findings.'
          : 'Audit completed successfully.',
    );
    return `${lines.join('\n')}\n`;
  }
}

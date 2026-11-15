import type { AuditResult } from '../../analyzers/types.js';
import { CLI_VERSION } from '../../cli/program.js';
import type { NormalizedReport } from './report.types.js';

export function normalizeReport(
  result: AuditResult,
  generatedAt = new Date().toISOString(),
): NormalizedReport {
  return {
    tool: { name: 'DepCheck', version: CLI_VERSION },
    project: {
      root: result.projectRoot,
      ...(result.projectName === undefined ? {} : { name: result.projectName }),
      ...(result.filesParsed === undefined ? {} : { filesParsed: result.filesParsed }),
    },
    generatedAt,
    status: result.incomplete
      ? 'incomplete'
      : result.findings.length > 0
        ? 'findings'
        : 'completed',
    summary: { ...result.summary, totalFindings: result.summary.total },
    findings: result.findings,
    diagnostics: result.diagnostics,
    analyzers: result.analyzerStatus,
    suppressedFindings: result.suppressedFindings,
  };
}

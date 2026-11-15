import type { AuditResult } from '../../analyzers/types.js';

export type ReportFormat = 'terminal' | 'json' | 'html';

export interface ReportOptions {
  color?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

export interface NormalizedReport {
  tool: { name: 'DepCheck'; version: string };
  project: { root: string; name?: string; filesParsed?: number };
  generatedAt: string;
  status: 'completed' | 'incomplete' | 'findings';
  summary: AuditResult['summary'] & { totalFindings: number };
  findings: AuditResult['findings'];
  diagnostics: AuditResult['diagnostics'];
  analyzers: AuditResult['analyzerStatus'];
  suppressedFindings: AuditResult['suppressedFindings'];
}

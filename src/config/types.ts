import type { ReportFormat } from '../reporters/shared/report.types.js';

export interface FindingSuppression {
  code: string;
  packageName?: string;
  reason: string;
}

export interface DepcheckConfig {
  version: 1;
  include: string[];
  exclude: string[];
  analyzers: {
    unused: boolean;
    missing: boolean;
    duplicates: boolean;
    outdated: boolean;
    security: boolean;
  };
  rules: { ignoredDependencies: string[]; ignoredFindings: FindingSuppression[] };
  security: { minimumSeverity: 'critical' | 'high' | 'moderate' | 'low' | 'unknown' };
  reporting: { format: ReportFormat };
  fix: { allowMajorUpdates: boolean; removeUnusedDependencies: boolean };
}

export const DEFAULT_CONFIG: DepcheckConfig = {
  version: 1,
  include: [],
  exclude: [],
  analyzers: { unused: true, missing: true, duplicates: true, outdated: true, security: true },
  rules: { ignoredDependencies: [], ignoredFindings: [] },
  security: { minimumSeverity: 'low' },
  reporting: { format: 'terminal' },
  fix: { allowMajorUpdates: false, removeUnusedDependencies: false },
};

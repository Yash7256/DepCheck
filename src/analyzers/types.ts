import type { PackageManager } from '../scanner/types.js';

export type FindingSeverity = 'error' | 'warning' | 'info';
export type FindingConfidence = 'high' | 'medium' | 'low';

export type FindingCode =
  | 'UNUSED_DEPENDENCY'
  | 'MISSING_DEPENDENCY'
  | 'DUPLICATE_DEPENDENCY_VERSION'
  | 'OUTDATED_DEPENDENCY'
  | 'SECURITY_VULNERABILITY';

export interface Finding {
  id: string;
  code: FindingCode;
  analyzer: 'unused' | 'missing' | 'duplicates' | 'outdated' | 'security' | 'dependency-tree';
  packageName: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  message: string;
  manifestPath: string;
  filePath?: string;
  line?: number;
  column?: number;
  details?: Record<string, unknown>;
}

export interface AdvancedFindingDetails {
  installedVersion?: string;
  declaredVersion?: string;
  wantedVersion?: string;
  latestVersion?: string;
  updateType?: 'patch' | 'minor' | 'major' | 'up-to-date' | 'unknown';
  vulnerabilityId?: string;
  severity?: string;
  fixedVersions?: string[];
  dependencyPaths?: string[][];
}

export interface AnalyzerDiagnostic {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  packageManager?: PackageManager;
  filePath?: string;
  details?: Record<string, unknown>;
}

export interface AuditSummary {
  unused: number;
  missing: number;
  duplicates: number;
  total: number;
  outdated?: number;
  security?: number;
  tree?: {
    totalResolvedInstances: number;
    uniquePackageNames: number;
    uniquePackageVersions: number;
    maximumDepth: number;
  };
}

export interface AuditResult {
  projectRoot: string;
  findings: Finding[];
  diagnostics: AnalyzerDiagnostic[];
  summary: AuditSummary;
  incomplete?: boolean;
}

import type { AuditResult, Finding } from '../analyzers/types.js';

export const dashboardSections = [
  'Overview',
  'Security',
  'Outdated',
  'Duplicates',
  'Unused',
  'Missing',
  'Dependency Graph',
  'Package Details',
] as const;

export type DashboardSection = (typeof dashboardSections)[number];

export interface DashboardStats {
  total: number;
  security: number;
  outdated: number;
  duplicates: number;
  unused: number;
  missing: number;
}

export interface DashboardProps {
  audit: AuditResult;
  version: string;
  totalReferences: number;
  onExit: () => void;
  onExport: () => Promise<string>;
}

export function getDashboardStats(audit: AuditResult): DashboardStats {
  return {
    total: audit.summary.total,
    security: audit.summary.security ?? countFindings(audit, 'SECURITY_VULNERABILITY'),
    outdated: audit.summary.outdated ?? countFindings(audit, 'OUTDATED_DEPENDENCY'),
    duplicates: audit.summary.duplicates,
    unused: audit.summary.unused,
    missing: audit.summary.missing,
  };
}

export function getSectionFindings(audit: AuditResult, section: DashboardSection): Finding[] {
  const codeBySection: Partial<Record<DashboardSection, Finding['code']>> = {
    Security: 'SECURITY_VULNERABILITY',
    Outdated: 'OUTDATED_DEPENDENCY',
    Duplicates: 'DUPLICATE_DEPENDENCY_VERSION',
    Unused: 'UNUSED_DEPENDENCY',
    Missing: 'MISSING_DEPENDENCY',
  };
  const code = codeBySection[section];
  return code === undefined ? [] : audit.findings.filter((finding) => finding.code === code);
}

function countFindings(audit: AuditResult, code: Finding['code']): number {
  return audit.findings.filter((finding) => finding.code === code).length;
}

export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function moveSection(current: number, direction: -1 | 1): number {
  return (current + dashboardSections.length + direction) % dashboardSections.length;
}

export function moveSelection(current: number, direction: -1 | 1): number {
  return Math.max(0, current + direction);
}

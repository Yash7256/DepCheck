import { describe, expect, it } from 'vitest';

import type { AuditResult } from '../src/analyzers/types.js';
import { isInteractiveTerminal } from '../src/tui/index.js';
import {
  getDashboardStats,
  getSectionFindings,
  moveSection,
  moveSelection,
} from '../src/tui/types.js';

function auditFixture(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    projectRoot: '/project',
    projectName: 'fixture',
    filesParsed: 4,
    findings: [
      {
        id: 'security-1',
        code: 'SECURITY_VULNERABILITY',
        analyzer: 'security',
        packageName: 'secure-package',
        severity: 'error',
        confidence: 'high',
        message: 'Known vulnerability',
        manifestPath: '/project/package.json',
      },
      {
        id: 'outdated-1',
        code: 'OUTDATED_DEPENDENCY',
        analyzer: 'outdated',
        packageName: 'old-package',
        severity: 'info',
        confidence: 'high',
        message: 'A newer version is available.',
        manifestPath: '/project/package.json',
      },
      {
        id: 'missing-1',
        code: 'MISSING_DEPENDENCY',
        analyzer: 'missing',
        packageName: 'missing-package',
        severity: 'error',
        confidence: 'high',
        message: 'Package is not declared.',
        manifestPath: '/project/package.json',
      },
    ],
    diagnostics: [],
    summary: {
      total: 3,
      security: 1,
      outdated: 1,
      duplicates: 0,
      unused: 0,
      missing: 1,
      tree: {
        totalResolvedInstances: 7,
        uniquePackageNames: 5,
        uniquePackageVersions: 6,
        maximumDepth: 3,
      },
    },
    ...overrides,
  };
}

describe('terminal dashboard model', () => {
  it('derives dashboard statistics from the audit result', () => {
    expect(getDashboardStats(auditFixture())).toEqual({
      total: 3,
      security: 1,
      outdated: 1,
      duplicates: 0,
      unused: 0,
      missing: 1,
    });
  });

  it('categorizes findings without changing audit data', () => {
    const audit = auditFixture();
    expect(getSectionFindings(audit, 'Security').map((finding) => finding.packageName)).toEqual([
      'secure-package',
    ]);
    expect(getSectionFindings(audit, 'Outdated').map((finding) => finding.packageName)).toEqual([
      'old-package',
    ]);
    expect(getSectionFindings(audit, 'Overview')).toEqual([]);
    expect(audit.findings).toHaveLength(3);
  });

  it('handles empty audit results', () => {
    expect(
      getDashboardStats(
        auditFixture({ findings: [], summary: { total: 0, unused: 0, missing: 0, duplicates: 0 } }),
      ),
    ).toEqual({
      total: 0,
      security: 0,
      outdated: 0,
      duplicates: 0,
      unused: 0,
      missing: 0,
    });
  });

  it('supports predictable keyboard navigation boundaries', () => {
    expect(moveSection(0, -1)).toBe(7);
    expect(moveSection(7, 1)).toBe(0);
    expect(moveSelection(2, -1)).toBe(1);
    expect(moveSelection(0, -1)).toBe(0);
  });
});

describe('interactive mode detection', () => {
  it('requires a TTY and avoids CI or dumb terminals', () => {
    expect(isInteractiveTerminal({ isTTY: true }, {})).toBe(true);
    expect(isInteractiveTerminal({ isTTY: false }, {})).toBe(false);
    expect(isInteractiveTerminal({ isTTY: true }, { CI: 'true' })).toBe(false);
    expect(isInteractiveTerminal({ isTTY: true }, { TERM: 'dumb' })).toBe(false);
  });
});

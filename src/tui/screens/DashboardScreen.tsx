import { Box, Text } from 'ink';

import type { AuditResult } from '../../analyzers/types.js';
import { tuiColors } from '../theme/colors.js';
import { FindingItem } from '../components/FindingItem.js';
import { Panel } from '../components/Panel.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { StatCard } from '../components/StatCard.js';
import {
  dashboardSections,
  getDashboardStats,
  getSectionFindings,
  truncate,
  type DashboardSection,
} from '../types.js';

export function DashboardScreen({
  audit,
  totalReferences,
  section,
  selectedIndex,
}: {
  audit: AuditResult;
  totalReferences: number;
  section: DashboardSection;
  selectedIndex: number;
}) {
  if (section === 'Overview') return <Overview audit={audit} totalReferences={totalReferences} />;
  if (section === 'Dependency Graph') return <Graph audit={audit} />;
  if (section === 'Package Details') return <Details audit={audit} selectedIndex={selectedIndex} />;
  return <FindingList audit={audit} section={section} selectedIndex={selectedIndex} />;
}

function Overview({ audit, totalReferences }: { audit: AuditResult; totalReferences: number }) {
  const stats = getDashboardStats(audit);
  const max = Math.max(
    stats.security,
    stats.outdated,
    stats.duplicates,
    stats.unused,
    stats.missing,
    1,
  );
  const rows = [
    ['SECURITY', stats.security, tuiColors.error],
    ['OUTDATED', stats.outdated, tuiColors.info],
    ['DUPLICATES', stats.duplicates, tuiColors.warning],
    ['UNUSED', stats.unused, tuiColors.warning],
    ['MISSING', stats.missing, tuiColors.error],
  ] as const;
  return (
    <Box flexDirection="column">
      <Box>
        <StatCard
          label="Total findings"
          value={stats.total}
          color={stats.total > 0 ? tuiColors.warning : tuiColors.success}
        />
        <StatCard label="Files parsed" value={audit.filesParsed ?? 0} />
        <StatCard label="References" value={totalReferences} />
        <StatCard label="Max depth" value={audit.summary.tree?.maximumDepth ?? 0} />
      </Box>
      <Box marginTop={1} gap={1}>
        <Panel title="Finding distribution">
          {rows.map(([label, value, color]) => (
            <Box key={label}>
              <Box width={12}>
                <Text color={tuiColors.muted}>{label}</Text>
              </Box>
              <ProgressBar value={value} maximum={max} />
              <Text color={color}> {value}</Text>
            </Box>
          ))}
        </Panel>
        <Panel title="Project">
          <Text>Files scanned: {audit.filesParsed ?? 0}</Text>
          <Text>Unique packages: {audit.summary.tree?.uniquePackageNames ?? 0}</Text>
          <Text>Resolved versions: {audit.summary.tree?.uniquePackageVersions ?? 0}</Text>
          <Text color={audit.diagnostics.length > 0 ? tuiColors.warning : tuiColors.success}>
            Diagnostics: {audit.diagnostics.length}
          </Text>
        </Panel>
      </Box>
      <Box marginTop={1}>
        <Text color={tuiColors.muted}>
          Use number keys or arrows to inspect each section. Findings are based on this completed
          scan.
        </Text>
      </Box>
    </Box>
  );
}

function FindingList({
  audit,
  section,
  selectedIndex,
}: {
  audit: AuditResult;
  section: DashboardSection;
  selectedIndex: number;
}) {
  const findings = getSectionFindings(audit, section);
  return (
    <Panel title={`${section} · ${findings.length} finding(s)`}>
      {findings.length === 0 ? (
        <Text color={tuiColors.success}>No findings in this category.</Text>
      ) : (
        findings.map((finding, index) => (
          <FindingItem key={finding.id} finding={finding} selected={index === selectedIndex} />
        ))
      )}
    </Panel>
  );
}

function Graph({ audit }: { audit: AuditResult }) {
  const tree = audit.summary.tree;
  return (
    <Panel title="Dependency Graph">
      {tree === undefined ? (
        <Text color={tuiColors.warning}>
          Dependency tree data is unavailable because the analyzer did not complete.
        </Text>
      ) : (
        <Box flexDirection="column">
          <Text>Resolved instances: {tree.totalResolvedInstances}</Text>
          <Text>Unique packages: {tree.uniquePackageNames}</Text>
          <Text>Unique versions: {tree.uniquePackageVersions}</Text>
          <Text>Maximum depth: {tree.maximumDepth}</Text>
          <Box marginTop={1}>
            <Text color={tuiColors.muted}>
              Detailed parent-child paths are not exposed by the current audit result, so none are
              fabricated here.
            </Text>
          </Box>
        </Box>
      )}
    </Panel>
  );
}

function Details({ audit, selectedIndex }: { audit: AuditResult; selectedIndex: number }) {
  const findings = audit.findings;
  const finding = findings[selectedIndex];
  if (finding === undefined)
    return (
      <Panel title="Package Details">
        <Text color={tuiColors.muted}>Select a finding from another section first.</Text>
      </Panel>
    );
  const details = finding.details ?? {};
  return (
    <Panel title={`Package Details · ${finding.packageName}`}>
      <Text>
        Package: <Text color={tuiColors.accent}>{finding.packageName}</Text>
      </Text>
      <Text>Type: {finding.code}</Text>
      <Text>
        Severity: {finding.severity} · Confidence: {finding.confidence}
      </Text>
      <Text>Manifest: {finding.manifestPath}</Text>
      <Text>{finding.message}</Text>
      <Text color={tuiColors.muted}>
        Installed: {String(details.installedVersion ?? 'not provided')} · Latest:{' '}
        {String(details.latestVersion ?? 'not provided')}
      </Text>
      {Array.isArray(details.fixedVersions) && (
        <Text>Fixed versions: {details.fixedVersions.join(', ')}</Text>
      )}
      {Array.isArray(details.dependencyPaths) && (
        <Text>Dependency paths: {details.dependencyPaths.length}</Text>
      )}
    </Panel>
  );
}

export function navigationLabel(index: number): string {
  return `${index + 1} ${truncate(dashboardSections[index] ?? '', 18)}`;
}

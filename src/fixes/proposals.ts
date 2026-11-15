import semver from 'semver';
import type { AuditResult } from '../analyzers/types.js';
import type { DepcheckConfig } from '../config/types.js';
import type { FixProposal } from './types.js';

export function createFixProposals(audit: AuditResult, config: DepcheckConfig): FixProposal[] {
  const proposals: FixProposal[] = [];
  for (const finding of audit.findings) {
    if (
      finding.code === 'UNUSED_DEPENDENCY' &&
      config.fix.removeUnusedDependencies &&
      finding.confidence === 'high'
    ) {
      const type = String(finding.details?.dependencyType ?? '');
      if (type === 'dependencies' || type === 'devDependencies')
        proposals.push({
          id: `remove:${finding.manifestPath}:${finding.packageName}`,
          kind: 'remove',
          packageName: finding.packageName,
          manifestPath: finding.manifestPath,
          section: type,
          from: String(finding.details?.declaredVersion ?? ''),
          reason: finding.message,
          risky: false,
          finding,
        });
    }
    if (finding.code === 'OUTDATED_DEPENDENCY') {
      const declared = String(finding.details?.declaredVersion ?? '');
      const wanted = String(finding.details?.wantedVersion ?? '');
      const kind = String(finding.details?.updateType ?? 'unknown');
      if (wanted && (kind !== 'major' || config.fix.allowMajorUpdates)) {
        let to = wanted;
        if (declared.startsWith('^')) to = `^${wanted}`;
        else if (declared.startsWith('~')) to = `~${wanted}`;
        else if (semver.valid(declared) === null) continue;
        proposals.push({
          id: `update:${finding.manifestPath}:${finding.packageName}`,
          kind: 'update',
          packageName: finding.packageName,
          manifestPath: finding.manifestPath,
          section: String(finding.details?.dependencyType ?? 'dependencies'),
          from: declared,
          to,
          reason: finding.message,
          risky: kind === 'major',
          finding,
        });
      }
    }
  }
  return proposals;
}

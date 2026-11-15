import type { FixProposal } from './types.js';
export function formatFixPreview(proposals: FixProposal[]): string {
  const lines = ['DepCheck — Fix Preview', '', 'Changes:', ''];
  for (const proposal of proposals)
    lines.push(
      `${proposal.kind.toUpperCase()}\n  ${proposal.packageName}\n  From: ${proposal.from}\n  ${proposal.to === undefined ? '' : `To:   ${proposal.to}\n  `}Manifest: ${proposal.manifestPath}\n  Reason: ${proposal.reason}\n  Risky: ${proposal.risky ? 'yes' : 'no'}\n`,
    );
  lines.push(
    `Summary\n  Remove: ${proposals.filter((item) => item.kind === 'remove').length}\n  Update: ${proposals.filter((item) => item.kind === 'update').length}`,
    '',
    'No files have been modified.',
  );
  return `${lines.join('\n')}\n`;
}

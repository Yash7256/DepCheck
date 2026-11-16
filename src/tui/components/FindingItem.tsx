import { Box, Text } from 'ink';

import type { Finding } from '../../analyzers/types.js';
import { tuiColors } from '../theme/colors.js';
import { truncate } from '../types.js';

export function FindingItem({ finding, selected }: { finding: Finding; selected: boolean }) {
  const color =
    finding.severity === 'error'
      ? tuiColors.error
      : finding.severity === 'warning'
        ? tuiColors.warning
        : tuiColors.info;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text {...(selected ? { color: tuiColors.accent } : {})} bold={selected}>
        {selected ? '› ' : '  '}
        {finding.packageName} <Text color={color}>[{finding.severity}]</Text>
      </Text>
      <Text color={tuiColors.muted}> {truncate(finding.message, 100)}</Text>
      <Text color={tuiColors.muted}>
        {' '}
        {finding.manifestPath}
        {finding.line === undefined ? '' : `:${finding.line}`}
      </Text>
    </Box>
  );
}

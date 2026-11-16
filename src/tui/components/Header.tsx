import { Box, Text } from 'ink';

import type { AuditResult } from '../../analyzers/types.js';
import { tuiColors } from '../theme/colors.js';

export function Header({ audit, version }: { audit: AuditResult; version: string }) {
  const status = audit.incomplete
    ? 'INCOMPLETE'
    : audit.findings.length > 0
      ? 'FINDINGS'
      : 'HEALTHY';
  const statusColor = audit.incomplete
    ? tuiColors.warning
    : audit.findings.length > 0
      ? tuiColors.warning
      : tuiColors.success;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between">
        <Text color={tuiColors.accent} bold>
          ◆ DEPCHECK
        </Text>
        <Text color={tuiColors.muted}>v{version}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text bold>Dependency health dashboard</Text>
        <Text color={statusColor} bold>
          {status}
        </Text>
      </Box>
      <Text color={tuiColors.muted}>
        {audit.projectName ?? 'Unnamed project'} · {audit.projectRoot}
      </Text>
    </Box>
  );
}

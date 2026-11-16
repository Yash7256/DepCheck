import { Box, Text } from 'ink';

import { tuiColors } from '../theme/colors.js';

export function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Box flexDirection="column" width={19} marginRight={1}>
      <Text color={tuiColors.muted}>{label}</Text>
      <Text color={color ?? tuiColors.text} bold>
        {String(value).padStart(3, ' ')}
      </Text>
    </Box>
  );
}

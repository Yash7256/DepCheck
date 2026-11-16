import { Text } from 'ink';

import { tuiColors } from '../theme/colors.js';

export function ProgressBar({
  value,
  maximum,
  width = 24,
}: {
  value: number;
  maximum: number;
  width?: number;
}) {
  const ratio = maximum === 0 ? 0 : Math.min(1, value / maximum);
  const filled = Math.round(ratio * width);
  return (
    <Text>
      <Text color={tuiColors.accent}>{'█'.repeat(filled)}</Text>
      <Text color={tuiColors.muted}>{'░'.repeat(width - filled)}</Text>
    </Text>
  );
}

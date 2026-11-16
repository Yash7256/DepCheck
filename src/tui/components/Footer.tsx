import { Box, Text } from 'ink';

import { tuiColors } from '../theme/colors.js';

export function Footer({ message }: { message?: string }) {
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color={tuiColors.muted}>
        ↑↓/←→ Navigate · 1–8 Sections · Enter Select · ? Help · Q Quit
      </Text>
      <Text color={tuiColors.info}>{message ?? 'E Export JSON'}</Text>
    </Box>
  );
}

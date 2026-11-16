import type { ReactNode } from 'react';
import { Box, Text } from 'ink';

import { tuiColors } from '../theme/colors.js';

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box borderStyle="round" borderColor={tuiColors.muted} flexDirection="column" paddingX={1}>
      <Text color={tuiColors.accent} bold>
        {title}
      </Text>
      {children}
    </Box>
  );
}

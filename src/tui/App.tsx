import { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

import type { AuditResult } from '../analyzers/types.js';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { dashboardSections, moveSection, moveSelection, type DashboardProps } from './types.js';
import { tuiColors } from './theme/colors.js';

export function App({ audit, version, totalReferences, onExit, onExport }: DashboardProps) {
  const { exit } = useApp();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string>();
  const section = dashboardSections[sectionIndex] ?? dashboardSections[0];

  useInput((input, key) => {
    if (input.toLowerCase() === 'q' || key.escape) {
      onExit();
      exit();
      return;
    }
    if (input === '?') {
      setMessage('1–8 sections · arrows navigate · Enter details · E export · Q quit');
      return;
    }
    if (input.toLowerCase() === 'e') {
      void onExport()
        .then((path) => setMessage(`Exported JSON to ${path}`))
        .catch((error: unknown) => setMessage(`Export failed: ${String(error)}`));
      return;
    }
    const numeric = Number(input);
    if (numeric >= 1 && numeric <= dashboardSections.length) {
      setSectionIndex(numeric - 1);
      setSelectedIndex(0);
      setMessage(undefined);
      return;
    }
    if (key.leftArrow) setSectionIndex((current) => moveSection(current, -1));
    if (key.rightArrow) setSectionIndex((current) => moveSection(current, 1));
    if (key.upArrow) setSelectedIndex((current) => moveSelection(current, -1));
    if (key.downArrow) setSelectedIndex((current) => moveSelection(current, 1));
    if (key.return)
      setMessage('Package detail view is available with the 8 key. No changes were made.');
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header audit={audit} version={version} />
      <Box marginBottom={1} flexWrap="wrap">
        {dashboardSections.map((item, index) => (
          <Text
            key={item}
            color={index === sectionIndex ? tuiColors.accent : tuiColors.muted}
            bold={index === sectionIndex}
          >
            {index + 1}:{item}{' '}
          </Text>
        ))}
      </Box>
      <DashboardScreen
        audit={audit}
        totalReferences={totalReferences}
        section={section}
        selectedIndex={selectedIndex}
      />
      <Footer {...(message === undefined ? {} : { message })} />
    </Box>
  );
}

export type { AuditResult };

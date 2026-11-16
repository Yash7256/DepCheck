import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { render } from 'ink';

import type { AuditResult } from '../analyzers/types.js';
import { renderReport } from '../reporters/index.js';
import { App } from './App.js';

export interface TuiRenderOptions {
  projectRoot: string;
  version: string;
  totalReferences: number;
  onExit?: () => void;
}

export function isInteractiveTerminal(
  stream: { isTTY?: boolean },
  environment = process.env,
): boolean {
  return stream.isTTY === true && environment.CI !== 'true' && environment.TERM !== 'dumb';
}

export function renderAuditDashboard(audit: AuditResult, options: TuiRenderOptions): void {
  const onExport = async (): Promise<string> => {
    const path = join(options.projectRoot, 'depcheck-report.json');
    await writeFile(path, await renderReport(audit, 'json', {}), 'utf8');
    return path;
  };

  render(
    <App
      audit={audit}
      version={options.version}
      totalReferences={options.totalReferences}
      onExit={options.onExit ?? (() => undefined)}
      onExport={onExport}
    />,
  );
}

export { getDashboardStats, getSectionFindings } from './types.js';

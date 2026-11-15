#!/usr/bin/env node

import { runCli } from './cli/program.js';

export const packageName = 'DepCheck';

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

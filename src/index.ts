#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCli } from './cli/program.js';

export const packageName = 'DepCheck';

const entryPath = process.argv[1] ? realpathSync(resolve(process.argv[1])) : undefined;

if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

import type { Command } from 'commander';

import { createCommandHandler } from '../cli/placeholder.js';
import type { CliStreams } from '../cli/types.js';

export function registerSecurityCommand(program: Command, streams: CliStreams): void {
  program
    .command('security [path]')
    .description('Audit project dependencies for known security issues.')
    .option('--audit-level <level>', 'minimum audit level to report', 'moderate')
    .action(createCommandHandler('security', streams));
}

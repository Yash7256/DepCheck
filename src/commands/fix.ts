import type { Command } from 'commander';

import { createCommandHandler } from '../cli/placeholder.js';
import type { CliStreams } from '../cli/types.js';

export function registerFixCommand(program: Command, streams: CliStreams): void {
  program
    .command('fix [path]')
    .description('Apply safe dependency fixes.')
    .option('--dry-run', 'show planned changes without applying them')
    .action(createCommandHandler('fix', streams));
}

import type { Command } from 'commander';

import { createCommandHandler } from '../cli/placeholder.js';
import type { CliStreams } from '../cli/types.js';

export function registerDuplicatesCommand(program: Command, streams: CliStreams): void {
  program
    .command('duplicates [path]')
    .description('Find duplicate dependency versions in a project.')
    .option('--production', 'check production dependencies only')
    .action(createCommandHandler('duplicates', streams));
}

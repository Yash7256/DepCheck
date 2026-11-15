import type { Command } from 'commander';

import { createCommandHandler } from '../cli/placeholder.js';
import type { CliStreams } from '../cli/types.js';

export function registerOutdatedCommand(program: Command, streams: CliStreams): void {
  program
    .command('outdated [path]')
    .description('Find outdated project dependencies.')
    .option('--include-dev', 'include development dependencies')
    .action(createCommandHandler('outdated', streams));
}

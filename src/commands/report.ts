import type { Command } from 'commander';

import { createCommandHandler } from '../cli/placeholder.js';
import type { CliStreams } from '../cli/types.js';

export function registerReportCommand(program: Command, streams: CliStreams): void {
  program
    .command('report [path]')
    .description('Generate a dependency audit report.')
    .option('-f, --format <format>', 'reserved report format', 'table')
    .action(createCommandHandler('report', streams));
}

import type { Command } from 'commander';

import { createCommandHandler } from '../cli/placeholder.js';
import type { CliStreams } from '../cli/types.js';

export function registerScanCommand(program: Command, streams: CliStreams): void {
  program
    .command('scan [path]')
    .description('Scan a JavaScript or TypeScript project for dependency issues.')
    .option('--json', 'reserved for machine-readable scan output')
    .option('--ignore <pattern...>', 'reserved for ignored paths or packages')
    .action(createCommandHandler('scan', streams));
}

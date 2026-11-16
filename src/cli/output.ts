import chalk from 'chalk';

import type { CliGlobalOptions, CliStreams } from './types.js';

export interface TerminalOutput {
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  verbose(message: string): void;
}

function write(stream: CliStreams['stdout'], message: string): void {
  stream.write(`${message}\n`);
}

export function createTerminalOutput(
  options: CliGlobalOptions,
  streams: CliStreams,
): TerminalOutput {
  return {
    info(message) {
      if (!options.quiet) write(streams.stdout, `${chalk.blue('Info:')} ${message}`);
    },
    success(message) {
      if (!options.quiet) write(streams.stdout, `${chalk.green('Success:')} ${message}`);
    },
    warning(message) {
      if (!options.quiet) write(streams.stderr, `${chalk.yellow('Warning:')} ${message}`);
    },
    error(message) {
      write(streams.stderr, `${chalk.red('Error:')} ${message}`);
    },
    verbose(message) {
      if (options.verbose && !options.quiet)
        write(streams.stderr, `${chalk.gray('Verbose:')} ${message}`);
    },
  };
}

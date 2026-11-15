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
      if (!options.quiet) write(streams.stdout, message);
    },
    success(message) {
      if (!options.quiet) write(streams.stdout, message);
    },
    warning(message) {
      if (!options.quiet) write(streams.stderr, `Warning: ${message}`);
    },
    error(message) {
      write(streams.stderr, `Error: ${message}`);
    },
    verbose(message) {
      if (options.verbose && !options.quiet) write(streams.stderr, `Verbose: ${message}`);
    },
  };
}

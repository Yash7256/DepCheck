import type { Command } from 'commander';

import { CliError } from './errors.js';
import type { CliGlobalOptions } from './types.js';

export function getGlobalOptions(command: Command): CliGlobalOptions {
  const options = command.optsWithGlobals() as CliGlobalOptions;

  if (options.verbose && options.quiet) {
    throw new CliError('The --verbose and --quiet options cannot be used together.', 2);
  }

  return options;
}

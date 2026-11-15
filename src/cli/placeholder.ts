import type { Command } from 'commander';

import { getGlobalOptions } from './options.js';
import { createTerminalOutput } from './output.js';
import { resolveProjectDirectory } from './paths.js';
import type { CliStreams } from './types.js';

export function createCommandHandler(
  commandName: string,
  streams: CliStreams,
): (
  pathArgument: string | undefined,
  commandOptions: Record<string, unknown>,
  command: Command,
) => void {
  return (pathArgument, _commandOptions, command) => {
    const options = getGlobalOptions(command);
    const output = createTerminalOutput(options, streams);
    const projectDirectory = resolveProjectDirectory(pathArgument, options.cwd);

    output.verbose(`Using project directory: ${projectDirectory}`);
    output.info(`${commandName} is registered but not implemented yet.`);
  };
}

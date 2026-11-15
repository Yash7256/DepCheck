import { resolve } from 'node:path';
import { statSync } from 'node:fs';

import { CliError } from './errors.js';

export function resolveDirectory(input: string, baseDirectory: string): string {
  const directory = resolve(baseDirectory, input);

  try {
    if (!statSync(directory).isDirectory()) {
      throw new CliError(`Path is not a directory: ${directory}`, 3);
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`Directory does not exist: ${directory}`, 3, { cause: error });
  }

  return directory;
}

export function getWorkingDirectory(cwdOption: string | undefined): string {
  return resolveDirectory(cwdOption ?? '.', process.cwd());
}

export function resolveProjectDirectory(
  pathArgument: string | undefined,
  cwdOption: string | undefined,
): string {
  const workingDirectory = getWorkingDirectory(cwdOption);
  return resolveDirectory(pathArgument ?? '.', workingDirectory);
}

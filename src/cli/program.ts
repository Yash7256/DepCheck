import { readFileSync } from 'node:fs';

import { Command } from 'commander';

import { registerDuplicatesCommand } from '../commands/duplicates.js';
import { registerFixCommand } from '../commands/fix.js';
import { registerOutdatedCommand } from '../commands/outdated.js';
import { registerReportCommand } from '../commands/report.js';
import { registerScanCommand } from '../commands/scan.js';
import { registerSecurityCommand } from '../commands/security.js';
import { registerTreeCommand } from '../commands/tree.js';
import { CliError, getErrorMessage, getExitCode, isHelpOrVersionError } from './errors.js';
import { getGlobalOptions } from './options.js';
import { createTerminalOutput } from './output.js';
import type { CliGlobalOptions, CliStreams, ExitCode } from './types.js';

declare const __DEPCHECK_VERSION__: string;

function readSourcePackageVersion(): string {
  const sourcePackageJson = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version?: unknown };
  return typeof sourcePackageJson.version === 'string'
    ? sourcePackageJson.version
    : '0.0.0-unknown';
}

export const CLI_VERSION =
  typeof __DEPCHECK_VERSION__ === 'string' ? __DEPCHECK_VERSION__ : readSourcePackageVersion();
export const CLI_DESCRIPTION = 'Audit JavaScript and TypeScript project dependencies.';

export function createProgram(streams: CliStreams): Command {
  const program = new Command();

  program
    .name('depcheck')
    .description(CLI_DESCRIPTION)
    .version(CLI_VERSION)
    .option('--verbose', 'include diagnostic details')
    .option('--quiet', 'suppress informational output')
    .option('--no-progress', 'disable live progress output')
    .option('--cwd <path>', 'run against a specific working directory')
    .configureOutput({
      writeOut: (message) => streams.stdout.write(message),
      writeErr: (message) => streams.stderr.write(message),
    })
    .exitOverride();

  registerScanCommand(program, streams);
  registerOutdatedCommand(program, streams);
  registerDuplicatesCommand(program, streams);
  registerSecurityCommand(program, streams);
  registerReportCommand(program, streams);
  registerFixCommand(program, streams);
  registerTreeCommand(program, streams);

  return program;
}

function getOptionsFromArguments(argv: string[]): CliGlobalOptions {
  return {
    verbose: argv.includes('--verbose'),
    quiet: argv.includes('--quiet'),
  };
}

export async function runCli(
  argv: string[],
  streams: CliStreams = { stdout: process.stdout, stderr: process.stderr },
): Promise<ExitCode> {
  const initialOptions = getOptionsFromArguments(argv);
  const initialOutput = createTerminalOutput(initialOptions, streams);
  const program = createProgram(streams);

  try {
    await program.parseAsync(['node', 'depcheck', ...argv]);
    return 0;
  } catch (error) {
    if (isHelpOrVersionError(error)) return 0;

    const exitCode = getExitCode(error);
    const message = getErrorMessage(error);
    if (!(error instanceof CliError && error.silent)) initialOutput.error(message);

    if (
      initialOptions.verbose &&
      !(error instanceof CliError && (error.exitCode === 2 || error.silent))
    ) {
      initialOutput.verbose(error instanceof Error && error.stack ? error.stack : message);
    }

    return exitCode;
  }
}

export { getGlobalOptions };

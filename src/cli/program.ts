import { Command, CommanderError } from 'commander';

import { registerDuplicatesCommand } from '../commands/duplicates.js';
import { registerFixCommand } from '../commands/fix.js';
import { registerOutdatedCommand } from '../commands/outdated.js';
import { registerReportCommand } from '../commands/report.js';
import { registerRootAction } from '../commands/root.js';
import { registerScanCommand } from '../commands/scan.js';
import { registerSecurityCommand } from '../commands/security.js';
import { registerTreeCommand } from '../commands/tree.js';
import {
  checkForUpdate,
  formatUpdateNotification,
  isUpdateNotificationDisabled,
} from '../services/update-checker.js';
import { CliError, getErrorMessage, getExitCode, isHelpOrVersionError } from './errors.js';
import { getGlobalOptions } from './options.js';
import { createTerminalOutput } from './output.js';
import type { CliGlobalOptions, CliStreams, ExitCode } from './types.js';

declare const __DEPCHECK_VERSION__: string;

export const CLI_VERSION = __DEPCHECK_VERSION__;
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

  registerRootAction(program, streams, CLI_VERSION);

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

function shouldCheckForUpdate(argv: string[]): boolean {
  return !argv.some(
    (argument) =>
      argument === '--help' || argument === '-h' || argument === '--version' || argument === '-V',
  );
}

function isUnknownRootCommand(error: unknown, argv: string[], program: Command): boolean {
  return (
    error instanceof CommanderError &&
    error.code === 'commander.excessArguments' &&
    argv[0] !== undefined &&
    !argv[0].startsWith('-') &&
    !program.commands.some((command) => command.name() === argv[0])
  );
}

export async function runCli(
  argv: string[],
  streams: CliStreams = { stdout: process.stdout, stderr: process.stderr },
): Promise<ExitCode> {
  const initialOptions = getOptionsFromArguments(argv);
  const initialOutput = createTerminalOutput(initialOptions, streams);
  const program = createProgram(streams);

  if (shouldCheckForUpdate(argv) && !isUpdateNotificationDisabled()) {
    void checkForUpdate(CLI_VERSION)
      .then((result) => {
        const notification = formatUpdateNotification(result);
        if (notification !== '') streams.stderr.write(`${notification}\n`);
      })
      .catch(() => undefined);
  }

  try {
    await program.parseAsync(['node', 'depcheck', ...argv]);
    return 0;
  } catch (error) {
    if (isHelpOrVersionError(error)) return 0;

    const exitCode = getExitCode(error);
    const message = isUnknownRootCommand(error, argv, program)
      ? `error: unknown command '${argv[0]}'`
      : getErrorMessage(error);
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

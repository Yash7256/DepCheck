import { CommanderError } from 'commander';

import type { ExitCode } from './types.js';

export class CliError extends Error {
  readonly exitCode: ExitCode;
  readonly silent: boolean;

  constructor(message: string, exitCode: ExitCode, options?: ErrorOptions & { silent?: boolean }) {
    super(message, options);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.silent = options?.silent ?? false;
  }
}

export function isHelpOrVersionError(error: unknown): boolean {
  return (
    error instanceof CommanderError &&
    (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')
  );
}

export function getExitCode(error: unknown): ExitCode {
  if (error instanceof CliError) return error.exitCode;
  if (error instanceof CommanderError) return 2;
  return 1;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

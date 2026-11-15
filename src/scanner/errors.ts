import { CliError } from '../cli/errors.js';

export function createScannerError(message: string, cause?: unknown): CliError {
  return new CliError(message, 3, cause === undefined ? undefined : { cause });
}

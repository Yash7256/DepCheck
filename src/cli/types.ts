import type { Writable } from 'node:stream';

export type OutputStream = Pick<Writable, 'write'>;

export type ExitCode = 0 | 1 | 2 | 3 | 4;

export interface CliGlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  progress?: boolean;
  interactive?: boolean;
  cwd?: string;
}

export interface CliStreams {
  stdout: OutputStream;
  stderr: OutputStream;
}

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CLI_VERSION, createProgram, runCli } from '../src/cli/program.js';
import type { CliStreams } from '../src/cli/types.js';
import { packageName } from '../src/index.js';

class TestStream {
  content = '';

  write(chunk: string): boolean {
    this.content += chunk;
    return true;
  }
}

function streams(): CliStreams & { stdout: TestStream; stderr: TestStream } {
  return { stdout: new TestStream(), stderr: new TestStream() };
}

const temporaryDirectories: string[] = [];

async function createCliFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'depcheck-cli-'));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'cli-fixture' }), 'utf8');
  await writeFile(join(directory, 'index.ts'), "import fs from 'node:fs';\n", 'utf8');
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('project foundation', () => {
  it('exports the package name', () => {
    expect(packageName).toBe('DepCheck');
  });

  it('keeps the CLI version synchronized with package metadata', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };

    expect(CLI_VERSION).toBe(packageJson.version);
  });
});

describe('CLI infrastructure', () => {
  it('registers the expected commands', () => {
    const program = createProgram(streams());

    expect(program.commands.map((command) => command.name())).toEqual([
      'scan',
      'outdated',
      'duplicates',
      'security',
      'report',
      'fix',
      'tree',
    ]);
  });

  it('prints help and version successfully', async () => {
    const helpStreams = streams();
    const versionStreams = streams();

    expect(await runCli(['--help'], helpStreams)).toBe(0);
    expect(helpStreams.stdout.content).toContain('Usage: depcheck');
    expect(helpStreams.stdout.content).toContain('scan [options] [path]');

    expect(await runCli(['--version'], versionStreams)).toBe(0);
    expect(versionStreams.stdout.content).toContain(CLI_VERSION);
  });

  it('prints command-specific help', async () => {
    const result = streams();

    expect(await runCli(['scan', '--help'], result)).toBe(0);
    expect(result.stdout.content).toContain('Scan a JavaScript or TypeScript project');
  });

  it('rejects invalid commands and arguments with usage exit code 2', async () => {
    const invalidCommand = streams();
    const invalidArgument = streams();

    expect(await runCli(['unknown'], invalidCommand)).toBe(2);
    expect(invalidCommand.stderr.content).toContain('unknown command');

    expect(await runCli(['scan', '--not-an-option'], invalidArgument)).toBe(2);
    expect(invalidArgument.stderr.content).toContain('unknown option');
  });

  it('rejects conflicting global options', async () => {
    const result = streams();

    expect(await runCli(['--verbose', '--quiet', 'scan'], result)).toBe(2);
    expect(result.stderr.content).toContain('cannot be used together');
  });

  it('validates cwd and command paths', async () => {
    const missingCwd = streams();
    const invalidPath = streams();

    expect(await runCli(['--cwd', '/path/that/does/not/exist', 'scan'], missingCwd)).toBe(3);
    expect(missingCwd.stderr.content).toContain('Directory does not exist');

    expect(await runCli(['scan', '/path/that/does/not/exist'], invalidPath)).toBe(3);
    expect(invalidPath.stderr.content).toContain('Directory does not exist');
  });

  it('runs the scanner without fabricating analysis results', async () => {
    const result = streams();
    const project = await createCliFixture();

    expect(await runCli(['scan', project, '--no-security'], result)).toBe(1);
    expect(result.stdout.content).toContain('Files parsed:');
    expect(result.stdout.content).toContain('Total references:');
    expect(result.stdout.content).not.toContain('unused dependencies');
  });

  it('keeps errors visible in quiet mode and suppresses informational output', async () => {
    const success = streams();
    const failure = streams();
    const project = await createCliFixture();

    expect(await runCli(['--quiet', 'scan', project, '--no-security'], success)).toBe(1);
    expect(success.stdout.content).toBe('');

    expect(await runCli(['--quiet', 'scan', '/missing'], failure)).toBe(3);
    expect(failure.stderr.content).toContain('Directory does not exist');
  });
});

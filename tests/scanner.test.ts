import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../src/cli/program.js';
import { readManifest, parseManifest } from '../src/scanner/manifest.js';
import { detectPackageManager, discoverLockfiles } from '../src/scanner/lockfiles.js';
import { discoverProject } from '../src/scanner/project.js';
import { scanProject } from '../src/scanner/scan.js';
import { discoverSourceFiles } from '../src/scanner/sources.js';
import { discoverWorkspaces } from '../src/scanner/workspaces.js';
import type { CliStreams } from '../src/cli/types.js';

const temporaryDirectories: string[] = [];

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

async function createProject(manifest: Record<string, unknown>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'depcheck-'));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest), 'utf8');
  return directory;
}

async function writeProjectFile(
  projectDirectory: string,
  path: string,
  content = '',
): Promise<void> {
  const filePath = join(projectDirectory, path);
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('manifest and project discovery', () => {
  it('reads dependency declarations and workspace configuration without changing values', () => {
    const manifest = parseManifest(
      JSON.stringify({
        name: 'fixture',
        version: '1.2.3',
        private: true,
        dependencies: { react: 'workspace:*' },
        devDependencies: { typescript: '^5.0.0' },
        peerDependencies: { vite: '>=5' },
        optionalDependencies: { sharp: 'latest' },
        workspaces: { packages: ['packages/*'] },
        packageManager: 'pnpm@9.0.0',
      }),
      '/tmp/package.json',
    );

    expect(manifest).toMatchObject({
      name: 'fixture',
      version: '1.2.3',
      private: true,
      dependencies: { react: 'workspace:*' },
      workspaces: { packages: ['packages/*'] },
      packageManager: 'pnpm@9.0.0',
    });
  });

  it('rejects malformed root manifests', async () => {
    const project = await createProject({ name: 'valid' });
    await writeFile(join(project, 'package.json'), '{ malformed', 'utf8');

    await expect(discoverProject(project)).rejects.toThrow('Malformed JSON');
    await expect(readManifest(join(project, 'package.json'))).rejects.toThrow('Malformed JSON');
  });

  it('rejects projects without a root package.json', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'depcheck-'));
    temporaryDirectories.push(directory);

    await expect(discoverProject(directory)).rejects.toThrow('no readable root package.json');
  });
});

describe('source discovery', () => {
  it('discovers supported source files, returns absolute paths, and respects exclusions', async () => {
    const project = await createProject({ name: 'fixture' });
    await writeProjectFile(project, 'src/index.ts');
    await writeProjectFile(project, 'src/component.tsx');
    await writeProjectFile(project, 'src/module.mts');
    await writeProjectFile(project, 'src/ignored.js');
    await writeProjectFile(project, 'node_modules/pkg/index.js');
    await writeProjectFile(project, 'dist/generated.js');
    await writeProjectFile(project, 'README.md');
    await writeProjectFile(project, '.gitignore', 'src/ignored.js\nignored-dir/\n');
    await writeProjectFile(project, 'ignored-dir/file.ts');

    const files = await discoverSourceFiles(project);

    expect(files).toEqual(
      expect.arrayContaining([join(project, 'src/index.ts'), join(project, 'src/component.tsx')]),
    );
    expect(files).toContain(join(project, 'src/module.mts'));
    expect(files).not.toContain(join(project, 'src/ignored.js'));
    expect(files).not.toContain(join(project, 'node_modules/pkg/index.js'));
    expect(files).not.toContain(join(project, 'dist/generated.js'));
    expect(files).not.toContain(join(project, 'ignored-dir/file.ts'));
    expect(files.every((file) => file.startsWith(project))).toBe(true);
  });
});

describe('lockfile and package-manager discovery', () => {
  it('detects all supported lockfiles', async () => {
    const project = await createProject({ name: 'fixture' });
    await Promise.all(
      ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'].map((file) =>
        writeProjectFile(project, file),
      ),
    );

    const lockfiles = await discoverLockfiles(project);

    expect(lockfiles.map((lockfile) => lockfile.name)).toEqual([
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lock',
      'bun.lockb',
    ]);
  });

  it('prioritizes packageManager declarations and reports conflicting evidence', () => {
    const manifest = parseManifest(
      JSON.stringify({ packageManager: 'pnpm@9.0.0' }),
      '/tmp/package.json',
    );
    const lockfiles = [
      { name: 'package-lock.json', path: '/tmp/package-lock.json', packageManager: 'npm' },
      { name: 'pnpm-lock.yaml', path: '/tmp/pnpm-lock.yaml', packageManager: 'pnpm' },
    ] as const;

    const detection = detectPackageManager(manifest, [...lockfiles]);

    expect(detection.packageManager).toBe('pnpm');
    expect(detection.evidence.conflicts).toEqual(['npm']);
  });

  it('returns unknown for conflicting lockfiles without a declaration', () => {
    const manifest = parseManifest('{}', '/tmp/package.json');
    const lockfiles = [
      { name: 'package-lock.json', path: '/tmp/package-lock.json', packageManager: 'npm' },
      { name: 'yarn.lock', path: '/tmp/yarn.lock', packageManager: 'yarn' },
    ] as const;

    const detection = detectPackageManager(manifest, [...lockfiles]);

    expect(detection.packageManager).toBe('unknown');
    expect(detection.evidence.conflicts).toEqual(['npm', 'yarn']);
  });
});

describe('workspace and scan discovery', () => {
  it('discovers array and object workspace manifests and skips malformed children', async () => {
    const project = await createProject({ name: 'root', workspaces: ['packages/*'] });
    await writeProjectFile(project, 'packages/one/package.json', JSON.stringify({ name: 'one' }));
    await writeProjectFile(project, 'packages/two/package.json', JSON.stringify({ name: 'two' }));
    await writeProjectFile(project, 'packages/bad/package.json', '{ malformed');

    const arrayWorkspaces = await discoverWorkspaces(
      project,
      parseManifest(JSON.stringify({ workspaces: ['packages/*'] }), join(project, 'package.json')),
    );
    const objectWorkspaces = await discoverWorkspaces(
      project,
      parseManifest(
        JSON.stringify({ workspaces: { packages: ['packages/*'] } }),
        join(project, 'package.json'),
      ),
    );

    expect(arrayWorkspaces.map((workspace) => workspace.name)).toEqual(['one', 'two']);
    expect(objectWorkspaces.map((workspace) => workspace.name)).toEqual(['one', 'two']);
  });

  it('returns structured scan results and integrates with the CLI', async () => {
    const project = await createProject({
      name: 'fixture',
      dependencies: { react: '^19.0.0' },
      packageManager: 'npm@11.0.0',
      workspaces: ['packages/*'],
    });
    await writeProjectFile(project, 'src/index.ts');
    await writeProjectFile(project, 'package-lock.json');
    await writeProjectFile(project, 'packages/app/package.json', JSON.stringify({ name: 'app' }));

    const result = await scanProject(project);
    expect(result.rootDirectory).toBe(project);
    expect(result.summary).toMatchObject({
      sourceFileCount: 1,
      workspaceCount: 1,
      lockfileCount: 1,
      dependencyDeclarationCount: 1,
    });
    expect(result.packageManager).toBe('npm');
    expect(result.rootManifest.dependencies.react).toBe('^19.0.0');

    const cliStreams = streams();
    expect(await runCli(['scan', project], cliStreams)).toBe(0);
    expect(cliStreams.stdout.content).toContain('Source files: 1');
    expect(cliStreams.stdout.content).toContain('Package manager: npm');
  });
});

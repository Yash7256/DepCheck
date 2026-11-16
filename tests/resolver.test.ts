import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseProjectSourceFiles } from '../src/parser/parse-project.js';
import { resolveDependencies } from '../src/resolver/index.js';
import { scanProject } from '../src/scanner/scan.js';

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const project = await mkdtemp(join(tmpdir(), 'depcheck-resolver-'));
  temporaryDirectories.push(project);
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({
      name: 'resolver-fixture',
      dependencies: {
        'root-only': '^1.0.0',
        react: '^19.0.0',
        'my-react': 'npm:react@^19.0.0',
      },
      devDependencies: { typescript: '^5.9.0' },
      peerDependencies: { vite: '^7.0.0' },
      optionalDependencies: { sharp: '^0.34.0' },
      workspaces: ['packages/*'],
    }),
    'utf8',
  );
  await writeFile(
    join(project, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'utf8',
  );
  await mkdir(join(project, 'src'), { recursive: true });
  await mkdir(join(project, 'packages', 'app', 'src'), { recursive: true });
  await mkdir(join(project, 'packages', 'other'), { recursive: true });
  await writeFile(
    join(project, 'packages', 'app', 'package.json'),
    JSON.stringify({
      name: '@fixture/app',
      dependencies: { 'workspace-dep': 'workspace:*' },
    }),
    'utf8',
  );
  await writeFile(
    join(project, 'packages', 'other', 'package.json'),
    JSON.stringify({
      name: '@fixture/other',
    }),
    'utf8',
  );
  return project;
}

async function writeSource(project: string, path: string, content: string): Promise<string> {
  const filePath = join(project, path);
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('dependency resolver', () => {
  it('matches dependency categories, aliases, built-ins, local imports, and undeclared packages', async () => {
    const project = await createProject();
    const sourceFile = await writeSource(
      project,
      'src/index.ts',
      `import root from 'root-only';
import React from 'react';
import TypeScript from 'typescript';
import vite from 'vite';
import sharp from 'sharp';
import alias from 'my-react';
import subpath from 'lodash/get';
import fs from 'node:fs';
import path from 'path';
import local from './local.js';
import configured from '@/configured.js';
`,
    );
    const scan = await scanProject(project);
    const parsed = await parseProjectSourceFiles(scan.sourceFiles);
    const result = await resolveDependencies(scan, parsed.references);
    const bySpecifier = new Map(
      result.references.map((reference) => [reference.moduleSpecifier, reference]),
    );

    expect(bySpecifier.get('root-only')?.classification).toBe('declared');
    expect(bySpecifier.get('react')?.classification).toBe('declared');
    expect(bySpecifier.get('typescript')?.dependency?.type).toBe('devDependencies');
    expect(bySpecifier.get('vite')?.dependency?.type).toBe('peerDependencies');
    expect(bySpecifier.get('sharp')?.dependency?.type).toBe('optionalDependencies');
    expect(bySpecifier.get('my-react')?.classification).toBe('alias');
    expect(bySpecifier.get('my-react')?.dependency?.alias).toEqual({
      target: 'react',
      specifier: 'react@^19.0.0',
    });
    expect(bySpecifier.get('lodash/get')?.classification).toBe('undeclared');
    expect(bySpecifier.get('node:fs')?.classification).toBe('builtin');
    expect(bySpecifier.get('path')?.classification).toBe('builtin');
    expect(bySpecifier.get('./local.js')?.classification).toBe('local');
    expect(bySpecifier.get('@/configured.js')?.classification).toBe('local');
    expect(bySpecifier.get('@/configured.js')?.packageName).toBe('@/configured.js');
    expect(bySpecifier.get('root-only')?.workspace).toBeNull();
    expect(result.summary).toMatchObject({
      declaredReferences: 5,
      aliasReferences: 1,
      builtinReferences: 2,
      localReferences: 2,
      undeclaredReferences: 1,
    });
    expect(result.references.find((reference) => reference.filePath === sourceFile)?.line).toBe(1);
  });

  it('resolves workspace references using only the owning workspace index', async () => {
    const project = await createProject();
    await writeSource(
      project,
      'src/root.ts',
      `import root from 'root-only';
import workspace from 'workspace-dep';
`,
    );
    const workspaceSource = await writeSource(
      project,
      'packages/app/src/index.ts',
      `import workspace from 'workspace-dep';
import root from 'root-only';
import react from 'react';
import other from '@fixture/other';
`,
    );
    const scan = await scanProject(project);
    const parsed = await parseProjectSourceFiles(scan.sourceFiles);
    const result = await resolveDependencies(scan, parsed.references);
    const workspaceReferences = result.references.filter(
      (reference) => reference.filePath === workspaceSource,
    );
    const bySpecifier = new Map(
      workspaceReferences.map((reference) => [reference.moduleSpecifier, reference]),
    );

    expect(bySpecifier.get('workspace-dep')?.classification).toBe('declared');
    expect(bySpecifier.get('workspace-dep')?.dependency?.version).toBe('workspace:*');
    expect(bySpecifier.get('root-only')?.classification).toBe('undeclared');
    expect(bySpecifier.get('react')?.classification).toBe('undeclared');
    expect(bySpecifier.get('@fixture/other')?.classification).toBe('workspace');
    expect(bySpecifier.get('workspace-dep')?.workspace?.name).toBe('@fixture/app');
    expect(
      bySpecifier.get('workspace-dep')?.dependency?.workspacePath?.replaceAll('\\', '/'),
    ).toContain('packages/app');

    const rootReference = result.references.find(
      (reference) =>
        reference.filePath.replaceAll('\\', '/').endsWith('src/root.ts') &&
        reference.moduleSpecifier === 'root-only',
    );
    expect(rootReference?.classification).toBe('declared');
    expect(rootReference?.workspace).toBeNull();
  });

  it('selects the deepest workspace for nested workspace paths', async () => {
    const project = await createProject();
    await writeFile(
      join(project, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*', 'packages/*/nested/*'] }),
      'utf8',
    );
    await mkdir(join(project, 'packages', 'outer', 'nested', 'inner'), { recursive: true });
    await writeFile(
      join(project, 'packages', 'outer', 'package.json'),
      JSON.stringify({ name: '@fixture/outer', dependencies: { outer: '1.0.0' } }),
      'utf8',
    );
    await writeFile(
      join(project, 'packages', 'outer', 'nested', 'inner', 'package.json'),
      JSON.stringify({ name: '@fixture/inner', dependencies: { inner: '1.0.0' } }),
      'utf8',
    );
    const nestedSource = await writeSource(
      project,
      'packages/outer/nested/inner/src/index.ts',
      "import inner from 'inner';\nimport outer from 'outer';\n",
    );
    const scan = await scanProject(project);
    const parsed = await parseProjectSourceFiles(scan.sourceFiles);
    const result = await resolveDependencies(scan, parsed.references);
    const nestedReferences = result.references.filter(
      (reference) => reference.filePath === nestedSource,
    );

    expect(
      nestedReferences.every((reference) => reference.workspace?.name === '@fixture/inner'),
    ).toBe(true);
    expect(
      nestedReferences.find((reference) => reference.moduleSpecifier === 'inner')?.classification,
    ).toBe('declared');
    expect(
      nestedReferences.find((reference) => reference.moduleSpecifier === 'outer')?.classification,
    ).toBe('undeclared');
  });
});

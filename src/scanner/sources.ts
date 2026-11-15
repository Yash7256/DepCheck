import { readFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';

import fg from 'fast-glob';
import ignore, { type Ignore } from 'ignore';

export const DEFAULT_SOURCE_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/out/**',
  '**/target/**',
  '**/vendor/**',
  '**/tmp/**',
  '**/temp/**',
] as const;

export const SOURCE_GLOB = '**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}';

export interface SourceDiscoveryOptions {
  include?: string[];
  exclude?: string[];
}

async function readGitignore(projectDirectory: string): Promise<Ignore> {
  const rules = ignore();

  try {
    rules.add(await readFile(`${projectDirectory}/.gitignore`, 'utf8'));
  } catch {
    // A project without .gitignore is valid and has no additional ignore rules.
  }

  return rules;
}

export async function discoverSourceFiles(
  projectDirectory: string,
  options: SourceDiscoveryOptions = {},
): Promise<string[]> {
  const include =
    options.include?.length === 0 ? [SOURCE_GLOB] : (options.include ?? [SOURCE_GLOB]);
  const ignore = [...DEFAULT_SOURCE_EXCLUDES, ...(options.exclude ?? [])];

  const files = await fg(include, {
    absolute: true,
    cwd: projectDirectory,
    dot: true,
    ignore,
    onlyFiles: true,
    unique: true,
  });

  const gitignore = await readGitignore(projectDirectory);
  return files.filter((file) => {
    const relativePath = relative(projectDirectory, file).split(sep).join('/');
    return !gitignore.ignores(relativePath);
  });
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as ts from 'typescript';

export async function readTsconfigAliases(projectDirectory: string): Promise<ReadonlySet<string>> {
  try {
    const content = await readFile(join(projectDirectory, 'tsconfig.json'), 'utf8');
    const parsed: unknown = ts.parseConfigFileTextToJson(
      join(projectDirectory, 'tsconfig.json'),
      content,
    ).config;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return new Set();
    const compilerOptions = Reflect.get(parsed, 'compilerOptions');
    if (typeof compilerOptions !== 'object' || compilerOptions === null) return new Set();
    const paths = Reflect.get(compilerOptions, 'paths');
    if (typeof paths !== 'object' || paths === null || Array.isArray(paths)) return new Set();
    return new Set(
      Object.keys(paths).filter((key) => {
        const value = Reflect.get(paths, key);
        return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
      }),
    );
  } catch {
    return new Set();
  }
}

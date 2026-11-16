import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'tsup';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
  version?: unknown;
};

if (typeof packageJson.version !== 'string' || packageJson.version.length === 0)
  throw new Error('package.json must define a non-empty string version');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['typescript'],
  define: {
    __DEPCHECK_VERSION__: JSON.stringify(packageJson.version),
  },
});

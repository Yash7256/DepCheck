import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __DEPCHECK_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

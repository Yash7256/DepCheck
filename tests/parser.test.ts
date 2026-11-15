import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { extractPackageName } from '../src/parser/package-name.js';
import { parseProjectSourceFiles } from '../src/parser/parse-project.js';
import { parseSourceFile } from '../src/parser/parse-source.js';

const temporaryDirectories: string[] = [];

async function createSourceFile(fileName: string, content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'depcheck-parser-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, fileName);
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('package-name extraction', () => {
  it('extracts package roots and excludes local and built-in modules', () => {
    expect(extractPackageName('react')).toBe('react');
    expect(extractPackageName('lodash/get')).toBe('lodash');
    expect(extractPackageName('@nestjs/core')).toBe('@nestjs/core');
    expect(extractPackageName('@scope/package/subpath')).toBe('@scope/package');
    expect(extractPackageName('./utils')).toBeNull();
    expect(extractPackageName('../components/Button')).toBeNull();
    expect(extractPackageName('/absolute/module')).toBeNull();
    expect(extractPackageName('node:fs')).toBeNull();
    expect(extractPackageName('fs')).toBeNull();
  });
});

describe('source parser', () => {
  it('extracts static, type-only, dynamic, CommonJS, and re-export references', async () => {
    const filePath = await createSourceFile(
      'fixture.ts',
      `import React, { useState, type ComponentType } from 'react';
import * as get from 'lodash/get';
import type { Config } from '@scope/package/subpath';
import 'side-effect-package';
const dynamic = import('dynamic-package');
const templated = import(\`template-package\`);
const unknownDynamic = import(moduleName);
const fs = require('node:fs');
const { join } = require('path');
const unknownRequire = require(packageName);
export { React } from '@nestjs/core';
export type { Config } from '@scope/package';
export * from 'wildcard-package';
export * as namespace from 'namespace-package';
const text = "import 'not-a-reference'";
// require('not-a-reference')
`,
    );

    const result = await parseSourceFile(filePath);
    const packageNames = result.references.map((reference) => reference.packageName);
    const kinds = result.references.map((reference) => reference.importKind);

    expect(packageNames).toEqual([
      'react',
      'react',
      'react',
      'lodash',
      '@scope/package',
      'side-effect-package',
      'dynamic-package',
      'template-package',
      null,
      null,
      '@nestjs/core',
      '@scope/package',
      'wildcard-package',
      'namespace-package',
    ]);
    expect(kinds).toEqual([
      'default',
      'named',
      'named',
      'namespace',
      'named',
      'side-effect',
      'dynamic',
      'dynamic',
      'commonjs',
      'destructured',
      'named',
      'named',
      'wildcard',
      'wildcard',
    ]);
    expect(
      result.references.find((reference) => reference.moduleSpecifier === 'node:fs')?.packageName,
    ).toBeNull();
    expect(result.references.filter((reference) => reference.isTypeOnly)).toHaveLength(3);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.every((item) => item.filePath === filePath)).toBe(true);
  });

  it('keeps duplicate references and records one-based source locations', async () => {
    const filePath = await createSourceFile('duplicates.js', "import 'react';\nimport 'react';\n");

    const result = await parseSourceFile(filePath);

    expect(result.references).toHaveLength(2);
    expect(result.references[0]?.location).toEqual({ filePath, line: 1, column: 8 });
    expect(result.references[1]?.location).toEqual({ filePath, line: 2, column: 8 });
  });

  it('does not treat comments and string literals as imports', async () => {
    const filePath = await createSourceFile(
      'comments.ts',
      `// import 'comment-package'
const value = "require('string-package')";
`,
    );

    const result = await parseSourceFile(filePath);

    expect(result.references).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('continues parsing other files and reports malformed source diagnostics', async () => {
    const validFile = await createSourceFile('valid.ts', "import 'valid-package';\n");
    const malformedFile = await createSourceFile(
      'malformed.ts',
      "const broken = ;\nimport 'after-error';\n",
    );

    const result = await parseProjectSourceFiles([validFile, malformedFile]);

    expect(result.summary.filesParsed).toBe(2);
    expect(result.references.map((reference) => reference.packageName)).toEqual([
      'valid-package',
      'after-error',
    ]);
    expect(result.diagnostics.some((diagnostic) => diagnostic.filePath === malformedFile)).toBe(
      true,
    );
  });
});

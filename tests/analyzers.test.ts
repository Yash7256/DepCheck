import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  analyzeDuplicateDependencyVersions,
  NpmDependencyTreeProvider,
  type DependencyTreeNode,
} from '../src/analyzers/duplicates.js';
import { analyzeMissingDependencies } from '../src/analyzers/missing.js';
import { analyzeUnusedDependencies } from '../src/analyzers/unused.js';
import { analyzeOutdatedDependencies, type PackageMetadata } from '../src/analyzers/outdated.js';
import { analyzeSecurity } from '../src/analyzers/security.js';
import { analyzeDependencyTree } from '../src/analyzers/tree.js';
import type { DependencyResolutionResult } from '../src/resolver/types.js';
import type { ProjectScanResult } from '../src/scanner/types.js';

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function fakeSpawn(
  stdout: string,
  stderr: string,
  code: number,
): (...args: unknown[]) => FakeChild {
  return () => {
    const child = new FakeChild();
    queueMicrotask(() => {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit('close', code);
    });
    return child;
  };
}

function resolution(
  references: DependencyResolutionResult['references'],
): DependencyResolutionResult {
  return {
    references,
    summary: {
      totalReferences: references.length,
      declaredReferences: references.filter((reference) => reference.classification === 'declared')
        .length,
      aliasReferences: references.filter((reference) => reference.classification === 'alias')
        .length,
      builtinReferences: references.filter((reference) => reference.classification === 'builtin')
        .length,
      localReferences: references.filter((reference) => reference.classification === 'local')
        .length,
      workspaceReferences: references.filter(
        (reference) => reference.classification === 'workspace',
      ).length,
      undeclaredReferences: references.filter(
        (reference) => reference.classification === 'undeclared',
      ).length,
      unknownReferences: references.filter((reference) => reference.classification === 'unknown')
        .length,
    },
  };
}

function emptyScan(): ProjectScanResult {
  return {
    rootDirectory: '/project',
    rootManifest: {
      path: '/project/package.json',
      dependencies: { used: '^1.0.0', unused: '^1.0.0', 'script-used': '^1.0.0' },
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    },
    sourceFiles: [],
    lockfiles: [],
    packageManager: 'npm',
    packageManagerEvidence: { lockfiles: [], conflicts: [] },
    workspaces: [],
    summary: {
      sourceFileCount: 0,
      workspaceCount: 0,
      lockfileCount: 2,
      dependencyDeclarationCount: 3,
    },
  };
}

describe('core analyzers', () => {
  it('classifies outdated patch, minor, major, and invalid ranges with cached provider calls', async () => {
    const scan = emptyScan();
    scan.rootManifest.dependencies = {
      patch: '^1.0.0',
      minor: '^1.0.0',
      major: '^1.0.0',
      invalid: 'latest',
    };
    const calls: string[] = [];
    const metadata: Record<string, PackageMetadata> = {
      patch: {
        name: 'patch',
        versions: { '1.0.0': {}, '1.0.1': {} },
        'dist-tags': { latest: '1.0.1' },
      },
      minor: {
        name: 'minor',
        versions: { '1.0.0': {}, '1.2.0': {} },
        'dist-tags': { latest: '1.2.0' },
      },
      major: {
        name: 'major',
        versions: { '1.0.0': {}, '2.0.0': {} },
        'dist-tags': { latest: '2.0.0' },
      },
      invalid: { name: 'invalid', versions: {}, 'dist-tags': { latest: '1.0.0' } },
    };
    const result = await analyzeOutdatedDependencies(scan, {
      getPackageMetadata: async (name) => {
        calls.push(name);
        return metadata[name] as PackageMetadata;
      },
    });
    expect(result.findings.map((finding) => finding.details?.updateType).sort()).toEqual([
      'major',
      'minor',
      'patch',
    ]);
    expect(result.diagnostics).toHaveLength(1);
    expect(calls).toEqual(['patch', 'minor', 'major']);
  });

  it('reports unused dependencies with low confidence and respects script evidence', async () => {
    const scan = emptyScan();
    scan.rootManifest.scripts = { check: 'script-used --verify' };
    const result = await analyzeUnusedDependencies(
      scan,
      resolution([
        {
          moduleSpecifier: 'used',
          packageName: 'used',
          classification: 'declared',
          dependency: {
            name: 'used',
            version: '^1.0.0',
            type: 'dependencies',
            manifestPath: '/project/package.json',
            workspacePath: null,
          },
          filePath: '/project/src/index.ts',
          manifestPath: '/project/package.json',
          line: 1,
          column: 1,
          workspace: null,
          referenceType: 'import',
          importKind: 'default',
          isTypeOnly: false,
        },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.packageName).toBe('unused');
    expect(result[0]?.confidence).toBe('low');
  });

  it('deduplicates missing dependency findings by owning manifest and package', () => {
    const references: DependencyResolutionResult['references'] = [
      {
        moduleSpecifier: 'missing/subpath',
        packageName: 'missing',
        classification: 'undeclared',
        dependency: null,
        filePath: '/project/src/a.ts',
        manifestPath: '/project/package.json',
        line: 1,
        column: 1,
        workspace: null,
        referenceType: 'import',
        importKind: 'named',
        isTypeOnly: false,
      },
      {
        moduleSpecifier: 'missing',
        packageName: 'missing',
        classification: 'undeclared',
        dependency: null,
        filePath: '/project/src/b.ts',
        manifestPath: '/project/package.json',
        line: 2,
        column: 1,
        workspace: null,
        referenceType: 'dynamic-import',
        importKind: 'dynamic',
        isTypeOnly: false,
      },
    ];

    const findings = analyzeMissingDependencies(resolution(references));

    expect(findings).toHaveLength(1);
    expect(findings[0]?.packageName).toBe('missing');
    expect(findings[0]?.details?.referenceCount).toBe(2);
  });

  it('reports only distinct duplicate versions', async () => {
    const tree: DependencyTreeNode = {
      dependencies: {
        first: { version: '1.0.0', dependencies: { shared: { version: '2.0.0' } } },
        second: { version: '1.0.0', dependencies: { shared: { version: '3.0.0' } } },
        third: { version: '1.0.0', dependencies: { same: { version: '4.0.0' } } },
        fourth: { version: '1.0.0', dependencies: { same: { version: '4.0.0' } } },
      },
    };
    const provider = {
      getDependencyTree: async () => ({ tree, diagnostics: [] }),
    };

    const result = await analyzeDuplicateDependencyVersions('/project', 'npm', provider);

    expect(result.diagnostics).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.packageName).toBe('shared');
  });

  it('reports OSV vulnerabilities with deduplicated advisories and paths', async () => {
    const tree: DependencyTreeNode = {
      dependencies: {
        vulnerable: { version: '1.0.0', dependencies: { transitive: { version: '2.0.0' } } },
      },
    };
    const provider = { getDependencyTree: async () => ({ tree, diagnostics: [] }) };
    const result = await analyzeSecurity(provider, '/project', 'npm', {
      queryPackage: async (name) =>
        name === 'vulnerable'
          ? [
              { id: 'OSV-1', summary: 'bad', severity: 'HIGH', fixedVersions: ['1.0.1'] },
              { id: 'OSV-1' },
            ]
          : [],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.details?.fixedVersions).toEqual(['1.0.1']);
    expect(result.findings[0]?.details?.dependencyPaths).toEqual([['project', 'vulnerable@1.0.0']]);
  });

  it('calculates dependency-tree statistics and unsupported diagnostics', async () => {
    const tree: DependencyTreeNode = {
      dependencies: {
        a: { version: '1.0.0', dependencies: { b: { version: '1.0.0' } } },
        c: { version: '1.0.0', dependencies: { b: { version: '2.0.0' } } },
      },
    };
    const provider = { getDependencyTree: async () => ({ tree, diagnostics: [] }) };
    const result = await analyzeDependencyTree('/project', 'npm', provider);
    expect(result.statistics).toMatchObject({
      totalResolvedInstances: 4,
      uniquePackageNames: 3,
      uniquePackageVersions: 4,
      directDependencyCount: 2,
      transitiveDependencyCount: 2,
      duplicatePackageCount: 1,
      maximumDepth: 2,
    });
    const unsupported = await analyzeDependencyTree('/project', 'pnpm', provider);
    expect(unsupported.diagnostics[0]?.code).toBe('TREE_ANALYSIS_UNSUPPORTED_PACKAGE_MANAGER');
  });
});

describe('npm dependency-tree provider', () => {
  it('uses the Windows command shell for npm.cmd', async () => {
    let invocation: { executable: string; options: { shell?: boolean } } | undefined;
    const provider = new NpmDependencyTreeProvider(
      ((executable: string, _args: string[], options: { shell?: boolean }) => {
        invocation = { executable, options };
        return fakeSpawn('{"dependencies":{}}', '', 0)();
      }) as never,
      10_000,
      'win32',
    );

    await provider.getDependencyTree('C:\\project');

    expect(invocation?.executable).toBe('npm.cmd');
    expect(invocation?.options.shell).toBe(true);
  });

  it('parses valid JSON even when npm exits non-zero', async () => {
    const provider = new NpmDependencyTreeProvider(
      fakeSpawn('{"dependencies":{"pkg":{"version":"1.0.0"}}}', 'peer warning', 1) as never,
    );

    const result = await provider.getDependencyTree('/project');

    expect(result.tree?.dependencies?.pkg?.version).toBe('1.0.0');
    expect(result.diagnostics).toEqual([]);
  });

  it('reports invalid JSON and timeouts', async () => {
    const invalid = new NpmDependencyTreeProvider(fakeSpawn('not-json', 'npm failed', 1) as never);
    const invalidResult = await invalid.getDependencyTree('/project');
    expect(invalidResult.tree).toBeNull();
    expect(invalidResult.diagnostics[0]?.code).toBe('DUPLICATE_TREE_INVALID_JSON');

    const hangingChild = new FakeChild();
    const timeoutProvider = new NpmDependencyTreeProvider((() => hangingChild) as never, 5);
    const timeoutResult = await timeoutProvider.getDependencyTree('/project');
    expect(timeoutResult.diagnostics[0]?.code).toBe('DUPLICATE_TREE_TIMEOUT');
    expect(hangingChild.killed).toBe(true);
  });

  it('does not run npm for unsupported package managers', async () => {
    let called = false;
    const provider = {
      getDependencyTree: async () => {
        called = true;
        return { tree: null, diagnostics: [] };
      },
    };

    const result = await analyzeDuplicateDependencyVersions('/project', 'pnpm', provider);

    expect(called).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe('DUPLICATE_ANALYSIS_UNSUPPORTED_PACKAGE_MANAGER');
  });
});

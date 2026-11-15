import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';

import { loadConfig } from '../src/config/loader.js';
import { mergeCliConfig } from '../src/config/merge.js';
import { applyManifestProposals } from '../src/fixes/manifest-editor.js';
import { formatFixPreview } from '../src/fixes/preview.js';
import { createFixProposals } from '../src/fixes/proposals.js';
import type { AuditResult } from '../src/analyzers/types.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'depcheck-fix-'));
  dirs.push(directory);
  return directory;
}

describe('configuration and fixes', () => {
  it('loads defaults, validates JSON, and applies CLI precedence', async () => {
    const directory = await fixture();
    await writeFile(
      join(directory, 'depcheck.config.json'),
      JSON.stringify({ version: 1, exclude: ['generated/**'], reporting: { format: 'json' } }),
      'utf8',
    );
    const loaded = await loadConfig(directory);
    expect(loaded.config.reporting.format).toBe('json');
    expect(
      mergeCliConfig(loaded.config, { format: 'html', exclude: ['dist/**'] }).reporting.format,
    ).toBe('html');
    expect(mergeCliConfig(loaded.config, { format: 'html', exclude: ['dist/**'] }).exclude).toEqual(
      ['generated/**', 'dist/**'],
    );
  });

  it('rejects unknown configuration fields', async () => {
    const directory = await fixture();
    await writeFile(
      join(directory, 'depcheck.config.json'),
      JSON.stringify({ version: 1, unexpected: true }),
      'utf8',
    );
    await expect(loadConfig(directory)).rejects.toThrow('Invalid configuration');
  });

  it('creates only approved high-confidence fix proposals', async () => {
    const audit: AuditResult = {
      projectRoot: '/project',
      findings: [
        {
          id: 'unused',
          code: 'UNUSED_DEPENDENCY',
          analyzer: 'unused',
          packageName: 'safe',
          severity: 'warning',
          confidence: 'high',
          message: 'unused',
          manifestPath: '/project/package.json',
          details: { dependencyType: 'dependencies', declaredVersion: '^1.0.0' },
        },
        {
          id: 'peer',
          code: 'UNUSED_DEPENDENCY',
          analyzer: 'unused',
          packageName: 'peer',
          severity: 'warning',
          confidence: 'high',
          message: 'peer',
          manifestPath: '/project/package.json',
          details: { dependencyType: 'peerDependencies', declaredVersion: '^1.0.0' },
        },
        {
          id: 'major',
          code: 'OUTDATED_DEPENDENCY',
          analyzer: 'outdated',
          packageName: 'major',
          severity: 'info',
          confidence: 'high',
          message: 'major',
          manifestPath: '/project/package.json',
          details: {
            dependencyType: 'dependencies',
            declaredVersion: '^1.0.0',
            wantedVersion: '2.0.0',
            updateType: 'major',
          },
        },
      ],
      diagnostics: [],
      summary: { unused: 2, missing: 0, duplicates: 0, outdated: 1, security: 0, total: 3 },
    };
    const config = (await loadConfig('/tmp/does-not-exist')).config;
    const proposals = createFixProposals(audit, {
      ...config,
      fix: { allowMajorUpdates: false, removeUnusedDependencies: true },
    });
    expect(proposals.map((proposal) => proposal.packageName)).toEqual(['safe']);
    expect(formatFixPreview(proposals)).toContain('No files have been modified.');
  });

  it('applies manifest changes atomically and preserves unrelated fields', async () => {
    const directory = await fixture();
    const manifestPath = join(directory, 'package.json');
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          name: 'fixture',
          dependencies: { remove: '^1.0.0', keep: '^2.0.0' },
          scripts: { test: 'echo test' },
        },
        null,
        2,
      ),
      'utf8',
    );
    const finding = {
      id: 'remove',
      code: 'UNUSED_DEPENDENCY' as const,
      analyzer: 'unused' as const,
      packageName: 'remove',
      severity: 'warning' as const,
      confidence: 'high' as const,
      message: 'unused',
      manifestPath,
      details: { dependencyType: 'dependencies', declaredVersion: '^1.0.0' },
    };
    const proposal = createFixProposals(
      {
        projectRoot: directory,
        findings: [finding],
        diagnostics: [],
        summary: { unused: 1, missing: 0, duplicates: 0, total: 1 },
      },
      {
        ...(await loadConfig(directory)).config,
        fix: { allowMajorUpdates: false, removeUnusedDependencies: true },
      },
    )[0];
    expect(proposal).toBeDefined();
    const applied = await applyManifestProposals([proposal!]);
    expect(applied.failed).toHaveLength(0);
    const updated = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(updated.dependencies.remove).toBeUndefined();
    expect(updated.dependencies.keep).toBe('^2.0.0');
    expect(updated.scripts.test).toBe('echo test');
  });
});

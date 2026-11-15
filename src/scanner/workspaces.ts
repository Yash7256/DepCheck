import { join, resolve } from 'node:path';

import fg from 'fast-glob';

import { DEFAULT_SOURCE_EXCLUDES } from './sources.js';
import { readManifest } from './manifest.js';
import type { PackageManifest, WorkspaceInfo } from './types.js';

function workspaceManifestPatterns(manifest: PackageManifest): string[] {
  return (manifest.workspaces?.packages ?? []).map((pattern) => {
    const negated = pattern.startsWith('!');
    const value = negated ? pattern.slice(1) : pattern;
    const manifestPattern = value.endsWith('package.json') ? value : join(value, 'package.json');
    return negated ? `!${manifestPattern}` : manifestPattern;
  });
}

export async function discoverWorkspaces(
  rootDirectory: string,
  rootManifest: PackageManifest,
): Promise<WorkspaceInfo[]> {
  const patterns = workspaceManifestPatterns(rootManifest);
  if (patterns.length === 0) return [];

  const paths = await fg(patterns, {
    absolute: true,
    cwd: rootDirectory,
    ignore: [...DEFAULT_SOURCE_EXCLUDES],
    onlyFiles: true,
    unique: true,
  });
  const workspacePaths = [
    ...new Set(paths.map((path) => resolve(path)).filter((path) => path !== rootManifest.path)),
  ];
  const workspaces: WorkspaceInfo[] = [];

  for (const manifestPath of workspacePaths) {
    try {
      const manifest = await readManifest(manifestPath);
      workspaces.push({
        path: manifestPath,
        ...(manifest.name === undefined ? {} : { name: manifest.name }),
      });
    } catch {
      // A malformed workspace should not invalidate an otherwise valid root project.
    }
  }

  return workspaces;
}

import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

import { resolveDirectory } from '../cli/paths.js';
import { createScannerError } from './errors.js';
import { readManifest } from './manifest.js';
import type { PackageManifest } from './types.js';

export interface ProjectDiscovery {
  rootDirectory: string;
  rootManifest: PackageManifest;
}

export async function discoverProject(projectDirectory: string): Promise<ProjectDiscovery> {
  const rootDirectory = resolveDirectory(projectDirectory, process.cwd());
  const manifestPath = join(rootDirectory, 'package.json');

  try {
    await access(manifestPath, constants.R_OK);
  } catch (error) {
    throw createScannerError(`Project has no readable root package.json: ${manifestPath}`, error);
  }

  return {
    rootDirectory,
    rootManifest: await readManifest(manifestPath),
  };
}

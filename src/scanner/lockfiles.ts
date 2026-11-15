import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

import type {
  PackageManager,
  PackageManagerEvidence,
  LockfileInfo,
  PackageManifest,
} from './types.js';

const LOCKFILES = [
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
] as const satisfies ReadonlyArray<
  readonly [LockfileInfo['name'], Exclude<PackageManager, 'unknown'>]
>;

export async function discoverLockfiles(projectDirectory: string): Promise<LockfileInfo[]> {
  const discovered = await Promise.all(
    LOCKFILES.map(async ([name, packageManager]) => {
      const path = join(projectDirectory, name);
      try {
        await access(path, constants.R_OK);
        return { name, path, packageManager } satisfies LockfileInfo;
      } catch {
        return undefined;
      }
    }),
  );

  return discovered.filter((lockfile): lockfile is LockfileInfo => lockfile !== undefined);
}

function packageManagerFromDeclaration(
  declaration: string | undefined,
): PackageManager | undefined {
  if (declaration === undefined) return undefined;
  const name = declaration.split('@', 1)[0];
  return name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun' ? name : 'unknown';
}

export function detectPackageManager(
  manifest: PackageManifest,
  lockfiles: LockfileInfo[],
): { packageManager: PackageManager; evidence: PackageManagerEvidence } {
  const declared = packageManagerFromDeclaration(manifest.packageManager);
  const lockfileManagers = [...new Set(lockfiles.map((lockfile) => lockfile.packageManager))];
  const conflicts = new Set<PackageManager>();

  if (declared !== undefined && declared !== 'unknown') {
    for (const manager of lockfileManagers) {
      if (manager !== declared) conflicts.add(manager);
    }
  } else if (declared === 'unknown') {
    lockfileManagers.forEach((manager) => conflicts.add(manager));
  } else if (lockfileManagers.length > 1) {
    lockfileManagers.forEach((manager) => conflicts.add(manager));
  }

  const packageManager: PackageManager =
    declared !== undefined && declared !== 'unknown'
      ? declared
      : lockfileManagers.length === 1 && lockfileManagers[0] !== undefined
        ? lockfileManagers[0]
        : 'unknown';

  return {
    packageManager,
    evidence: {
      ...(declared === undefined ? {} : { declared }),
      lockfiles: lockfileManagers,
      conflicts: [...conflicts],
    },
  };
}

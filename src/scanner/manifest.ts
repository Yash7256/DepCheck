import { readFile } from 'node:fs/promises';

import { createScannerError } from './errors.js';
import type { PackageManifest, WorkspaceConfiguration } from './types.js';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw createScannerError(`Invalid ${field} in package.json.`);
  return value;
}

function readOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw createScannerError(`Invalid ${field} in package.json.`);
  return value;
}

function readWorkspaces(value: unknown): WorkspaceConfiguration | undefined {
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === 'string')) {
      throw createScannerError('Invalid workspaces in package.json.');
    }
    return { packages: [...value] };
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const packages = Reflect.get(value, 'packages');
    if (!Array.isArray(packages) || !packages.every((entry) => typeof entry === 'string')) {
      throw createScannerError('Invalid workspaces.packages in package.json.');
    }
    return { packages: [...packages] };
  }

  throw createScannerError('Invalid workspaces in package.json.');
}

export function parseManifest(content: string, manifestPath: string): PackageManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw createScannerError(`Malformed JSON in package manifest: ${manifestPath}`, error);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw createScannerError(`Package manifest must contain a JSON object: ${manifestPath}`);
  }

  const source = parsed as Record<string, unknown>;
  const dependencyDeclarations = Object.fromEntries(
    DEPENDENCY_FIELDS.map((field) => {
      const value = source[field];
      if (value === undefined) return [field, {}];
      if (!isStringRecord(value)) {
        throw createScannerError(`Invalid ${field} in package.json: ${manifestPath}`);
      }
      return [field, value];
    }),
  ) as Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>;

  const name = readOptionalString(source.name, 'name');
  const version = readOptionalString(source.version, 'version');
  const privateField = readOptionalBoolean(source.private, 'private');
  const packageManager = readOptionalString(source.packageManager, 'packageManager');
  const scripts = source.scripts === undefined ? undefined : source.scripts;
  if (scripts !== undefined && !isStringRecord(scripts)) {
    throw createScannerError(`Invalid scripts in package.json: ${manifestPath}`);
  }
  const workspaces = readWorkspaces(source.workspaces);

  return {
    path: manifestPath,
    ...(name === undefined ? {} : { name }),
    ...(version === undefined ? {} : { version }),
    ...(privateField === undefined ? {} : { private: privateField }),
    ...(scripts === undefined ? {} : { scripts }),
    dependencies: dependencyDeclarations.dependencies,
    devDependencies: dependencyDeclarations.devDependencies,
    peerDependencies: dependencyDeclarations.peerDependencies,
    optionalDependencies: dependencyDeclarations.optionalDependencies,
    ...(workspaces === undefined ? {} : { workspaces }),
    ...(packageManager === undefined ? {} : { packageManager }),
  };
}

export async function readManifest(manifestPath: string): Promise<PackageManifest> {
  let content: string;

  try {
    content = await readFile(manifestPath, 'utf8');
  } catch (error) {
    throw createScannerError(`Unable to read package manifest: ${manifestPath}`, error);
  }

  return parseManifest(content, manifestPath);
}

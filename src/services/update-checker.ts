import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

import { isNewerVersion, isStableVersion } from '../utils/version-comparator.js';

const PACKAGE_NAME = 'depcheck-audit-cli';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 1_500;

interface UpdateCache {
  checkedAt: number;
  latestVersion: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
}

export interface UpdateCheckerOptions {
  cachePath?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
  readFile?: typeof readFile;
  writeFile?: typeof writeFile;
  mkdir?: typeof mkdir;
}

function defaultCachePath(): string {
  const home = homedir();
  if (platform() === 'win32')
    return join(
      process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'),
      'depcheck',
      'update.json',
    );
  if (platform() === 'darwin') return join(home, 'Library', 'Caches', 'depcheck', 'update.json');
  return join(process.env.XDG_CACHE_HOME ?? join(home, '.cache'), 'depcheck', 'update.json');
}

export function isUpdateNotificationDisabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.DEPCHECK_NO_UPDATE_NOTIFIER === '1' || environment.NO_UPDATE_NOTIFIER === '1';
}

async function readFreshCache(
  path: string,
  now: () => number,
  read: typeof readFile,
): Promise<string | undefined> {
  try {
    const cache = JSON.parse(await read(path, 'utf8')) as Partial<UpdateCache>;
    if (
      typeof cache.checkedAt !== 'number' ||
      typeof cache.latestVersion !== 'string' ||
      now() - cache.checkedAt < 0 ||
      now() - cache.checkedAt >= CACHE_TTL_MS ||
      !isStableVersion(cache.latestVersion)
    )
      return undefined;
    return cache.latestVersion;
  } catch {
    return undefined;
  }
}

async function fetchLatestVersion(
  fetchFunction: typeof globalThis.fetch,
  timeoutMs: number,
): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();
  try {
    const response = await fetchFunction(REGISTRY_URL, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
    const distTags = Reflect.get(body, 'dist-tags');
    const latest =
      typeof distTags === 'object' && distTags !== null
        ? Reflect.get(distTags, 'latest')
        : undefined;
    return typeof latest === 'string' && isStableVersion(latest) ? latest : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate(
  currentVersion: string,
  options: UpdateCheckerOptions = {},
): Promise<UpdateCheckResult> {
  const now = options.now ?? Date.now;
  const cachePath = options.cachePath ?? defaultCachePath();
  const read = options.readFile ?? readFile;
  const write = options.writeFile ?? writeFile;
  const makeDirectory = options.mkdir ?? mkdir;
  const cachedVersion = await readFreshCache(cachePath, now, read);
  const latestVersion =
    cachedVersion ??
    (await fetchLatestVersion(
      options.fetch ?? globalThis.fetch,
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ));

  if (cachedVersion === undefined && latestVersion !== undefined) {
    await makeDirectory(dirname(cachePath), { recursive: true })
      .then(() => write(cachePath, JSON.stringify({ checkedAt: now(), latestVersion }), 'utf8'))
      .catch(() => undefined);
  }

  return {
    currentVersion,
    ...(latestVersion === undefined ? {} : { latestVersion }),
    updateAvailable: latestVersion !== undefined && isNewerVersion(currentVersion, latestVersion),
  };
}

export function formatUpdateNotification(result: UpdateCheckResult): string {
  if (!result.updateAvailable || result.latestVersion === undefined) return '';
  return [
    `DepCheck v${result.currentVersion}`,
    '',
    `⚠ Update available: v${result.latestVersion}`,
    '',
    'You are using an older version of DepCheck.',
    '',
    'Update using:',
    'npm install -g depcheck-audit-cli',
    '',
  ].join('\n');
}

export { CACHE_TTL_MS, DEFAULT_TIMEOUT_MS, REGISTRY_URL };

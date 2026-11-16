import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CACHE_TTL_MS,
  checkForUpdate,
  formatUpdateNotification,
  isUpdateNotificationDisabled,
} from '../src/services/update-checker.js';
import { isNewerVersion, isStableVersion } from '../src/utils/version-comparator.js';

const temporaryDirectories: string[] = [];

async function cachePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'depcheck-update-'));
  temporaryDirectories.push(directory);
  return join(directory, 'cache', 'update.json');
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('version comparison', () => {
  it('detects only newer semantic versions', () => {
    expect(isNewerVersion('0.1.1', '0.1.2')).toBe(true);
    expect(isNewerVersion('0.1.2', '0.1.1')).toBe(false);
    expect(isNewerVersion('0.1.1', '0.1.1')).toBe(false);
    expect(isNewerVersion('invalid', '0.1.2')).toBe(false);
  });

  it('recognizes stable and prerelease versions', () => {
    expect(isStableVersion('1.0.0')).toBe(true);
    expect(isStableVersion('1.0.0-beta.1')).toBe(false);
    expect(isStableVersion('invalid')).toBe(false);
  });
});

describe('update checker', () => {
  it('does not notify when the installed version is current or newer', async () => {
    const path = await cachePath();
    const fetch = async () => response({ 'dist-tags': { latest: '0.1.1' } });

    expect((await checkForUpdate('0.1.1', { cachePath: path, fetch })).updateAvailable).toBe(false);
    expect(
      (await checkForUpdate('0.1.2', { cachePath: await cachePath(), fetch })).updateAvailable,
    ).toBe(false);
  });

  it('reports a newer stable release and formats the notification', async () => {
    const result = await checkForUpdate('0.1.1', {
      cachePath: await cachePath(),
      fetch: async () => response({ 'dist-tags': { latest: '0.1.2' } }),
    });

    expect(result.updateAvailable).toBe(true);
    expect(formatUpdateNotification(result)).toContain('npm install -g depcheck-audit-cli');
  });

  it('silently handles unavailable, timed-out, and invalid registry responses', async () => {
    const unavailable = await checkForUpdate('0.1.1', {
      cachePath: await cachePath(),
      fetch: async () => {
        throw new Error('offline');
      },
    });
    expect(unavailable.updateAvailable).toBe(false);

    const timedOut = await checkForUpdate('0.1.1', {
      cachePath: await cachePath(),
      timeoutMs: 5,
      fetch: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });
    expect(timedOut.updateAvailable).toBe(false);

    const invalid = await checkForUpdate('0.1.1', {
      cachePath: await cachePath(),
      fetch: async () => response({ versions: {} }),
    });
    expect(invalid.updateAvailable).toBe(false);
  });

  it('reuses fresh cache and refreshes expired cache', async () => {
    const path = await cachePath();
    let calls = 0;
    let now = 1_000;
    const fetch = async () => {
      calls += 1;
      return response({ 'dist-tags': { latest: '0.1.2' } });
    };

    await checkForUpdate('0.1.1', { cachePath: path, fetch, now: () => now });
    await checkForUpdate('0.1.1', { cachePath: path, fetch, now: () => now + 1 });
    expect(calls).toBe(1);

    now += CACHE_TTL_MS + 1;
    await checkForUpdate('0.1.1', { cachePath: path, fetch, now: () => now });
    expect(calls).toBe(2);
  });

  it('accepts a stable release over an installed prerelease', async () => {
    const result = await checkForUpdate('0.1.2-beta.1', {
      cachePath: await cachePath(),
      fetch: async () => response({ 'dist-tags': { latest: '0.1.2' } }),
    });

    expect(result.updateAvailable).toBe(true);
  });

  it('supports both opt-out environment variables', () => {
    expect(isUpdateNotificationDisabled({ DEPCHECK_NO_UPDATE_NOTIFIER: '1' })).toBe(true);
    expect(isUpdateNotificationDisabled({ NO_UPDATE_NOTIFIER: '1' })).toBe(true);
    expect(isUpdateNotificationDisabled({ DEPCHECK_NO_UPDATE_NOTIFIER: '0' })).toBe(false);
  });
});

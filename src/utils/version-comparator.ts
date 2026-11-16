import semver from 'semver';

export function isNewerVersion(currentVersion: string, candidateVersion: string): boolean {
  const current = semver.valid(currentVersion);
  const candidate = semver.valid(candidateVersion);
  if (current === null || candidate === null) return false;
  return semver.gt(candidate, current);
}

export function isStableVersion(version: string): boolean {
  return semver.valid(version) !== null && semver.prerelease(version) === null;
}

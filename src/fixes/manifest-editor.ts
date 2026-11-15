import { readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { FixProposal } from './types.js';

export interface ManifestSnapshot {
  path: string;
  hash: string;
  content: string;
}
export async function readManifestSnapshot(path: string): Promise<ManifestSnapshot> {
  const content = await readFile(path, 'utf8');
  return { path, content, hash: createHash('sha256').update(content).digest('hex') };
}
export async function applyManifestProposals(
  proposals: FixProposal[],
): Promise<{ applied: FixProposal[]; failed: Array<{ proposal: FixProposal; error: string }> }> {
  const groups = new Map<string, FixProposal[]>();
  for (const proposal of proposals)
    groups.set(proposal.manifestPath, [...(groups.get(proposal.manifestPath) ?? []), proposal]);
  const applied: FixProposal[] = [];
  const failed: Array<{ proposal: FixProposal; error: string }> = [];
  for (const [path, pathProposals] of groups) {
    try {
      const snapshot = await readManifestSnapshot(path);
      const json: unknown = JSON.parse(snapshot.content);
      if (typeof json !== 'object' || json === null || Array.isArray(json))
        throw new Error('Manifest must contain an object');
      const manifest = json as Record<string, unknown>;
      for (const proposal of pathProposals) {
        const section = manifest[proposal.section];
        if (typeof section !== 'object' || section === null || Array.isArray(section))
          throw new Error(`Invalid dependency section: ${proposal.section}`);
        const dependencies = section as Record<string, unknown>;
        if (proposal.kind === 'remove') delete dependencies[proposal.packageName];
        else if (proposal.to !== undefined) dependencies[proposal.packageName] = proposal.to;
      }
      const current = await readFile(path, 'utf8');
      if (createHash('sha256').update(current).digest('hex') !== snapshot.hash)
        throw new Error('Concurrent modification detected');
      const temporary = `${path}.depcheck.tmp`;
      await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      await rename(temporary, path);
      applied.push(...pathProposals);
    } catch (error) {
      for (const proposal of pathProposals) failed.push({ proposal, error: String(error) });
    }
  }
  return { applied, failed };
}

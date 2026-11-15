import type { DependencyResolutionResult, ResolvedReference } from '../resolver/types.js';
import type { Finding } from './types.js';

function evidenceFor(references: ResolvedReference[]): string[] {
  return references.map(
    (reference) => `${reference.filePath}:${reference.line}:${reference.column}`,
  );
}

export function analyzeMissingDependencies(resolution: DependencyResolutionResult): Finding[] {
  const referencesByDependency = new Map<string, ResolvedReference[]>();

  for (const reference of resolution.references) {
    if (reference.classification !== 'undeclared' || reference.packageName === null) continue;
    const key = `${reference.manifestPath}:${reference.packageName}`;
    const references = referencesByDependency.get(key) ?? [];
    references.push(reference);
    referencesByDependency.set(key, references);
  }

  const findings: Finding[] = [];
  for (const [, references] of referencesByDependency.entries()) {
    const first = references[0];
    if (first === undefined || first.packageName === null) continue;
    findings.push({
      id: `MISSING_DEPENDENCY:${first.workspace?.path ?? 'root'}:${first.packageName}`,
      code: 'MISSING_DEPENDENCY',
      analyzer: 'missing',
      packageName: first.packageName,
      severity: 'error',
      confidence: 'high',
      message: `${first.packageName} is imported but is not declared by the owning package manifest.`,
      manifestPath: first.manifestPath,
      filePath: first.filePath,
      line: first.line,
      column: first.column,
      details: {
        referenceCount: references.length,
        evidence: evidenceFor(references),
        workspace: first.workspace?.name ?? null,
      },
    });
  }
  return findings;
}

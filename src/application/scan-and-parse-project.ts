import { parseProjectSourceFiles } from '../parser/parse-project.js';
import type { ParseProjectResult } from '../parser/types.js';
import { resolveDependencies } from '../resolver/index.js';
import type { DependencyResolutionResult } from '../resolver/types.js';
import { scanProject } from '../scanner/scan.js';
import type { ProjectScanResult } from '../scanner/types.js';

export interface ScanAndParseProjectResult {
  scan: ProjectScanResult;
  parse: ParseProjectResult;
  resolve: DependencyResolutionResult;
}

export async function scanAndParseProject(
  projectDirectory: string,
): Promise<ScanAndParseProjectResult> {
  const scan = await scanProject(projectDirectory);
  const parse = await parseProjectSourceFiles(scan.sourceFiles);
  const resolve = await resolveDependencies(scan, parse.references);
  return { scan, parse, resolve };
}

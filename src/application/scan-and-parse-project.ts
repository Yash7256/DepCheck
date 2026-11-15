import { parseProjectSourceFiles } from '../parser/parse-project.js';
import type { ParseProjectResult } from '../parser/types.js';
import { scanProject } from '../scanner/scan.js';
import type { ProjectScanResult } from '../scanner/types.js';

export interface ScanAndParseProjectResult {
  scan: ProjectScanResult;
  parse: ParseProjectResult;
}

export async function scanAndParseProject(
  projectDirectory: string,
): Promise<ScanAndParseProjectResult> {
  const scan = await scanProject(projectDirectory);
  const parse = await parseProjectSourceFiles(scan.sourceFiles);
  return { scan, parse };
}

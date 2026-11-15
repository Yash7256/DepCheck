import { parseProjectSourceFiles } from '../parser/parse-project.js';
import type { ParseProjectResult } from '../parser/types.js';
import { auditProject } from './audit-project.js';
import type { AuditResult } from '../analyzers/types.js';
import { resolveDependencies } from '../resolver/index.js';
import type { DependencyResolutionResult } from '../resolver/types.js';
import { scanProject } from '../scanner/scan.js';
import type { ProjectScanResult } from '../scanner/types.js';

export interface ScanAndParseProjectResult {
  scan: ProjectScanResult;
  parse: ParseProjectResult;
  resolve: DependencyResolutionResult;
  audit: AuditResult;
}

export interface ScanAndParseOptions {
  skipSecurity?: boolean;
  offlineSecurity?: boolean;
}

export async function scanAndParseProject(
  projectDirectory: string,
  options: ScanAndParseOptions = {},
): Promise<ScanAndParseProjectResult> {
  const scan = await scanProject(projectDirectory);
  const parse = await parseProjectSourceFiles(scan.sourceFiles);
  const resolve = await resolveDependencies(scan, parse.references);
  const audit = await auditProject(scan, parse, resolve, undefined, options);
  return { scan, parse, resolve, audit };
}

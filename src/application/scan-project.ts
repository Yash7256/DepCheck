import { scanProject } from '../scanner/scan.js';
import type { ProjectScanResult } from '../scanner/types.js';

export async function scanProjectUseCase(projectDirectory: string): Promise<ProjectScanResult> {
  return scanProject(projectDirectory);
}

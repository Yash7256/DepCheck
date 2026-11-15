import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export async function writeReport(
  outputPath: string,
  content: string,
  projectRoot: string,
): Promise<string> {
  const resolved = resolve(projectRoot, outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, content, 'utf8');
  return resolved;
}

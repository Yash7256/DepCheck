import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const project = await mkdtemp(join(tmpdir(), 'depcheck-e2e-'));

function runCli(cli, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], options);
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

try {
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ name: 'e2e-fixture', dependencies: {} }),
    'utf8',
  );
  await writeFile(join(project, 'index.ts'), "import fs from 'node:fs';\n", 'utf8');
  const cli = join(root, 'dist', 'index.js');
  const help = await runCli(cli, ['--help'], { cwd: root, stdio: 'inherit' });
  if (help.code !== 0) throw new Error(`help command failed with ${help.code}`);
  const version = await runCli(cli, ['--version'], { cwd: root, stdio: 'inherit' });
  if (version.code !== 0) throw new Error(`version command failed with ${version.code}`);
  const reportPath = join(project, 'report.json');
  const scan = await runCli(cli, ['scan', '--format', 'json', '--output', reportPath, project], {
    cwd: root,
    stdio: 'inherit',
  });
  if (![0, 1, 4].includes(scan.code)) throw new Error(`scan command failed with ${scan.code}`);
  JSON.parse(await readFile(reportPath, 'utf8'));
  console.log('E2E CLI checks passed.');
} finally {
  await rm(project, { recursive: true, force: true });
}

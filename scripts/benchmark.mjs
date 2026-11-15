import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = await mkdtemp(join(tmpdir(), 'depcheck-benchmark-'));

function runCli(cli, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args], options);
    child.once('error', reject);
    child.once('close', (code) => resolvePromise(code ?? 1));
  });
}

try {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await mkdir(join(project, 'src'), { recursive: true });
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ name: 'benchmark-fixture' }),
    'utf8',
  );
  for (let index = 0; index < 1000; index += 1)
    await writeFile(
      join(project, 'src', `file-${index}.ts`),
      "import fs from 'node:fs';\nexport default fs;\n",
    );
  const reportPath = join(project, 'report.json');
  const start = performance.now();
  const code = await runCli(
    join(root, 'dist', 'index.js'),
    ['scan', '--no-security', '--format', 'json', '--output', reportPath, project],
    { cwd: root, stdio: 'ignore' },
  );
  const elapsedMs = performance.now() - start;
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  console.log(
    JSON.stringify(
      {
        files: 1000,
        findings: report.summary.total,
        exitCode: code,
        elapsedMs: Math.round(elapsedMs),
      },
      null,
      2,
    ),
  );
} finally {
  await rm(project, { recursive: true, force: true });
}

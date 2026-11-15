import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AuditResult } from '../src/analyzers/types.js';
import { HtmlReporter } from '../src/reporters/html/html.reporter.js';
import { JsonReporter } from '../src/reporters/json/json.reporter.js';
import { writeReport } from '../src/reporters/output-manager.js';
import { TerminalReporter } from '../src/reporters/terminal/terminal.reporter.js';

const result: AuditResult = {
  projectRoot: '/tmp/project',
  projectName: 'fixture',
  filesParsed: 3,
  findings: [
    {
      id: 'x',
      code: 'SECURITY_VULNERABILITY',
      analyzer: 'security',
      packageName: '<script>alert(1)</script>',
      severity: 'error',
      confidence: 'high',
      message: '<img src=x>',
      manifestPath: '/tmp/project/package.json',
      details: { vulnerabilityId: 'OSV-1' },
    },
  ],
  diagnostics: [{ code: 'OFFLINE', message: 'Provider unavailable', severity: 'error' }],
  summary: { unused: 0, missing: 0, duplicates: 0, outdated: 0, security: 1, total: 1 },
  incomplete: true,
  analyzerStatus: { security: 'incomplete' },
};

describe('reporters', () => {
  it('generates terminal output with findings and diagnostics', async () => {
    const output = await new TerminalReporter().generate(result);
    expect(output).toContain('Dependency Health Report');
    expect(output).toContain('SECURITY');
    expect(output).toContain('DIAGNOSTICS');
  });

  it('generates valid JSON without ANSI codes or undefined values', async () => {
    const output = await new JsonReporter().generate(result);
    expect(JSON.parse(output)).toMatchObject({
      tool: { name: 'DepCheck' },
      status: 'incomplete',
      summary: { totalFindings: 1 },
    });
    expect(output).not.toContain('\u001b');
    expect(output).not.toContain('undefined');
  });

  it('generates escaped self-contained HTML', async () => {
    const output = await new HtmlReporter().generate(result);
    expect(output).toContain('<!doctype html>');
    expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(output).not.toContain('<script>alert(1)</script>');
    expect(output).not.toContain('https://cdn');
    expect(output).toContain('@media');
  });

  it('writes UTF-8 reports to relative output paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'depcheck-report-'));
    try {
      const path = await writeReport('reports/report.json', 'héllo', directory);
      expect(await readFile(path, 'utf8')).toBe('héllo');
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});

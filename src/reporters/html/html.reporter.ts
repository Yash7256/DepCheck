import type { AuditResult } from '../../analyzers/types.js';
import type { Reporter } from '../interfaces/reporter.interface.js';
import { normalizeReport } from '../shared/report.utils.js';
import { escapeHtml } from './html.escape.js';

export class HtmlReporter implements Reporter {
  async generate(result: AuditResult): Promise<string> {
    const report = normalizeReport(result);
    const findings = report.findings
      .map(
        (finding) =>
          `<article class="finding"><h3>${escapeHtml(finding.packageName)}</h3><p><strong>${escapeHtml(finding.code)}</strong> · ${escapeHtml(finding.severity)} · ${escapeHtml(finding.confidence)}</p><p>${escapeHtml(finding.message)}</p><small>${escapeHtml(finding.filePath ?? finding.manifestPath)}</small><pre>${escapeHtml(JSON.stringify(finding.details ?? {}, null, 2))}</pre></article>`,
      )
      .join('');
    const diagnostics = report.diagnostics
      .map(
        (diagnostic) =>
          `<li><strong>${escapeHtml(diagnostic.code)}</strong>: ${escapeHtml(diagnostic.message)}</li>`,
      )
      .join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DepCheck report</title><style>${styles}</style></head><body><main><header><p class="eyebrow">DEPCHECK</p><h1>Dependency Health Report</h1><p>${escapeHtml(report.project.name ?? report.project.root)}</p><p>Status: <strong>${escapeHtml(report.status)}</strong> · Generated ${escapeHtml(report.generatedAt)}</p></header><section class="cards">${card('Total findings', report.summary.totalFindings)}${card('Unused', report.summary.unused)}${card('Missing', report.summary.missing)}${card('Duplicates', report.summary.duplicates)}${card('Outdated', report.summary.outdated ?? 0)}${card('Security', report.summary.security ?? 0)}</section><section><h2>Findings</h2>${findings || '<p>No findings.</p>'}</section><section><h2>Diagnostics</h2>${diagnostics ? `<ul>${diagnostics}</ul>` : '<p>No diagnostics.</p>'}</section><footer>DepCheck ${escapeHtml(report.tool.version)} · ${escapeHtml(report.generatedAt)}</footer></main></body></html>`;
  }
}

function card(label: string, value: number): string {
  return `<div class="card"><span>${label}</span><strong>${value}</strong></div>`;
}
const styles = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17202a;background:#f5f7fa}*{box-sizing:border-box}body{margin:0}main{max-width:1100px;margin:0 auto;padding:40px 20px}header{background:#17202a;color:#fff;border-radius:16px;padding:28px;margin-bottom:20px}.eyebrow{letter-spacing:.16em;font-size:12px;color:#9fd3c7}h1{margin:8px 0;font-size:clamp(28px,5vw,48px)}h2{margin-top:32px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.card,.finding{background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:16px}.card span{display:block;color:#667085;font-size:13px}.card strong{display:block;font-size:28px;margin-top:8px}.finding{margin:10px 0}.finding h3{margin:0 0 8px}.finding p{margin:6px 0}footer{margin-top:36px;color:#667085;font-size:13px}@media(max-width:600px){main{padding:20px 12px}}`;

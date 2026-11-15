import type { AuditResult } from '../analyzers/types.js';
import { HtmlReporter } from './html/html.reporter.js';
import { JsonReporter } from './json/json.reporter.js';
import { TerminalReporter } from './terminal/terminal.reporter.js';
import type { ReportFormat, ReportOptions } from './shared/report.types.js';

export function createReporter(format: ReportFormat, options: ReportOptions) {
  if (format === 'json') return new JsonReporter();
  if (format === 'html') return new HtmlReporter();
  return new TerminalReporter(options);
}

export async function renderReport(
  result: AuditResult,
  format: ReportFormat,
  options: ReportOptions,
): Promise<string> {
  return createReporter(format, options).generate(result);
}

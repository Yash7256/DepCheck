import type { AuditResult } from '../../analyzers/types.js';
import type { Reporter } from '../interfaces/reporter.interface.js';
import { normalizeReport } from '../shared/report.utils.js';

export class JsonReporter implements Reporter {
  async generate(result: AuditResult): Promise<string> {
    return `${JSON.stringify(normalizeReport(result), null, 2)}\n`;
  }
}

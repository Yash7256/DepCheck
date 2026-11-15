import type { AuditResult } from '../../analyzers/types.js';

export interface Reporter {
  generate(result: AuditResult): Promise<string>;
}

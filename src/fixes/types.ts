import type { Finding } from '../analyzers/types.js';

export type FixKind = 'remove' | 'update';
export interface FixProposal {
  id: string;
  kind: FixKind;
  packageName: string;
  manifestPath: string;
  section: string;
  from: string;
  to?: string;
  reason: string;
  risky: boolean;
  finding: Finding;
}
export interface FixResult {
  proposals: FixProposal[];
  applied: FixProposal[];
  failed: Array<{ proposal: FixProposal; error: string }>;
  validation: { valid: boolean; message: string };
}

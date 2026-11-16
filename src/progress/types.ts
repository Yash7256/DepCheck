export interface ProgressReporter {
  start(message: string): void;
  update(message: string): void;
  complete(message?: string): void;
  fail(message: string): void;
  stop(): void;
}

export type AnalyzerProgress = (completed: number, total: number) => void;

export const NOOP_PROGRESS: ProgressReporter = {
  start: () => undefined,
  update: () => undefined,
  complete: () => undefined,
  fail: () => undefined,
  stop: () => undefined,
};

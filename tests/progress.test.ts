import { describe, expect, it } from 'vitest';

import { createProgressReporter } from '../src/cli/progress.js';

class TestStream {
  content = '';
  readonly isTTY: boolean;

  constructor(isTTY = false) {
    this.isTTY = isTTY;
  }

  write(chunk: string): boolean {
    this.content += chunk;
    return true;
  }
}

describe('progress reporter', () => {
  it('renders a live spinner and completion line for interactive terminals', () => {
    const stream = new TestStream(true);
    const reporter = createProgressReporter({ stream, now: () => 0 });

    reporter.start('Analyzing dependencies');
    reporter.update('Checked 1/2 packages');
    reporter.complete('Done');
    reporter.stop();

    expect(stream.content).toContain('Analyzing dependencies');
    expect(stream.content).toContain('Done');
    expect(stream.content).toContain('\r');
  });

  it('writes phase and update lines for non-interactive terminals', () => {
    const stream = new TestStream(false);
    let time = 0;
    const reporter = createProgressReporter({
      stream,
      now: () => time,
      nonTtyUpdateIntervalMs: 0,
    });

    reporter.start('Analyzing dependencies');
    time = 1000;
    reporter.update('Checked 1/2 packages');
    reporter.complete();
    reporter.stop();

    expect(stream.content).toContain('Progress: Analyzing dependencies');
    expect(stream.content).toContain('Checked 1/2 packages');
  });

  it('stays silent when disabled or quiet', () => {
    const disabled = new TestStream();
    const quiet = new TestStream();

    createProgressReporter({ stream: disabled, enabled: false }).start('Working');
    createProgressReporter({ stream: quiet, quiet: true }).start('Working');

    expect(disabled.content).toBe('');
    expect(quiet.content).toBe('');
  });
});

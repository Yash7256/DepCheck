import type { ProgressReporter } from '../progress/types.js';
import { NOOP_PROGRESS } from '../progress/types.js';
import type { CliGlobalOptions, CliStreams, OutputStream } from './types.js';

const SPINNER_FRAMES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const TTY_FRAME_INTERVAL_MS = 80;
const NON_TTY_UPDATE_INTERVAL_MS = 2000;
const CLEAR_LINE = '\r\x1b[2K';

export interface ProgressReporterOptions {
  stream: OutputStream;
  enabled?: boolean;
  quiet?: boolean;
  intervalMs?: number;
  nonTtyUpdateIntervalMs?: number;
  now?: () => number;
}

function formatElapsed(milliseconds: number): string {
  if (milliseconds < 10_000) return `${(milliseconds / 1000).toFixed(1)}s`;
  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function createProgressReporter(options: ProgressReporterOptions): ProgressReporter {
  if (options.enabled === false || options.quiet === true) return NOOP_PROGRESS;

  const stream = options.stream;
  const now = options.now ?? Date.now;
  const interactive = (stream as OutputStream & { isTTY?: boolean }).isTTY === true;
  const intervalMs = options.intervalMs ?? TTY_FRAME_INTERVAL_MS;
  const nonTtyUpdateIntervalMs = options.nonTtyUpdateIntervalMs ?? NON_TTY_UPDATE_INTERVAL_MS;
  let active = false;
  let label = '';
  let detail: string | undefined;
  let startedAt = 0;
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastNonTtyUpdate = 0;

  const elapsed = (): string => formatElapsed(now() - startedAt);

  const line = (): string => {
    const suffix = detail === undefined ? '' : ` ${detail}`;
    const spinner = SPINNER_FRAMES.charAt(frame % SPINNER_FRAMES.length);
    return `${spinner} ${label}${suffix} (${elapsed()})`;
  };

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  const finish = (symbol: string, message: string): void => {
    if (!active) return;
    clearTimer();
    const duration = elapsed();
    if (interactive) stream.write(`${CLEAR_LINE}${symbol} ${message} (${duration})\n`);
    else stream.write(`Progress: ${message}\n`);
    active = false;
    detail = undefined;
  };

  return {
    start(message) {
      if (active) finish('✔', label);
      label = message;
      detail = undefined;
      startedAt = now();
      frame = 0;
      active = true;
      if (interactive) {
        stream.write(line());
        timer = setInterval(() => {
          frame += 1;
          stream.write(`${CLEAR_LINE}${line()}`);
        }, intervalMs);
        timer.unref();
      } else {
        stream.write(`Progress: ${message}\n`);
        lastNonTtyUpdate = startedAt;
      }
    },
    update(message) {
      if (!active) return;
      detail = message;
      if (interactive) return;
      const current = now();
      if (current - lastNonTtyUpdate < nonTtyUpdateIntervalMs) return;
      lastNonTtyUpdate = current;
      stream.write(`Progress: ${label} ${message} (${elapsed()})\n`);
    },
    complete(message) {
      finish('✔', message ?? label);
    },
    fail(message) {
      finish('✖', message);
    },
    stop() {
      clearTimer();
      if (active && interactive) stream.write(CLEAR_LINE);
      active = false;
      detail = undefined;
    },
  };
}

export function createCliProgress(
  options: CliGlobalOptions,
  streams: CliStreams,
): ProgressReporter {
  return createProgressReporter({
    stream: streams.stderr,
    enabled: options.progress !== false,
    quiet: options.quiet === true,
  });
}

export async function withProgress<T>(
  reporter: ProgressReporter,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } finally {
    reporter.stop();
  }
}

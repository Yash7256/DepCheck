import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { CliError } from '../cli/errors.js';
import { DEFAULT_CONFIG, type DepcheckConfig } from './types.js';

const schema = z
  .object({
    version: z.literal(1).default(1),
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
    analyzers: z
      .object({
        unused: z.boolean().default(true),
        missing: z.boolean().default(true),
        duplicates: z.boolean().default(true),
        outdated: z.boolean().default(true),
        security: z.boolean().default(true),
      })
      .strict()
      .default(DEFAULT_CONFIG.analyzers),
    rules: z
      .object({
        ignoredDependencies: z.array(z.string()).default([]),
        ignoredFindings: z
          .array(
            z
              .object({
                code: z.string(),
                packageName: z.string().optional(),
                reason: z.string().min(1),
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default(DEFAULT_CONFIG.rules),
    security: z
      .object({
        minimumSeverity: z.enum(['critical', 'high', 'moderate', 'low', 'unknown']).default('low'),
      })
      .strict()
      .default(DEFAULT_CONFIG.security),
    reporting: z
      .object({ format: z.enum(['terminal', 'json', 'html']).default('terminal') })
      .strict()
      .default(DEFAULT_CONFIG.reporting),
    fix: z
      .object({
        allowMajorUpdates: z.boolean().default(false),
        removeUnusedDependencies: z.boolean().default(false),
      })
      .strict()
      .default(DEFAULT_CONFIG.fix),
  })
  .strict();

function mergeConfig(input: z.infer<typeof schema>): DepcheckConfig {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    analyzers: { ...DEFAULT_CONFIG.analyzers, ...input.analyzers },
    rules: {
      ...DEFAULT_CONFIG.rules,
      ignoredDependencies: input.rules.ignoredDependencies,
      ignoredFindings: input.rules.ignoredFindings.map((item) =>
        item.packageName === undefined ? { code: item.code, reason: item.reason } : item,
      ),
    },
    security: { ...DEFAULT_CONFIG.security, ...input.security },
    reporting: { ...DEFAULT_CONFIG.reporting, ...input.reporting },
    fix: { ...DEFAULT_CONFIG.fix, ...input.fix },
  };
}

export async function loadConfig(
  projectRoot: string,
  explicitPath?: string,
): Promise<{ config: DepcheckConfig; path?: string }> {
  const path = resolve(projectRoot, explicitPath ?? 'depcheck.config.json');
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if (explicitPath !== undefined)
      throw new CliError(`Unable to read configuration: ${path}`, 3, { cause: error });
    return { config: DEFAULT_CONFIG };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new CliError(`Invalid JSON in configuration: ${path}`, 2, { cause: error });
  }
  const checked = schema.safeParse(parsed);
  if (!checked.success)
    throw new CliError(`Invalid configuration ${path}: ${checked.error.message}`, 2);
  return { config: mergeConfig(checked.data), path };
}

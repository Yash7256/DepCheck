import type { DepcheckConfig } from './types.js';

export interface CliConfigOverrides {
  format?: DepcheckConfig['reporting']['format'];
  ignore?: string[];
  exclude?: string[];
}

export function mergeCliConfig(
  config: DepcheckConfig,
  overrides: CliConfigOverrides,
): DepcheckConfig {
  return {
    ...config,
    reporting: {
      ...config.reporting,
      ...(overrides.format === undefined ? {} : { format: overrides.format }),
    },
    rules: {
      ...config.rules,
      ignoredDependencies: [...config.rules.ignoredDependencies, ...(overrides.ignore ?? [])],
    },
    exclude: [...config.exclude, ...(overrides.exclude ?? [])],
  };
}

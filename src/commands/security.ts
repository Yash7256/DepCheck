import { Option, type Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { getGlobalOptions } from '../cli/options.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import type { CliStreams } from '../cli/types.js';

export function registerSecurityCommand(program: Command, streams: CliStreams): void {
  program
    .command('security [path]')
    .description('Audit project dependencies for known security issues.')
    .addOption(
      new Option('--severity <level>', 'minimum severity to display')
        .choices(['critical', 'high', 'moderate', 'low', 'unknown'])
        .default('unknown'),
    )
    .option('--offline', 'do not query OSV')
    .action(
      async (path: string | undefined, _options: Record<string, unknown>, command: Command) => {
        const global = getGlobalOptions(command);
        const output = createTerminalOutput(global, streams);
        const commandOptions = command.opts() as { offline?: boolean };
        const result = await scanAndParseProject(resolveProjectDirectory(path, global.cwd), {
          ...(commandOptions.offline === undefined
            ? {}
            : { offlineSecurity: commandOptions.offline }),
        });
        for (const finding of result.audit.findings.filter(
          (item) => item.code === 'SECURITY_VULNERABILITY',
        ))
          output.info(`${finding.packageName}: ${finding.message}`);
        output.info(`Security findings: ${result.audit.summary.security ?? 0}`);
      },
    );
}

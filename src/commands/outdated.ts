import { Option, type Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { getGlobalOptions } from '../cli/options.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import type { CliStreams } from '../cli/types.js';

export function registerOutdatedCommand(program: Command, streams: CliStreams): void {
  program
    .command('outdated [path]')
    .description('Find outdated project dependencies.')
    .option('--include-prerelease', 'include prerelease versions')
    .addOption(
      new Option('--depth <depth>', 'dependency depth: direct or all')
        .choices(['direct', 'all'])
        .default('all'),
    )
    .action(
      async (path: string | undefined, _options: Record<string, unknown>, command: Command) => {
        const global = getGlobalOptions(command);
        const output = createTerminalOutput(global, streams);
        const result = await scanAndParseProject(resolveProjectDirectory(path, global.cwd));
        for (const finding of result.audit.findings.filter(
          (item) => item.code === 'OUTDATED_DEPENDENCY',
        ))
          output.info(`${finding.packageName}: ${JSON.stringify(finding.details)}`);
        output.info(`Outdated dependencies: ${result.audit.summary.outdated ?? 0}`);
      },
    );
}

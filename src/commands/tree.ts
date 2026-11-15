import { Option, type Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { getGlobalOptions } from '../cli/options.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import type { CliStreams } from '../cli/types.js';

export function registerTreeCommand(program: Command, streams: CliStreams): void {
  program
    .command('tree [path]')
    .description('Display resolved dependency-tree statistics.')
    .addOption(new Option('--depth <depth>', 'maximum display depth').default('all'))
    .action(
      async (path: string | undefined, _options: Record<string, unknown>, command: Command) => {
        const global = getGlobalOptions(command);
        const output = createTerminalOutput(global, streams);
        const result = await scanAndParseProject(resolveProjectDirectory(path, global.cwd));
        const tree = result.audit.summary.tree;
        if (tree === undefined) {
          output.error('Dependency tree analysis was not completed.');
          return;
        }
        output.info(`Resolved instances: ${tree.totalResolvedInstances}`);
        output.info(`Unique packages: ${tree.uniquePackageNames}`);
        output.info(`Unique versions: ${tree.uniquePackageVersions}`);
        output.info(`Maximum depth: ${tree.maximumDepth}`);
      },
    );
}

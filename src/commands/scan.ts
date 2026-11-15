import type { Command } from 'commander';

import { scanProjectUseCase } from '../application/scan-project.js';
import { getGlobalOptions } from '../cli/options.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import type { CliStreams } from '../cli/types.js';

export function registerScanCommand(program: Command, streams: CliStreams): void {
  program
    .command('scan [path]')
    .description('Scan a JavaScript or TypeScript project for dependency issues.')
    .option('--json', 'reserved for machine-readable scan output')
    .option('--ignore <pattern...>', 'reserved for ignored paths or packages')
    .action(
      async (
        pathArgument: string | undefined,
        _commandOptions: Record<string, unknown>,
        command: Command,
      ) => {
        const options = getGlobalOptions(command);
        const output = createTerminalOutput(options, streams);
        const projectDirectory = resolveProjectDirectory(pathArgument, options.cwd);
        const result = await scanProjectUseCase(projectDirectory);

        output.verbose(`Scanned project directory: ${result.rootDirectory}`);
        output.info(`Scanned ${result.rootManifest.name ?? 'unnamed project'}.`);
        output.info(`Source files: ${result.summary.sourceFileCount}`);
        output.info(`Workspaces: ${result.summary.workspaceCount}`);
        output.info(`Lockfiles: ${result.summary.lockfileCount}`);
        output.info(`Package manager: ${result.packageManager}`);
        if (result.packageManagerEvidence.conflicts.length > 0) {
          output.warning(
            `Conflicting package-manager evidence: ${result.packageManagerEvidence.conflicts.join(', ')}.`,
          );
        }
      },
    );
}

import { Option, type Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { CliError } from '../cli/errors.js';
import { getGlobalOptions } from '../cli/options.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import { createCliProgress, withProgress } from '../cli/progress.js';
import type { CliStreams } from '../cli/types.js';
import { renderReport } from '../reporters/index.js';
import { writeReport } from '../reporters/output-manager.js';
import type { ReportFormat } from '../reporters/shared/report.types.js';

export function registerTreeCommand(program: Command, streams: CliStreams): void {
  program
    .command('tree [path]')
    .description('Display resolved dependency-tree statistics.')
    .addOption(new Option('--depth <depth>', 'maximum display depth').default('all'))
    .option('--format <format>', 'output format: terminal, json, or html', 'terminal')
    .option('--output <path>', 'write the report to a file')
    .action(
      async (path: string | undefined, _options: Record<string, unknown>, command: Command) => {
        const global = getGlobalOptions(command);
        const output = createTerminalOutput(global, streams);
        const progress = createCliProgress(global, streams);
        const result = await withProgress(progress, () =>
          scanAndParseProject(resolveProjectDirectory(path, global.cwd), { progress }),
        );
        const format = command.optsWithGlobals().format as ReportFormat;
        if (!['terminal', 'json', 'html'].includes(format))
          throw new CliError(`Invalid report format: ${format}`, 2);
        const report = await renderReport(result.audit, format, global);
        const outputPath = command.optsWithGlobals().output as string | undefined;
        if (typeof outputPath === 'string')
          await writeReport(outputPath, report, result.scan.rootDirectory);
        else if (format !== 'terminal') streams.stdout.write(report);
        if (format !== 'terminal') return;
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

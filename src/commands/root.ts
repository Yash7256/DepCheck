import type { Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { CliError } from '../cli/errors.js';
import { getGlobalOptions } from '../cli/options.js';
import { createCliProgress, withProgress } from '../cli/progress.js';
import type { CliStreams } from '../cli/types.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import { renderReport } from '../reporters/index.js';
import { writeReport } from '../reporters/output-manager.js';
import type { ReportFormat } from '../reporters/shared/report.types.js';
import { isInteractiveTerminal, renderAuditDashboard } from '../tui/index.js';

export function registerRootAction(program: Command, streams: CliStreams, version: string): void {
  program
    .option('--no-interactive', 'use traditional terminal output')
    .option('--format <format>', 'output format: terminal, json, or html', 'terminal')
    .option('--output <path>', 'write the report to a file')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const global = getGlobalOptions(command);
      const projectDirectory = resolveProjectDirectory(undefined, global.cwd);
      const progress = createCliProgress(global, streams);
      const result = await withProgress(progress, () =>
        scanAndParseProject(projectDirectory, { progress }),
      );
      const commandOptions = command.opts() as {
        format?: string;
        output?: string;
        interactive?: boolean;
      };
      const format = commandOptions.format as ReportFormat;
      if (!['terminal', 'json', 'html'].includes(format)) {
        throw new CliError(`Invalid report format: ${format}`, 2);
      }

      const interactive =
        format === 'terminal' &&
        commandOptions.interactive !== false &&
        isInteractiveTerminal(streams.stdout as { isTTY?: boolean });
      if (interactive) {
        const exitCode =
          result.audit.diagnostics.length > 0 ? 1 : result.audit.findings.length > 0 ? 4 : 0;
        renderAuditDashboard(result.audit, {
          projectRoot: result.scan.rootDirectory,
          version,
          totalReferences: result.parse.summary.totalReferences,
          onExit: () => {
            process.exitCode = exitCode;
          },
        });
        return;
      }

      const report = await renderReport(result.audit, format, global);
      if (typeof commandOptions.output === 'string')
        await writeReport(commandOptions.output, report, result.scan.rootDirectory);
      else if (format !== 'terminal' || !global.quiet) streams.stdout.write(report);
      if (result.audit.diagnostics.length > 0)
        throw new CliError('Audit could not complete cleanly.', 1, { silent: true });
      if (result.audit.findings.length > 0)
        throw new CliError('Audit completed with findings.', 4, { silent: true });
    });
}

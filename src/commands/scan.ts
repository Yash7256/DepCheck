import type { Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { CliError } from '../cli/errors.js';
import { getGlobalOptions } from '../cli/options.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import { createCliProgress, withProgress } from '../cli/progress.js';
import type { CliStreams } from '../cli/types.js';
import { loadConfig } from '../config/loader.js';
import { mergeCliConfig } from '../config/merge.js';
import { renderReport } from '../reporters/index.js';
import { writeReport } from '../reporters/output-manager.js';
import type { ReportFormat } from '../reporters/shared/report.types.js';

export function registerScanCommand(program: Command, streams: CliStreams): void {
  program
    .command('scan [path]')
    .description('Scan a JavaScript or TypeScript project for dependency issues.')
    .option('--json', 'reserved for machine-readable scan output')
    .option('--no-security', 'skip security analysis')
    .option('--format <format>', 'output format: terminal, json, or html')
    .option('--output <path>', 'write the report to a file')
    .option('--color', 'enable terminal color')
    .option('--no-color', 'disable terminal color')
    .option('--config <path>', 'configuration file path')
    .option('--ignore <package...>', 'ignore dependency names')
    .option('--exclude <pattern...>', 'exclude source-file patterns')
    .action(
      async (
        pathArgument: string | undefined,
        _commandOptions: Record<string, unknown>,
        command: Command,
      ) => {
        const options = getGlobalOptions(command);
        const output = createTerminalOutput(options, streams);
        const progress = createCliProgress(options, streams);
        const projectDirectory = resolveProjectDirectory(pathArgument, options.cwd);
        const commandOptions = command.opts() as { security?: boolean };
        const rawOptions = command.opts() as {
          config?: string;
          ignore?: string[];
          exclude?: string[];
        };
        const config = mergeCliConfig(
          (await loadConfig(projectDirectory, rawOptions.config)).config,
          {
            ...(command.opts().format === undefined ? {} : { format: command.opts().format }),
            ...(rawOptions.ignore === undefined ? {} : { ignore: rawOptions.ignore }),
            ...(rawOptions.exclude === undefined ? {} : { exclude: rawOptions.exclude }),
          },
        );
        const result = await withProgress(progress, () =>
          scanAndParseProject(projectDirectory, {
            skipSecurity: commandOptions.security === false,
            scanOptions: { include: config.include, exclude: config.exclude },
            config,
            progress,
          }),
        );
        const format = (command.opts().format ?? config.reporting.format) as ReportFormat;
        if (!['terminal', 'json', 'html'].includes(format)) {
          throw new CliError(`Invalid report format: ${format}`, 2);
        }
        const report = await renderReport(result.audit, format, {
          ...(options.quiet === undefined ? {} : { quiet: options.quiet }),
          ...(options.verbose === undefined ? {} : { verbose: options.verbose }),
        });
        const outputPath = command.opts().output;
        if (typeof outputPath === 'string') await writeReport(outputPath, report, projectDirectory);
        else if (format !== 'terminal' || !options.quiet) streams.stdout.write(report);
        if (format !== 'terminal') {
          if (result.audit.diagnostics.length > 0)
            throw new CliError('Audit could not complete cleanly.', 1, { silent: true });
          if (result.audit.findings.length > 0)
            throw new CliError('Audit completed with findings.', 4, { silent: true });
          return;
        }

        output.verbose(`Scanned project directory: ${result.scan.rootDirectory}`);
        output.info(`Scanned ${result.scan.rootManifest.name ?? 'unnamed project'}.`);
        output.info(`Files parsed: ${result.parse.summary.filesParsed}`);
        output.info(`Total references: ${result.parse.summary.totalReferences}`);
        output.info(`Static imports: ${result.parse.summary.staticImports}`);
        output.info(`Dynamic imports: ${result.parse.summary.dynamicImports}`);
        output.info(`CommonJS imports: ${result.parse.summary.commonjsImports}`);
        output.info(`Re-exports: ${result.parse.summary.reExports}`);
        output.info(`Type-only imports: ${result.parse.summary.typeOnlyImports}`);
        output.info(`Declared references: ${result.resolve.summary.declaredReferences}`);
        output.info(`Alias references: ${result.resolve.summary.aliasReferences}`);
        output.info(`Built-in references: ${result.resolve.summary.builtinReferences}`);
        output.info(`Local references: ${result.resolve.summary.localReferences}`);
        output.info(`Workspace references: ${result.resolve.summary.workspaceReferences}`);
        output.info(`Undeclared references: ${result.resolve.summary.undeclaredReferences}`);
        output.info(`Unknown references: ${result.resolve.summary.unknownReferences}`);
        output.info(`Findings: ${result.audit.summary.total}`);
        output.info(
          `Finding summary: unused ${result.audit.summary.unused}, missing ${result.audit.summary.missing}, duplicates ${result.audit.summary.duplicates}.`,
        );
        output.info(`Outdated findings: ${result.audit.summary.outdated ?? 0}`);
        output.info(`Security findings: ${result.audit.summary.security ?? 0}`);
        if (result.audit.summary.tree !== undefined) {
          output.info(`Resolved packages: ${result.audit.summary.tree.uniquePackageNames}`);
          output.info(`Maximum dependency depth: ${result.audit.summary.tree.maximumDepth}`);
        }
        for (const finding of result.audit.findings) {
          output.warning(`[${finding.severity}] ${finding.code}: ${finding.message}`);
        }
        for (const diagnostic of result.audit.diagnostics) {
          output.error(`Diagnostic ${diagnostic.code}: ${diagnostic.message}`);
        }
        if (result.scan.packageManagerEvidence.conflicts.length > 0) {
          output.warning(
            `Conflicting package-manager evidence: ${result.scan.packageManagerEvidence.conflicts.join(', ')}.`,
          );
        }
        for (const reference of result.resolve.references) {
          output.verbose(
            `${reference.classification} ${reference.moduleSpecifier} at ${reference.filePath}:${reference.line}:${reference.column}`,
          );
        }
        for (const diagnostic of result.parse.diagnostics) {
          output.verbose(
            `Parser ${diagnostic.category}: ${diagnostic.message} at ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}`,
          );
        }
        if (result.audit.diagnostics.length > 0) {
          throw new CliError('Audit could not complete cleanly.', 1, { silent: true });
        }
        if (result.audit.findings.length > 0) {
          throw new CliError('Audit completed with findings.', 4, { silent: true });
        }
      },
    );
}

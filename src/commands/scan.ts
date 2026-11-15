import type { Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
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
        const result = await scanAndParseProject(projectDirectory);

        output.verbose(`Scanned project directory: ${result.scan.rootDirectory}`);
        output.info(`Scanned ${result.scan.rootManifest.name ?? 'unnamed project'}.`);
        output.info(`Files parsed: ${result.parse.summary.filesParsed}`);
        output.info(`Total references: ${result.parse.summary.totalReferences}`);
        output.info(`Static imports: ${result.parse.summary.staticImports}`);
        output.info(`Dynamic imports: ${result.parse.summary.dynamicImports}`);
        output.info(`CommonJS imports: ${result.parse.summary.commonjsImports}`);
        output.info(`Re-exports: ${result.parse.summary.reExports}`);
        output.info(`Type-only imports: ${result.parse.summary.typeOnlyImports}`);
        if (result.scan.packageManagerEvidence.conflicts.length > 0) {
          output.warning(
            `Conflicting package-manager evidence: ${result.scan.packageManagerEvidence.conflicts.join(', ')}.`,
          );
        }
        for (const reference of result.parse.references) {
          output.verbose(
            `${reference.referenceType} ${reference.moduleSpecifier} at ${reference.filePath}:${reference.location.line}:${reference.location.column}`,
          );
        }
        for (const diagnostic of result.parse.diagnostics) {
          output.verbose(
            `Parser ${diagnostic.category}: ${diagnostic.message} at ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}`,
          );
        }
      },
    );
}

import type { Command } from 'commander';

import { scanAndParseProject } from '../application/scan-and-parse-project.js';
import { loadConfig } from '../config/loader.js';
import { mergeCliConfig } from '../config/merge.js';
import { createFixProposals } from '../fixes/proposals.js';
import { formatFixPreview } from '../fixes/preview.js';
import { applyManifestProposals } from '../fixes/manifest-editor.js';
import { getGlobalOptions } from '../cli/options.js';
import { CliError } from '../cli/errors.js';
import { createTerminalOutput } from '../cli/output.js';
import { resolveProjectDirectory } from '../cli/paths.js';
import { createCliProgress, withProgress } from '../cli/progress.js';
import type { CliStreams } from '../cli/types.js';

export function registerFixCommand(program: Command, streams: CliStreams): void {
  program
    .command('fix [path]')
    .description('Apply safe dependency fixes.')
    .option('--dry-run', 'show planned changes without applying them')
    .option('--apply', 'apply proposed changes')
    .option('--yes', 'confirm non-interactive application')
    .option('--config <path>', 'configuration file path')
    .action(
      async (path: string | undefined, _options: Record<string, unknown>, command: Command) => {
        const global = getGlobalOptions(command);
        const output = createTerminalOutput(global, streams);
        const progress = createCliProgress(global, streams);
        const project = resolveProjectDirectory(path, global.cwd);
        const options = command.opts() as {
          apply?: boolean;
          dryRun?: boolean;
          yes?: boolean;
          config?: string;
        };
        if (options.apply && !options.yes)
          throw new CliError(
            'Applying fixes requires --yes confirmation. Use --dry-run to preview changes.',
            2,
          );
        const loaded = await loadConfig(project, options.config);
        const config = mergeCliConfig(loaded.config, {});
        const workflow = await withProgress(progress, () =>
          scanAndParseProject(project, { config, progress }),
        );
        const proposals = createFixProposals(workflow.audit, config);
        output.info(formatFixPreview(proposals));
        if (!options.apply || options.dryRun || proposals.length === 0) return;
        const applied = await applyManifestProposals(proposals);
        for (const item of applied.applied)
          output.success(`Applied ${item.kind} for ${item.packageName}.`);
        for (const item of applied.failed)
          output.error(`Failed ${item.proposal.packageName}: ${item.error}`);
        if (applied.failed.length > 0) throw new Error('One or more fixes failed.');
        const validation = await withProgress(progress, () =>
          scanAndParseProject(project, { config, progress }),
        );
        if (validation.audit.diagnostics.length > 0)
          throw new Error('Post-fix validation was incomplete.');
        output.success(
          `Fixes applied and validated. Remaining findings: ${validation.audit.findings.length}.`,
        );
      },
    );
}

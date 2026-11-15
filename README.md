# DepCheck

DepCheck is an open-source dependency auditing CLI for JavaScript and TypeScript projects. It
discovers project structure, parses source imports without executing application code, resolves
references against manifests, and produces structured audit reports.

## Current status

The core scan, parser, resolver, analyzers, reporting, configuration, and guarded fix layers are
implemented. The publishable package name is `depcheck-audit-cli`; its executable is `depcheck`.

## Requirements and quick start

- Node.js 20 or newer
- npm

```sh
npm install
npm run build
node dist/index.js scan .
```

After publication, install it globally or invoke it through `npx`:

```sh
npm install --global depcheck-audit-cli
depcheck scan .

npx depcheck-audit-cli scan .
```

During local development, use the built entry point or a packed tarball.

## Commands

```text
depcheck scan [path]
depcheck outdated [path]
depcheck duplicates [path]
depcheck security [path]
depcheck tree [path]
depcheck report [path]
depcheck fix [path]
```

`scan`, `outdated`, `security`, and `tree` run their current analysis workflows. `report` is a
registered placeholder. `fix` supports preview and explicitly confirmed manifest changes; it does
not install packages or edit lockfiles. See [docs/commands.md](docs/commands.md).

## Global options

- `--verbose` includes diagnostic details.
- `--quiet` suppresses informational terminal output but never suppresses errors.
- `--cwd <path>` selects a directory for the command.

`--verbose` and `--quiet` are mutually exclusive. Paths must exist and refer to directories;
relative paths are resolved from the process working directory, or from `--cwd` where applicable.

## Reports

The scan reporter supports terminal, JSON, and self-contained HTML output:

```sh
depcheck scan . --format terminal
depcheck scan . --format json --output depcheck-report.json
depcheck scan . --format html --output depcheck-report.html
```

Reports include project metadata, summary counts, findings, diagnostics, analyzer status, and any
suppressed findings. Report output is escaped and written using UTF-8 filesystem APIs.

## Configuration

DepCheck discovers `depcheck.config.json` in the selected project root. Use `--config <path>` to
select an explicit JSON file. CLI values override project configuration, which overrides built-in
defaults. Unknown fields and invalid values are rejected.

```json
{
  "version": 1,
  "exclude": ["generated/**"],
  "rules": {
    "ignoredDependencies": ["build-plugin"],
    "ignoredFindings": [
      {
        "code": "UNUSED_DEPENDENCY",
        "packageName": "build-plugin",
        "reason": "Loaded by the build system"
      }
    ]
  },
  "fix": {
    "allowMajorUpdates": false,
    "removeUnusedDependencies": false
  }
}
```

See [docs/configuration.md](docs/configuration.md) for the complete configuration contract.

## Safe fixes

`fix` is preview-only by default:

```sh
depcheck fix . --dry-run
depcheck fix . --apply --yes
```

Only approved high-confidence proposals in normal dependency sections can be applied. Peer and
optional dependencies are not removed automatically. Patch and minor updates preserve the
existing pinned, caret, or tilde strategy; major updates require `allowMajorUpdates`. Lockfiles
are never edited and packages are never installed. A full backup/rollback workflow is not yet
available, so review previews and use version control before applying changes.

## Supported package managers

Manifest and lockfile discovery recognizes npm, pnpm, Yarn, and Bun evidence. npm dependency-tree
analysis is implemented; unsupported package-manager tree analysis produces a diagnostic rather
than invoking the wrong tool. Registry analysis uses npm metadata and security analysis uses OSV.
See [docs/supported-package-managers.md](docs/supported-package-managers.md).

## Exit codes

- `0` — successful execution with no findings or diagnostics.
- `1` — general runtime failure or incomplete analysis.
- `2` — invalid command-line usage, arguments, or conflicting options.
- `3` — missing, invalid, or non-directory project path.
- `4` — audit completed with findings.

Provider failures, unsupported package managers, malformed provider responses, and network
failures are reported as diagnostics and do not count as a clean audit.

## Development

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run package:check
```

Additional documentation is in [`docs/`](docs/), including architecture, analyzers, reporting,
auto-fix safety, supported package managers, and troubleshooting. `npm run benchmark` performs an
optional local source-discovery/parser benchmark against a generated fixture.

## Security

See [SECURITY.md](SECURITY.md) for responsible vulnerability reporting.

## License

MIT

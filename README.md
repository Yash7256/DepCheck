# DepCheck

DepCheck is an open-source dependency auditing CLI for JavaScript and TypeScript projects.

## Status

Phase 03 project scanning is complete. The `scan` command discovers the root manifest, source
files, lockfiles, package-manager evidence, and configured workspaces. Dependency analysis and
mutation behavior remain reserved for future phases.

## Usage

```sh
depcheck --help
depcheck scan [path]
depcheck outdated [path]
depcheck duplicates [path]
depcheck security [path]
depcheck report [path]
depcheck fix [path]
```

Global options are available to every command:

- `--verbose` prints diagnostic details.
- `--quiet` suppresses informational output while preserving errors.
- `--cwd <path>` selects and validates the working directory.

`scan` performs project discovery and reports factual scan counts. The `outdated`, `duplicates`,
`security`, `report`, and `fix` commands are registered placeholders. No command currently
parses source contents, resolves dependencies, generates reports, or modifies files.

## Exit codes

- `0` — successful execution, help/version output, or a placeholder command.
- `1` — unexpected runtime failure.
- `2` — invalid CLI usage, arguments, or conflicting options.
- `3` — missing or invalid project directory.
- `4` — reserved for future analysis findings.

## Requirements

- Node.js 20 or newer
- npm

## Development

```sh
npm install
npm run build
npm test
npm run lint
npm run typecheck
npm run format:check
```

The package executable is `depcheck`. Only the Phase 03 scanner is implemented; analysis and
remediation commands are intentionally not implemented yet.

## License

MIT

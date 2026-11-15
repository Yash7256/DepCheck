# DepCheck

DepCheck is an open-source dependency auditing CLI for JavaScript and TypeScript projects.

## Status

Phase 02 CLI infrastructure is complete. All planned commands are registered, but their analysis
and mutation behavior is intentionally reserved for future phases.

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

The commands currently print a placeholder message and do not scan projects, analyze dependencies,
generate reports, or modify files.

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

The future package executable is reserved as `depcheck`; command handlers are intentionally not
implemented yet.

## License

MIT

# DepCheck

DepCheck is an open-source dependency auditing CLI for JavaScript and TypeScript projects.

## Status

Phase 09 configuration and safe-fix infrastructure is complete. The `scan` command discovers project files,
parses JavaScript and TypeScript module references, resolves declarations against root or owning
workspace manifests, and reports unused, missing, and duplicate resolved dependency-version
findings.

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

`scan` performs the project, parser, resolver, and analyzer pipeline. The `outdated`, `duplicates`,
`security`, `report`, and `fix` commands are registered placeholders. No command generates reports
or modifies files.

Findings use `error`, `warning`, or `info` severity and `high`, `medium`, or `low` confidence.
Unused-dependency findings are deliberately low confidence because absence of recognizable usage
does not prove a package is unused. Duplicate resolved-version analysis currently supports npm via
`npm ls --all --json`; pnpm, Yarn, Bun, and unknown package managers produce diagnostics instead.

Example output:

```text
Findings: 2
Finding summary: unused 1, missing 1, duplicates 0
Warning: [warning] UNUSED_DEPENDENCY: left-pad is declared in dependencies but no recognizable usage was found.
Warning: [error] MISSING_DEPENDENCY: zod is imported but is not declared by the owning package manifest.
```

## Exit codes

- `0` — successful execution with no findings or diagnostics.
- `1` — unexpected runtime failure.
- `2` — invalid CLI usage, arguments, or conflicting options.
- `3` — missing or invalid project directory.
- `4` — audit completed with findings.

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

The package executable is `depcheck`. Core analyzers are implemented for the `scan` command;
outdated, security, and tree commands are available with npm/OSV limitations; reporting and
remediation functionality is intentionally not implemented yet.

## Configuration

DepCheck discovers `depcheck.config.json` in the selected project root. Use `--config` to select
an explicit JSON file. CLI options override project configuration, which overrides built-in defaults.
Unknown fields and invalid values are rejected.

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

## Safe fixes

`depcheck fix` is preview-only by default:

```sh
depcheck fix --dry-run
depcheck fix --apply --yes
```

Only high-confidence unused dependencies in `dependencies` or `devDependencies` can be removed,
and only when `removeUnusedDependencies` is enabled. Peer and optional dependencies are never
removed automatically. Patch/minor updates preserve the existing `^`, `~`, or pinned strategy;
major updates require `allowMajorUpdates`. Lockfiles are never edited and packages are never
installed automatically. Fixes are validated at the manifest-write boundary and unrelated fields
are preserved.

Advanced commands:

```sh
depcheck outdated [path] --include-prerelease --depth all
depcheck security [path] --severity high --offline
depcheck tree [path] --depth 3
depcheck scan [path] --no-security
```

Outdated analysis uses npm registry metadata and is skipped with a diagnostic when registry data is
unavailable or a declaration is not a normal semver range. Security analysis uses the OSV API and
never treats a provider failure as zero vulnerabilities. Duplicate and tree analysis currently use
`npm ls --all --json`; pnpm, Yarn, Bun, and unknown package managers report unsupported analysis.

## License

MIT

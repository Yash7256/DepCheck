# DepCheck

DepCheck is a dependency auditing CLI for JavaScript and TypeScript projects. It scans a project,
parses source imports without executing application code, resolves those imports against
`package.json` manifests, and reports unused, missing, duplicate, outdated, and vulnerable
dependencies.

- Package name: `depcheck-audit-cli`
- Executable: `depcheck`
- Repository: [github.com/Yash7256/DepCheck](https://github.com/Yash7256/DepCheck)
- Runtime: Node.js 20 or newer
- Output: terminal, JSON, or self-contained HTML
- Supported project types: npm, pnpm, Yarn, and Bun projects (npm is used for resolved-tree analysis)

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
  - [Linux](#linux)
  - [macOS](#macos)
  - [Windows](#windows)
  - [Local project installation](#local-project-installation)
  - [Verify the installation](#verify-the-installation)
- [Start auditing](#start-auditing)
- [Global options](#global-options)
- [Commands](#commands)
  - [`scan`](#scan)
  - [`outdated`](#outdated)
  - [`security`](#security)
  - [`tree`](#tree)
  - [`duplicates`](#duplicates)
  - [`report`](#report)
  - [`fix`](#fix)
- [Reports](#reports)
- [Configuration](#configuration)
- [Live progress](#live-progress)
- [Update notifications](#update-notifications)
- [Exit codes](#exit-codes)
- [CI usage](#ci-usage)
- [Supported package managers](#supported-package-managers)
- [Current limitations](#current-limitations)
- [Troubleshooting](#troubleshooting)
- [Uninstall](#uninstall)
- [Development](#development)
- [Security](#security)
- [License](#license)

## Requirements

- Node.js 20 or newer (`node --version`)
- npm, which ships with Node.js (`npm --version`)
- Network access for npm registry and OSV checks; core source analysis works offline

## Installation

You can run DepCheck without installing it, install it globally, or add it to a project as a
development dependency. The examples use the package name `depcheck-audit-cli`; publish the
package before using the registry-based installation commands. After installation, the command is
`depcheck`.

Unqualified npm installs use the registry's `latest` dist-tag. Run the same global install command
again to update when a newer release is available. Pin a release only when needed:

```sh
npm install --global depcheck-audit-cli
npm install --global depcheck-audit-cli@0.1.0
```

### Linux

Run without installing:

```sh
npx depcheck-audit-cli scan .
```

Install globally:

```sh
npm install --global depcheck-audit-cli
depcheck --version
```

If global installs fail with a permissions error, use a Node version manager such as `nvm`, or
configure an npm prefix that your user owns:

```sh
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
npm install --global depcheck-audit-cli
```

Add the `export PATH` line to your shell profile to make it permanent.

### macOS

Run without installing:

```sh
npx depcheck-audit-cli scan .
```

Install globally:

```sh
npm install --global depcheck-audit-cli
depcheck --version
```

If `depcheck` is not found, inspect the global npm prefix with `npm prefix --global` and check your
shell profile, or use `npx` instead.

### Windows

PowerShell:

```powershell
npx depcheck-audit-cli scan .
```

Command Prompt:

```bat
npx depcheck-audit-cli scan .
```

Install globally in either shell:

```powershell
npm install --global depcheck-audit-cli
depcheck --version
```

If `depcheck` is not recognized after a global install:

```powershell
where.exe depcheck
npm config get prefix
```

The default global prefix is usually `%AppData%\npm`. Add that directory to your user `PATH` and
open a new terminal. Using `npx` avoids global `PATH` changes entirely.

Windows path examples:

```powershell
depcheck scan C:\Users\you\projects\my-app
depcheck scan "C:\Users\you\Projects\My App"
depcheck scan . --format html --output reports\depcheck-report.html
```

In Command Prompt, use `%USERPROFILE%` instead of `$HOME`:

```bat
cd %USERPROFILE%\projects\my-app
npx depcheck-audit-cli scan .
```

### Local project installation

Add DepCheck to a project so every contributor uses the same version:

```sh
npm install --save-dev depcheck-audit-cli
npx depcheck scan .
```

Add scripts to `package.json` if you prefer npm scripts:

```json
{
  "scripts": {
    "audit:deps": "depcheck scan .",
    "audit:ci": "depcheck scan . --format json --output reports/depcheck.json"
  }
}
```

Then run:

```sh
npm run audit:deps
npm run audit:ci
```

The same commands work on Linux, macOS, and Windows.

### Verify the installation

```sh
depcheck --version
depcheck --help
depcheck scan --help
```

## Start auditing

Linux and macOS:

```sh
cd ~/projects/my-app
npx depcheck-audit-cli scan .
```

Windows PowerShell:

```powershell
cd $HOME\projects\my-app
npx depcheck-audit-cli scan .
```

Windows Command Prompt:

```bat
cd %USERPROFILE%\projects\my-app
npx depcheck-audit-cli scan .
```

A first pass that skips OSV vulnerability queries is:

```sh
depcheck scan . --no-security
```

Run the full audit, including npm registry and OSV checks:

```sh
depcheck scan .
```

## Global options

These options apply to every command.

| Option          | Description                                                                              |
| --------------- | ---------------------------------------------------------------------------------------- |
| `--verbose`     | Include diagnostic details and per-reference information.                                |
| `--quiet`       | Suppress informational output, progress, and terminal reports. Errors are still printed. |
| `--no-progress` | Disable live progress output.                                                            |
| `--cwd <path>`  | Resolve the project path and `.` relative to this directory.                             |
| `-h, --help`    | Show help for the CLI or a command.                                                      |
| `-V, --version` | Print the installed version.                                                             |

`--verbose` and `--quiet` cannot be used together. The project path must exist and be a directory.
Relative paths are resolved from the current working directory, or from `--cwd` when supplied.

```sh
depcheck --verbose scan .
depcheck --quiet scan . --format json --output depcheck-report.json
depcheck --cwd /srv/projects/api scan .
depcheck --no-progress scan .
```

Windows:

```powershell
depcheck --cwd C:\Users\you\projects\api scan .
depcheck scan . --quiet --format json --output depcheck-report.json
```

## Commands

| Command                      | Purpose                                    | Status                |
| ---------------------------- | ------------------------------------------ | --------------------- |
| `depcheck scan [path]`       | Run the full audit and print a report.     | Implemented           |
| `depcheck outdated [path]`   | Show outdated dependencies from the audit. | Implemented           |
| `depcheck security [path]`   | Show known vulnerabilities from the audit. | Implemented, npm only |
| `depcheck tree [path]`       | Show resolved dependency-tree statistics.  | Implemented, npm only |
| `depcheck fix [path]`        | Preview or apply guarded manifest fixes.   | Implemented           |
| `depcheck duplicates [path]` | Find duplicate resolved versions.          | Placeholder           |
| `depcheck report [path]`     | Generate a report from an existing audit.  | Placeholder           |

All project-scanning commands run the full audit pipeline and then print the relevant subset.
For example, `security` still performs the unused, missing, duplicates, outdated, and tree analysis
before printing security findings.

### `scan`

Run the complete audit and produce a report.

```text
depcheck scan [path] [options]
```

| Option                   | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `[path]`                 | Project directory. Defaults to `.` relative to `--cwd` or the current directory.                    |
| `--no-security`          | Skip OSV vulnerability checks. This is the fastest full-project option.                             |
| `--format <format>`      | Output format: `terminal` (default), `json`, or `html`.                                             |
| `--output <path>`        | Write the report to a file instead of stdout. Relative paths resolve from the scanned project root. |
| `--config <path>`        | Use an explicit configuration file instead of `depcheck.config.json`.                               |
| `--ignore <package...>`  | Add dependency names to the ignored list. Accepts multiple values.                                  |
| `--exclude <pattern...>` | Add source-file glob patterns to exclude. Accepts multiple values.                                  |
| `--json`                 | Reserved for machine-readable output; use `--format json`.                                          |
| `--color` / `--no-color` | Reserved for terminal color control.                                                                |

The scan report includes project metadata, summary counts, findings, diagnostics, analyzer status,
and suppressed findings.

Examples:

```sh
# Full audit in the current project
depcheck scan .

# Fast scan without network vulnerability checks
depcheck scan . --no-security

# Audit another directory
depcheck scan ~/projects/api
depcheck scan /srv/projects/api

# Exclude generated code and ignore a build-only package
depcheck scan . --exclude "generated/**" "vendor/**" --ignore build-plugin

# JSON report for CI
depcheck scan . --format json --output depcheck-report.json

# Self-contained HTML report
depcheck scan . --format html --output reports/depcheck-report.html
```

Windows:

```powershell
depcheck scan .
depcheck scan C:\Users\you\projects\api
depcheck scan . --exclude "generated/**" --ignore build-plugin
depcheck scan . --format json --output depcheck-report.json
depcheck scan . --format html --output reports\depcheck-report.html
```

When `scan` uses `terminal` output, it prints the human-readable report plus summary information.
With `--quiet`, informational output is suppressed, but the exit code still reflects the audit.

### `outdated`

Find dependencies that have newer versions available. This command runs the full audit, including
npm registry lookups, then prints only outdated findings.

```text
depcheck outdated [path] [options]
```

| Option                  | Description                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| `[path]`                | Project directory. Defaults to `.`.                                               |
| `--format <format>`     | Output format: `terminal` (default), `json`, or `html`.                           |
| `--output <path>`       | Write the report to a file. Relative paths resolve from the scanned project root. |
| `--include-prerelease`  | Accepted but not yet applied.                                                     |
| `--depth <direct\|all>` | Accepted but not yet applied.                                                     |

Examples:

```sh
depcheck outdated .
depcheck outdated . --format json --output outdated.json
```

Windows:

```powershell
depcheck outdated .
depcheck outdated C:\Users\you\projects\api --format json --output outdated.json
```

Outdated findings include the declared range, wanted version, latest version, update type
(patch, minor, major), dependency type, and workspace when applicable.

### `security`

Query OSV for known vulnerabilities in installed npm packages. This command runs the full audit
and prints only security findings.

```text
depcheck security [path] [options]
```

| Option               | Description                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[path]`             | Project directory. Defaults to `.`.                                                                                                                |
| `--offline`          | Skip OSV queries. No local vulnerability cache is configured yet, so the audit records an incomplete-analysis diagnostic in JSON and HTML reports. |
| `--format <format>`  | Output format: `terminal` (default), `json`, or `html`.                                                                                            |
| `--output <path>`    | Write the report to a file. Relative paths resolve from the scanned project root.                                                                  |
| `--severity <level>` | Accepted but not yet applied. Values: `critical`, `high`, `moderate`, `low`, `unknown`.                                                            |

Security analysis uses the installed npm dependency tree. If the project is detected as pnpm, Yarn,
Bun, or unknown, the analyzer returns an unsupported package-manager diagnostic instead of invoking
another package manager.

Examples:

```sh
depcheck security .
depcheck security . --format json --output security.json
```

Windows:

```powershell
depcheck security .
depcheck security C:\Users\you\projects\api --format json --output security.json
```

### `tree`

Show resolved dependency-tree statistics. This command runs the full audit and prints tree
statistics.

```text
depcheck tree [path] [options]
```

| Option              | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `[path]`            | Project directory. Defaults to `.`.                                               |
| `--depth <depth>`   | Accepted but not yet applied.                                                     |
| `--format <format>` | Output format: `terminal` (default), `json`, or `html`.                           |
| `--output <path>`   | Write the report to a file. Relative paths resolve from the scanned project root. |

Terminal output includes resolved instances, unique package names, unique package versions, and
maximum depth.

Examples:

```sh
depcheck tree .
depcheck tree . --format json --output tree.json
```

Windows:

```powershell
depcheck tree .
depcheck tree C:\Users\you\projects\api
```

### `duplicates`

Placeholder. The command is registered and accepts `--production`, but dependency-duplicate
reporting is currently available through `scan` as `DUPLICATE_DEPENDENCY_VERSION` findings.

```sh
depcheck duplicates .
depcheck duplicates . --production
```

### `report`

Placeholder. Use `depcheck scan --format terminal|json|html` to generate reports today.

```sh
depcheck report .
depcheck report . --format table
```

### `fix`

Preview or apply safe manifest changes. `fix` is preview-only by default and never installs
packages or edits lockfiles.

```text
depcheck fix [path] [options]
```

| Option            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `[path]`          | Project directory. Defaults to `.`.                |
| `--dry-run`       | Print the preview and make no changes.             |
| `--apply`         | Apply proposed manifest changes. Requires `--yes`. |
| `--yes`           | Confirm non-interactive application.               |
| `--config <path>` | Use an explicit configuration file.                |

Examples:

```sh
# Preview proposed changes
depcheck fix .

# Explicit preview
depcheck fix . --dry-run

# Apply after reviewing the preview
depcheck fix . --apply --yes
```

Windows:

```powershell
depcheck fix .
depcheck fix C:\Users\you\projects\api --dry-run
```

Safety rules:

- `--apply` without `--yes` is rejected.
- Only patch and minor updates are applied by default.
- Major updates require `fix.allowMajorUpdates: true`.
- Unused dependencies can only be removed when `fix.removeUnusedDependencies: true` and the finding
  is high confidence.
- Peer and optional dependencies are never removed automatically.
- Existing version-prefix style (`1.2.3`, `^1.2.3`, `~1.2.3`) is preserved.
- Lockfiles are not modified and packages are not installed.
- DepCheck re-runs validation after applying changes.
- There is no full backup or rollback workflow; review the preview and keep version control
  available before applying.

## Reports

`scan`, `outdated`, `security`, and `tree` support three report formats.

```sh
depcheck scan . --format terminal
depcheck scan . --format json --output depcheck-report.json
depcheck scan . --format html --output depcheck-report.html
```

- `terminal` prints human-readable text to stdout.
- `json` prints a machine-readable report to stdout unless `--output` is supplied.
- `html` prints a self-contained HTML document with embedded CSS.

`--output` paths are resolved relative to the scanned project root. Directories are created
automatically. Output files are written as UTF-8.

For CI, prefer an explicit file path:

```sh
depcheck scan . --format json --output reports/depcheck.json
```

Windows:

```powershell
depcheck scan . --format json --output reports\depcheck.json
```

## Configuration

DepCheck reads `depcheck.config.json` from the selected project root. Use `--config <path>` to load
a different JSON file. Configuration is JSON only; JavaScript configuration files are never
executed. Unknown fields and invalid values are rejected.

Precedence is CLI arguments, then project configuration, then built-in defaults.

```json
{
  "version": 1,
  "include": [],
  "exclude": ["generated/**"],
  "analyzers": {
    "unused": true,
    "missing": true,
    "duplicates": true,
    "outdated": true,
    "security": true
  },
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
  "security": {
    "minimumSeverity": "low"
  },
  "reporting": {
    "format": "terminal"
  },
  "fix": {
    "allowMajorUpdates": false,
    "removeUnusedDependencies": false
  }
}
```

| Field                          | Description                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `version`                      | Required schema version. Must be `1`.                                         |
| `include`                      | Source glob patterns. Empty means the default source glob.                    |
| `exclude`                      | Additional source glob patterns to exclude.                                   |
| `analyzers`                    | Analyzer enable flags in the configuration contract.                          |
| `rules.ignoredDependencies`    | Package names to suppress from findings.                                      |
| `rules.ignoredFindings`        | Findings to suppress by code and optional package name. `reason` is required. |
| `security.minimumSeverity`     | Minimum security severity in the configuration contract.                      |
| `reporting.format`             | Default report format: `terminal`, `json`, or `html`.                         |
| `fix.allowMajorUpdates`        | Allow major version updates in `fix`. Defaults to `false`.                    |
| `fix.removeUnusedDependencies` | Allow removal of eligible unused dependencies. Defaults to `false`.           |

`include`, `exclude`, `rules`, `reporting.format`, and `fix` are applied by the current release. The
`analyzers` flags and `security.minimumSeverity` are validated but are not yet honored by the
analyzer pipeline.

Suppressed findings remain available in reports with their suppression reason.

Recommended configuration for a production CI job:

```json
{
  "version": 1,
  "exclude": ["dist/**", "coverage/**", "generated/**"],
  "rules": {
    "ignoredDependencies": [],
    "ignoredFindings": []
  },
  "reporting": {
    "format": "json"
  },
  "fix": {
    "allowMajorUpdates": false,
    "removeUnusedDependencies": false
  }
}
```

## Live progress

Project-scanning commands report progress while they work:

- On interactive terminals, DepCheck shows an updating spinner with elapsed time and the current
  phase.
- In CI or non-interactive terminals, it prints periodic `Progress:` lines.
- Registry and OSV checks include package counters, such as
  `Checked 84/204 package versions`.
- Progress is written to stderr, so `--format json` and `--format html` output on stdout stays
  machine-readable.

Phases include project discovery, source parsing, import resolution, unused analysis, missing
analysis, duplicate analysis, npm registry checks, OSV checks, and dependency-tree analysis.

Disable progress with either option:

```sh
depcheck scan . --no-progress
depcheck scan . --quiet
```

## Update notifications

Normal DepCheck commands check the npm `latest` dist-tag in the background. DepCheck checks the
registry at most once every 24 hours and stores only the public latest-version metadata in the
user-level cache. Network failures and cache permission errors remain silent.

Update warnings go to stderr, so JSON and HTML report output on stdout remains valid. Help and
version commands do not perform update checks. DepCheck never installs updates automatically.

Disable notifications for one command or a shell session with either environment variable:

```sh
DEPCHECK_NO_UPDATE_NOTIFIER=1 depcheck scan .
NO_UPDATE_NOTIFIER=1 depcheck scan .
```

PowerShell:

```powershell
$env:DEPCHECK_NO_UPDATE_NOTIFIER = "1"
depcheck scan .
```

Update manually with npm:

```sh
npm install --global depcheck-audit-cli
```

## Exit codes

| Code | Meaning                                                                 |
| ---- | ----------------------------------------------------------------------- |
| `0`  | Successful execution with no findings or diagnostics.                   |
| `1`  | Runtime failure or incomplete analysis. This takes precedence over `4`. |
| `2`  | Invalid command-line usage, arguments, or conflicting options.          |
| `3`  | Missing, invalid, or non-directory project path.                        |
| `4`  | Audit completed with findings.                                          |

Only `scan` maps findings and incomplete diagnostics to exit codes `4` and `1`. `outdated`,
`security`, and `tree` exit `0` on successful execution even when they print findings, so parse
their reports or use `scan` in CI quality gates.

Network failures, registry rate limits, OSV failures, unsupported package managers, and malformed
provider responses are reported as diagnostics and never treated as a clean audit.

## CI usage

Use `scan --format json` and inspect either the exit code or the generated report.

Linux and macOS:

```sh
npx depcheck-audit-cli scan . --format json --output reports/depcheck.json
status=$?

if [ "$status" -eq 4 ]; then
  echo "Dependency findings detected."
elif [ "$status" -ne 0 ]; then
  echo "DepCheck could not complete (exit $status)."
fi
```

Windows PowerShell:

```powershell
npx depcheck-audit-cli scan . --format json --output reports\depcheck.json
$status = $LASTEXITCODE

if ($status -eq 4) {
  Write-Host "Dependency findings detected."
} elseif ($status -ne 0) {
  Write-Host "DepCheck could not complete (exit $status)."
}
```

Windows Command Prompt:

```bat
npx depcheck-audit-cli scan . --format json --output reports\depcheck.json
if %ERRORLEVEL%==4 echo Dependency findings detected.
if not %ERRORLEVEL%==0 if not %ERRORLEVEL%==4 echo DepCheck could not complete.
```

GitHub Actions matrix example:

```yaml
name: Dependency audit

on:
  pull_request:
  push:
    branches: [main]

jobs:
  depcheck:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx depcheck-audit-cli scan . --format json --output depcheck-report.json
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        with:
          name: depcheck-${{ matrix.os }}
          path: depcheck-report.json
```

For a faster CI job that avoids OSV network calls:

```sh
depcheck scan . --no-security --format json --output depcheck-report.json
```

## Supported package managers

Manifest and lockfile discovery recognizes npm, pnpm, Yarn, and Bun evidence.

- The unused, missing, outdated, and security analyzers work from manifests and installed-tree data.
- Resolved dependency-tree, duplicate-version, and OSV vulnerability analysis currently use npm
  only. For unsupported package managers, DepCheck emits an explicit diagnostic instead of invoking
  the wrong package manager command.
- npm registry metadata is used for outdated checks, and OSV npm data is used for security checks.

## Current limitations

- `duplicates` and `report` are registered placeholders; use `scan` for their functionality.
- `security`, `tree`, and `duplicates` analysis require an npm dependency tree.
- `--include-prerelease` and `--depth` are accepted but not yet applied.
- `--severity` is accepted by `security` but not yet applied.
- `--json` and `--color` / `--no-color` on `scan` are reserved.
- The `analyzers` configuration flags and `security.minimumSeverity` are validated but not yet
  honored.
- `security --offline` cannot analyze vulnerabilities because no local cache is configured.
- Current unused-dependency findings are low confidence, so automatic removal does not trigger in
  this release even with `fix.removeUnusedDependencies` enabled.
- `fix` never installs packages, edits lockfiles, or performs a full backup/rollback.

## Troubleshooting

### `depcheck: command not found` or `'depcheck' is not recognized`

Use `npx` instead of a global install:

```sh
npx depcheck-audit-cli scan .
```

Or check your global npm prefix and `PATH`:

```sh
npm config get prefix
```

On Windows, also run:

```powershell
where.exe depcheck
```

Restart the terminal after changing `PATH`.

### Node version errors

DepCheck requires Node.js 20 or newer:

```sh
node --version
```

Upgrade Node.js or use a version manager (`nvm`, `fnm`, or Volta).

### Progress does not appear

Progress is disabled by `--quiet` and `--no-progress`. Non-interactive terminals receive plain
`Progress:` lines instead of an animated spinner. Progress is written to stderr, not stdout.

### Audit reports incomplete analysis

Exit code `1` means one or more analyzers could not complete. Common causes:

- npm registry rate limiting or network failure
- OSV network failure or rate limiting
- `npm ls` failure or timeout
- pnpm, Yarn, Bun, or unknown package-manager detection for tree-based analysis
- malformed provider responses

Use `--verbose` and a JSON report to inspect diagnostics:

```sh
depcheck scan . --verbose --format json --output depcheck-report.json
```

If you only need fast, offline source analysis, use:

```sh
depcheck scan . --no-security
```

### Invalid configuration

Configuration files must be valid JSON, must include `version: 1`, and must not contain unknown
fields. Error messages include the file path and validation details.

### Windows PowerShell script execution policy

If npm or npx scripts are blocked by PowerShell, prefer `npx` from a normal shell, or review your
execution policy with:

```powershell
Get-ExecutionPolicy -List
```

### Fixes are rejected

`--apply` requires `--yes`:

```sh
depcheck fix . --apply --yes
```

Review the preview first:

```sh
depcheck fix . --dry-run
```

## Uninstall

Global installation, all systems:

```sh
npm uninstall --global depcheck-audit-cli
```

Local project installation:

```sh
npm uninstall --save-dev depcheck-audit-cli
```

No-install usage through `npx` leaves no global entry; use `npx` again when needed.

## Development

Clone the repository and install dependencies:

```sh
npm ci
npm run build
node dist/index.js scan .
```

Useful scripts:

```sh
npm run dev            # watch build
npm run build          # build dist/
npm run test           # run unit tests
npm run test:watch     # watch tests
npm run test:e2e       # end-to-end smoke test
npm run lint
npm run format
npm run format:check
npm run typecheck
npm run benchmark
npm run package:check
```

Additional documentation is available in [`docs/`](docs/):

- [Architecture](docs/architecture.md)
- [Commands](docs/commands.md)
- [Analyzers](docs/analyzers.md)
- [Reporting](docs/reporting.md)
- [Configuration](docs/configuration.md)
- [Auto-fix safety](docs/auto-fix.md)
- [Supported package managers](docs/supported-package-managers.md)
- [Troubleshooting](docs/troubleshooting.md)

## Security

See [SECURITY.md](SECURITY.md) for responsible vulnerability reporting.

## License

MIT

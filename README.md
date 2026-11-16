# DepCheck

A CLI tool by [Anvik Labs](https://anviklabs.site)

DepCheck audits JavaScript and TypeScript dependencies without running your code. It reads imports
and reports:

- **Unused**: declared dependencies that no source file imports or script mentions.
- **Missing**: imported packages that are not declared in the owning manifest.
- **Duplicate**: packages resolved to more than one version in the npm tree.
- **Outdated**: dependencies with a newer version on npm.
- **Vulnerable**: resolved npm packages with known OSV advisories.

The npm package is `depcheck-audit-cli`. It installs the `depcheck` command.

## Requirements

- Node.js 20 or newer.
- An npm project for duplicate, dependency-tree, and security analysis. Other package managers are detected, but those analyzers report an unsupported diagnostic. See [docs/supported-package-managers.md](docs/supported-package-managers.md).

## Installation

Install globally, then verify. The current release is `0.1.7`.

### Linux

```sh
npm install --global depcheck-audit-cli
depcheck --version
```

If npm reports a permission error, use a user prefix and add it to `PATH`:

```sh
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

Run the install command again. If `depcheck` is not found, add the directory from `npm config get prefix` plus `/bin` to `PATH`. nvm users already have this path.

### macOS

```sh
npm install --global depcheck-audit-cli
depcheck --version
```

If `depcheck` is not found, add `$(npm config get prefix)/bin` to `PATH` in your shell profile.

### Windows

PowerShell:

```powershell
npm install --global depcheck-audit-cli
depcheck --version
```

Command Prompt:

```bat
npm install --global depcheck-audit-cli
depcheck --version
```

If `depcheck` is not recognized, run `where.exe depcheck` and `npm config get prefix`. The default prefix is `%AppData%\npm`; add it to `Path` and restart the terminal.

If PowerShell blocks `npm.ps1`, update the execution policy:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Local project install

```sh
npm install --save-dev depcheck-audit-cli
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "audit": "depcheck scan . --no-interactive",
    "audit:outdated": "depcheck outdated .",
    "audit:security": "depcheck security ."
  }
}
```

Run them with `npm run audit`, `npm run audit:outdated`, or `npm run audit:security`.

## Quick start

```sh
cd my-app
depcheck scan . --no-interactive --no-progress
```

Excerpt from a test project:

```text
Project: depcheck-doc-fixture
Scanned: 2 files

Unused Dependencies:      2
Missing Dependencies:     2
Duplicate Versions:       1
Outdated Dependencies:    3
Security Vulnerabilities: 4

Total Findings:           12
```

On an interactive terminal, omit `--no-interactive` to open the dashboard.

## Commands

Progress goes to stderr. Every command accepts `--verbose`, `--quiet`, `--no-progress`,
`--cwd <path>`, and `--no-interactive`. See [docs/commands.md](docs/commands.md).

### scan

Runs the full audit.

| Option                   | Description                      |
| ------------------------ | -------------------------------- |
| `--no-security`          | Skip security analysis.          |
| `--format <format>`      | `terminal`, `json`, or `html`.   |
| `--output <path>`        | Write the report to a file.      |
| `--config <path>`        | Use a specific config file.      |
| `--ignore <package...>`  | Hide findings for package names. |
| `--exclude <pattern...>` | Skip source files by glob.       |

```sh
depcheck scan ~/projects/my-app
```

```powershell
depcheck scan C:\Users\you\projects\my-app
```

### outdated

Finds dependencies with a newer version on npm.

| Option              | Description                    |
| ------------------- | ------------------------------ |
| `--format <format>` | `terminal`, `json`, or `html`. |
| `--output <path>`   | Write the report to a file.    |

```sh
depcheck outdated .
```

```sh
depcheck outdated . --format json --output reports/outdated.json
```

### security

Queries OSV for vulnerabilities in resolved npm packages.

| Option              | Description                    |
| ------------------- | ------------------------------ |
| `--offline`         | Do not query OSV.              |
| `--format <format>` | `terminal`, `json`, or `html`. |
| `--output <path>`   | Write the report to a file.    |

```sh
depcheck security .
```

```sh
depcheck security . --offline
```

### tree

Shows resolved dependency-tree statistics.

| Option              | Description                    |
| ------------------- | ------------------------------ |
| `--format <format>` | `terminal`, `json`, or `html`. |
| `--output <path>`   | Write the report to a file.    |

```sh
depcheck tree .
```

```sh
depcheck tree . --format json --output reports/tree.json
```

### fix

Previews and applies safe `package.json` updates for outdated dependencies. It does not install
packages or edit lockfiles. See [docs/auto-fix.md](docs/auto-fix.md).

| Option            | Description                                 |
| ----------------- | ------------------------------------------- |
| `--dry-run`       | Show planned changes without applying them. |
| `--apply`         | Apply proposed changes. Requires `--yes`.   |
| `--yes`           | Confirm non-interactive application.        |
| `--config <path>` | Use a specific config file.                 |

```sh
depcheck fix . --dry-run
```

```sh
depcheck fix . --apply --yes
```

## Reports

`scan`, `outdated`, `security`, and `tree` support terminal, JSON, and HTML reports. `--output`
paths resolve from the project root, and missing directories are created. JSON and HTML contain the
full audit result; terminal output is filtered to the command's findings. See
[docs/reporting.md](docs/reporting.md).

```sh
depcheck scan . --format terminal --no-interactive
```

```sh
depcheck scan . --format json --output reports/scan.json
```

```sh
depcheck scan . --format html --output reports/scan.html
```

## Configuration

DepCheck reads `depcheck.config.json` from the project root; `--config` selects another file.
Unknown fields are rejected.

```json
{
  "version": 1,
  "include": ["src/**/*.js"],
  "exclude": ["src/vendor/**"],
  "rules": {
    "ignoredDependencies": ["is-odd"],
    "ignoredFindings": [
      { "code": "SECURITY_VULNERABILITY", "packageName": "lodash", "reason": "Accepted risk" }
    ]
  }
}
```

| Field                       | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `version`                   | Must be `1`.                                                              |
| `include`                   | Source globs. Empty scans all JS and TS files.                            |
| `exclude`                   | Extra globs to skip.                                                      |
| `rules.ignoredDependencies` | Package names to hide from all findings.                                  |
| `rules.ignoredFindings`     | Findings to hide by `code` and optional `packageName`; requires `reason`. |

CLI flags override config values. `--ignore` and `--exclude` add to config lists; defaults fill the
rest. See [docs/configuration.md](docs/configuration.md).

## Exit codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | Completed with no findings.                |
| `1`  | Audit incomplete, or a command failed.     |
| `2`  | Invalid usage or configuration.            |
| `3`  | Path does not exist or is not a directory. |
| `4`  | `scan` found issues.                       |

Only `scan` returns `4` when it finds issues. `outdated`, `security`, and `tree` return `0` after a
successful run, even when they report findings.

## CI usage

```yaml
name: Dependency audit
on: [push, pull_request]
jobs:
  audit:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install --global depcheck-audit-cli
      - run: depcheck scan . --no-interactive --no-progress
```

Any nonzero exit fails the step. Exit code `4` means findings were detected; `1` means the audit was incomplete.

## Troubleshooting

- `depcheck` is not found: check `npm config get prefix` and add its `bin` directory to `PATH`.
- Permission denied during global install: use a user npm prefix or nvm.
- `scan` exits with `1`: read the diagnostics; network, OSV, or package-manager failures make the
  audit incomplete.
- `fix` changes nothing: run `depcheck fix . --dry-run` first. Pinned versions can produce no change.

See [docs/troubleshooting.md](docs/troubleshooting.md).

## Not yet available

- The `duplicates` and `report` commands.
- The `--json`, `--color`, `--no-color`, `--depth`, `--severity`, and `--include-prerelease` flags.
- The `analyzers`, `security.minimumSeverity`, and `reporting.format` configuration fields.
- Automatic removal of unused dependencies and major-version updates through `fix`.

## Development

```sh
git clone https://github.com/Yash7256/DepCheck.git
cd DepCheck
npm ci
npm run build
npm test
npm run lint
```

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT. Built and maintained by Anvik Labs - https://anviklabs.site

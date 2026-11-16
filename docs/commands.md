# Commands

```sh
depcheck scan [path]
depcheck outdated [path]
depcheck duplicates [path]
depcheck security [path]
depcheck tree [path]
depcheck fix [path]
```

Reporting options include `--format terminal|json|html` and `--output <path>`. Global options are
`--verbose`, `--quiet`, `--no-progress`, and `--cwd <path>`. Scan also supports `--config`,
`--ignore`, `--exclude`, and `--no-security`.

Project-scanning commands write live progress to stderr. Interactive terminals show an updating
spinner with elapsed time; non-interactive terminals receive periodic progress lines. `--quiet` and
`--no-progress` disable progress output.

`fix` previews by default. Application requires `--apply --yes`.

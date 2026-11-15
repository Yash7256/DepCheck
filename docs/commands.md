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
`--verbose`, `--quiet`, and `--cwd <path>`. Scan also supports `--config`, `--ignore`, `--exclude`,
and `--no-security`.

`fix` previews by default. Application requires `--apply --yes`.

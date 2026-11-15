# Configuration

DepCheck discovers `depcheck.config.json` in the selected project root. An explicit path can be
provided with `--config`. Configuration is JSON only; JavaScript configuration files are not run.

Precedence is CLI arguments, then project configuration, then built-in defaults. Unknown fields are
rejected. `exclude` contains source glob patterns. `rules.ignoredDependencies` and
`rules.ignoredFindings` suppress matching findings while retaining suppression metadata in reports.

The `fix` section controls safe removal and major-update authorization. It does not authorize
automatic installation or lockfile changes.

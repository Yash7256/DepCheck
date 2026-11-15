# Troubleshooting

## Incomplete analysis

Network failures, registry rate limits, OSV failures, malformed dependency-tree output, and
unsupported package managers produce diagnostics and exit code `1`. Review JSON diagnostics when
using CI.

## Invalid configuration

Configuration errors include the file path and Zod validation details. Check spelling, supported
formats, severity values, and the required `version: 1`.

## Fixes

Use `depcheck fix --dry-run` first. Application without `--yes` is rejected. DepCheck never runs
project scripts or installs packages.

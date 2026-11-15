# Auto-fix safety

`depcheck fix` is preview-only unless `--apply --yes` is supplied. Only high-confidence unused
dependencies in normal dependency sections are eligible for removal, and removal must be enabled
with `fix.removeUnusedDependencies`. Peer and optional dependencies are not removed automatically.

Patch and minor updates preserve the existing pinned, caret, or tilde strategy. Major updates
require `fix.allowMajorUpdates`. Lockfiles are not edited and packages are not installed.

Manifest edits are parsed structurally and written through a temporary file. After application,
DepCheck re-runs validation and reports remaining findings. A full backup/rollback workflow is not
currently available, so review the preview and keep version control available before applying.

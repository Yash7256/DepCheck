# Architecture

DepCheck is a local Node.js CLI. Its audit pipeline is:

```text
scanner → parser → resolver → analyzers → reporters
```

The scanner discovers manifests, workspaces, lockfiles, and source paths. The parser extracts
static module references without executing project code. The resolver associates references with
root or workspace manifests. Analyzers create structured findings and diagnostics. Reporters only
format normalized audit results.

Configuration and fixes are separate layers. Fixes are proposed from findings and require explicit
authorization before changing a manifest. Lockfiles and project scripts are never modified or run.

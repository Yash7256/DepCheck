# Supported package managers

Manifest and lockfile discovery recognizes npm, pnpm, Yarn, and Bun evidence. npm dependency-tree
analysis is currently implemented. Duplicate and tree analysis for pnpm, Yarn, Bun, or conflicting
evidence reports an explicit unsupported diagnostic rather than running npm commands.

Registry metadata uses npm package names. Security queries use OSV's npm ecosystem.

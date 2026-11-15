# DepCheck

DepCheck is an open-source dependency auditing CLI for JavaScript and TypeScript projects.

## Status

This repository currently contains the Phase 01 project foundation. The CLI entry point and
dependency-auditing features will be implemented in later phases.

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

The future package executable is reserved as `depcheck`; command handlers are intentionally not
implemented yet.

## License

MIT

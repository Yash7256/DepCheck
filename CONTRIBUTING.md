# Contributing

Thank you for helping improve DepCheck. Keep changes focused on the current phase and avoid
silently expanding analyzer scope.

## Local workflow

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run package:check
```

Add focused unit tests for new behavior and integration coverage when command wiring changes.
Tests should use temporary directories and should not depend on live registry or OSV responses.
Provider boundaries must be mocked in tests.

## Pull requests

Describe the behavior changed, the tests run, and any compatibility or security implications.
Do not commit generated `dist` output, package tarballs, credentials, or local configuration.
Keep public CLI behavior and exit codes documented.

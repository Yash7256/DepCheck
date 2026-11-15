# Security policy

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Contact the repository maintainers
through the private security-reporting channel configured for the hosting repository and include
the affected version, reproduction steps, impact, and a suggested mitigation if available.

This project does not currently publish a security contact address. Until one is configured,
maintainers should use a private hosting-provider security advisory.

## Scope

DepCheck reads local project files and may query npm registry and OSV endpoints for analysis. It
does not execute project scripts, install dependencies, modify lockfiles, or send source contents
to those providers. Please report command execution, path traversal, unsafe file writes, or
credential disclosure issues promptly.

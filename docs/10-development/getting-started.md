# Getting Started

## Purpose

This guide covers setting up a development environment for repo-slice.

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| bun | Latest |

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd repo-slice

# Install dependencies
bun install
```

## Building

```bash
bun run build
```

## Running Locally

```bash
# Basic usage
bun run src/cli.ts pack --entry path/to/file.ts

# With symbol query
bun run src/cli.ts pack --symbol UserService.create --reason

# List workspaces
bun run src/cli.ts workspaces
```

## Debugging

Use `--debug` to emit diagnostics to stderr:

```bash
bun run src/cli.ts pack --entry src/index.ts --debug
```

## Related

- [Testing](./testing.md)
- [CLI Commands](../06-cli/commands.md)
- [Project Structure](../02-architecture/project-structure.md)

# Overview

## Purpose

`repo-slice` is a deterministic CLI that extracts a small, high-signal context bundle from a repository or monorepo. The output is optimized for AI-assisted coding workflows and repeatable automation.

## What It Does

- Finds relevant code based on anchors (entry file, symbol, diff, or log)
- Expands context via import graphs with a depth limit
- Ranks and selects snippets/files within strict budgets
- Emits a single Markdown or JSON bundle suitable for copy/paste or tooling

## Languages

| Language | Parser |
|----------|--------|
| TypeScript / JavaScript | TypeScript Compiler API |
| Python | tree-sitter |

## Monorepo Support

`repo-slice` detects workspaces and scopes searches to the nearest workspace by default, with optional cross-workspace queries.

## Determinism

Output is deterministic for a given repo state and command:

- Stable candidate scoring and tie-breakers
- Sorted file lists
- Optional `--no-timestamp` for byte-for-byte identical outputs

## Related

- [Roadmap](./roadmap.md) - Planned features and improvements
- [Limitations](./limitations.md) - Current known limitations
- [Architecture](../02-architecture/overview.md) - System design

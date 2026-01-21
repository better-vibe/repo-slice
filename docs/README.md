# repo-slice Documentation

> Deterministic CLI for extracting high-signal context bundles from repositories

## Documentation Index

| Section | Description |
|---------|-------------|
| [01-product](./01-product/) | Project overview, vision, roadmap, limitations |
| [02-architecture](./02-architecture/) | System design, data flow, project structure |
| [03-core-concepts](./03-core-concepts/) | Anchors, candidates, workspaces, glossary |
| [04-analyzers](./04-analyzers/) | TypeScript and Python language adapters |
| [05-engine](./05-engine/) | Slice engine, scoring, budget enforcement |
| [06-cli](./06-cli/) | Commands, options, examples |
| [07-configuration](./07-configuration/) | Config files, ignore patterns |
| [08-output](./08-output/) | Markdown, JSON formats, redaction |
| [09-caching](./09-caching/) | Cache location, keying, invalidation |
| [10-development](./10-development/) | Setup, testing, contributing |

---

## Quick Start

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run a basic pack command
bun run src/cli.ts pack --entry src/index.ts

# Find a symbol and its context
bun run src/cli.ts pack --symbol UserService.create --reason

# Generate context from git changes
bun run src/cli.ts pack --from-diff main...HEAD --reason
```

---

## Core Principles

1. **Determinism** - Same input produces identical output for a given repo state
2. **Budget-aware** - Strict character and token limits for AI context windows
3. **Workspace-scoped** - Fast monorepo searches by scoping to relevant workspaces
4. **Language-agnostic** - Extensible adapter system (TypeScript + Python supported)

---

## Technology Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js >= 18 |
| Package Manager | bun |
| TypeScript Analysis | TypeScript Compiler API |
| Python Analysis | tree-sitter |
| Output Formats | Markdown, JSON |

---

## Conventions

- Sections labeled **Current** describe implemented behavior
- Sections labeled **Planned** describe PRD items not yet implemented
- Paths are relative to the repository root unless stated otherwise
- Line ranges are 1-indexed

---

## Quick Links

- [CLI Commands](./06-cli/commands.md)
- [CLI Options](./06-cli/options.md)
- [CLI Examples](./06-cli/examples.md)
- [Data Flow](./02-architecture/data-flow.md)
- [Configuration](./07-configuration/overview.md)
- [Output Formats](./08-output/overview.md)

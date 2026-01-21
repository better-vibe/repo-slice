# Project Structure

## Purpose

This document describes the source code organization and directory conventions.

## Directory Layout

```
src/
├── cli.ts                 # Entry point, argument parsing
├── config.ts              # Configuration loading and merging
├── ignore.ts              # Ignore pattern handling
├── redact.ts              # Sensitive value redaction
│
├── adapters/              # Language-specific analyzers
│   ├── index.ts           # Adapter registry and selection
│   ├── types.ts           # Shared adapter interfaces
│   ├── ts/                # TypeScript/JavaScript adapter
│   │   └── index.ts
│   └── python/            # Python adapter
│       └── index.ts
│
├── anchors/               # Anchor input parsers
│   ├── index.ts           # Anchor type definitions
│   ├── diff.ts            # Git diff parsing
│   └── log.ts             # Error log parsing
│
├── cache/                 # Caching system
│   ├── index.ts           # Cache manager
│   └── types.ts           # Cache data structures
│
├── commands/              # CLI command implementations
│   ├── help.ts            # Help command
│   ├── pack.ts            # Pack command
│   ├── version.ts         # Version command
│   └── workspaces.ts      # Workspaces command
│
├── engine/                # Core slicing engine
│   ├── budget.ts          # Budget enforcement
│   ├── candidates.ts      # Candidate generation and scoring
│   ├── expand.ts          # Import graph expansion
│   └── types.ts           # Engine data structures
│
├── output/                # Output renderers
│   ├── markdown.ts        # Markdown format
│   └── json.ts            # JSON format
│
├── pack/                  # Pack orchestration
│   └── runPack.ts         # Main pack workflow
│
├── utils/                 # Shared utilities
│   ├── fs.ts              # File system helpers
│   ├── hash.ts            # Hashing utilities
│   ├── lang.ts            # Language detection
│   ├── log.ts             # Logging utilities
│   ├── path.ts            # Path manipulation
│   └── snippet.ts         # Code snippet extraction
│
└── workspaces/            # Workspace detection
    ├── detectNode.ts      # Node.js workspace detection
    ├── detectPython.ts    # Python workspace detection
    ├── detectWorkspaces.ts # Main detection orchestrator
    ├── repoRoot.ts        # Repository root detection
    ├── scope.ts           # Workspace scoping logic
    └── types.ts           # Workspace data structures
```

## Module Responsibilities

### Core Modules

| Module | Purpose |
|--------|---------|
| `cli.ts` | Parse arguments, dispatch to commands |
| `config.ts` | Load and merge configuration sources |
| `ignore.ts` | Combine and apply ignore patterns |
| `redact.ts` | Pattern-based sensitive data removal |

### adapters/

Language-specific source code analysis. Each adapter implements:
- Import graph building
- Symbol resolution
- Reference finding

### anchors/

Input parsing for different anchor types:
- Diff parsing extracts changed file ranges
- Log parsing extracts error locations

### cache/

Persistence layer for indexing results:
- File stat tracking for invalidation
- Import graph storage
- Version-based cache keying

### commands/

CLI command implementations, each handling a specific subcommand.

### engine/

Core slicing logic:
- `candidates.ts` - Generate and score candidates
- `expand.ts` - Follow import graphs
- `budget.ts` - Apply size limits

### output/

Bundle rendering in different formats.

### workspaces/

Monorepo workspace detection and scoping.

## Related

- [Architecture Overview](./overview.md)
- [Data Flow](./data-flow.md)

# Analyzers

Analyzers (also called adapters) provide language-specific indexing and symbol resolution. Each workspace can host multiple analyzers simultaneously.

## Supported Languages

| Language | Analyzer | Parser |
|----------|----------|--------|
| TypeScript / JavaScript | [TypeScript Adapter](./typescript.md) | TypeScript Compiler API |
| Python | [Python Adapter](./python.md) | tree-sitter |

## How Analyzers Work

1. **Indexing** - Parse source files and build an import graph
2. **Symbol Resolution** - Locate symbol definitions matching queries
3. **Reference Finding** - Discover usages of symbols across the codebase
4. **Scoring** - Rank references by proximity to anchor files

## Mixed Workspaces

When a workspace contains both TypeScript and Python files, both analyzers are activated. Results from each analyzer are merged and scored together.

## Related

- [TypeScript Adapter](./typescript.md)
- [Python Adapter](./python.md)
- [Slice Engine](../05-engine/overview.md)

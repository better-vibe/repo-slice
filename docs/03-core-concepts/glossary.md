# Glossary

## Purpose

Definitions of key terms used throughout the repo-slice documentation.

## Terms

| Term | Definition |
|------|------------|
| **Anchor** | Input that seeds context selection (entry, symbol, diff, log). See [Anchors](./anchors.md). |
| **Bundle** | The final Markdown or JSON output produced by repo-slice. |
| **Call graph** | Directed graph of function/method call relationships. See [Graph JSON](../08-output/graph-json.md). |
| **Candidate** | A file or snippet considered for inclusion in the bundle. See [Candidates](./candidates.md). |
| **Collapse mode** | Strategy for simplifying graphs by grouping nodes (none, external, file, class). See [CLI Options](../06-cli/options.md). |
| **DOT format** | Graphviz text format for graph visualization. See [DOT Format](../08-output/dot.md). |
| **Snippet** | A line-range excerpt from a file, as opposed to a full file. |
| **Workspace** | A logical project root in a monorepo. See [Workspaces](./workspaces.md). |
| **Import graph** | Directed graph of module dependencies used for context expansion. |
| **Adapter** | Language-specific analyzer for indexing and symbol resolution. See [Analyzers](../04-analyzers/overview.md). |
| **Budget** | Character or token limit for the output bundle. See [Budgets](../05-engine/budgets.md). |
| **Redaction** | Replacement of sensitive values with `[REDACTED]`. See [Redaction](../08-output/redaction.md). |

## Related

- [Anchors](./anchors.md)
- [Candidates](./candidates.md)
- [Workspaces](./workspaces.md)

# Output Formats

**File:** `src/output/`

## Purpose

repo-slice commands produce different output formats depending on the command and use case.

## Pack Command Formats

The `pack` command emits context bundles in Markdown (default) or JSON.

| Format | Flag | Use Case |
|--------|------|----------|
| [Markdown](./markdown.md) | `--format md` | Copy/paste into AI chats, human-readable |
| [JSON](./json.md) | `--format json` | Tooling integration, programmatic access |

```bash
# Markdown (default)
repo-slice pack --entry src/index.ts

# JSON
repo-slice pack --entry src/index.ts --format json
```

### Reasons and Omitted Items

The `--reason` flag controls whether inclusion reasons and omitted items are shown:

| Flag | Behavior |
|------|----------|
| Without `--reason` | Reasons stripped, no omitted list |
| With `--reason` | Reasons included, omitted items listed |

```bash
repo-slice pack --entry src/index.ts --reason
```

## Graph Command Formats

The `graph` command emits dependency graphs in JSON (default) or DOT format.

| Format | Flag | Use Case |
|--------|------|----------|
| [Graph JSON](./graph-json.md) | `--format json` | Tooling integration, programmatic access |
| [DOT](./dot.md) | `--format dot` | Visualization with Graphviz |

```bash
# JSON (default)
repo-slice graph --entry src/index.ts

# DOT for visualization
repo-slice graph --entry src/index.ts --format dot
```

## Planned

- Stable IDs in JSON output
- Customizable Markdown templates

## Related

- [Markdown Format](./markdown.md)
- [JSON Format](./json.md)
- [Graph JSON Format](./graph-json.md)
- [DOT Format](./dot.md)
- [Redaction](./redaction.md)

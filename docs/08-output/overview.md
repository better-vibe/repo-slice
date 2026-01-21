# Output Formats

**File:** `src/output/`

## Purpose

repo-slice can emit context bundles in two formats: Markdown (default) and JSON. Choose the format based on your workflow.

## Available Formats

| Format | Flag | Use Case |
|--------|------|----------|
| [Markdown](./markdown.md) | `--format md` | Copy/paste into AI chats, human-readable |
| [JSON](./json.md) | `--format json` | Tooling integration, programmatic access |

## Selecting a Format

```bash
# Markdown (default)
repo-slice pack --entry src/index.ts

# JSON
repo-slice pack --entry src/index.ts --format json
```

## Reasons and Omitted Items

The `--reason` flag controls whether inclusion reasons and omitted items are shown:

| Flag | Behavior |
|------|----------|
| Without `--reason` | Reasons stripped, no omitted list |
| With `--reason` | Reasons included, omitted items listed |

```bash
repo-slice pack --entry src/index.ts --reason
```

## Planned

- Stable IDs in JSON output
- Customizable Markdown templates

## Related

- [Markdown Format](./markdown.md)
- [JSON Format](./json.md)
- [Redaction](./redaction.md)

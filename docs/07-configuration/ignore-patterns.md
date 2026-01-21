# Ignore Patterns

**File:** `src/ignore.ts`

## Purpose

Ignore patterns control which files are excluded from indexing and output.

## Pattern Sources

Ignore patterns are combined from multiple sources:

| Source | Description |
|--------|-------------|
| `.gitignore` | Standard git ignore file |
| `.repo-sliceignore` | repo-slice specific ignore file |
| Config `ignore` array | Patterns in `.repo-slicerc.json` |

## Always Ignored

The following are always ignored regardless of configuration:

- `node_modules/`

## Default Patterns

```json
{
  "ignore": [
    "**/dist/**",
    "**/.next/**",
    "**/build/**",
    "**/*.snap"
  ]
}
```

## Pattern Syntax

Patterns use glob syntax:

| Pattern | Matches |
|---------|---------|
| `**/dist/**` | Any `dist` directory at any depth |
| `**/*.snap` | Any `.snap` file at any depth |
| `*.log` | Log files in root only |
| `tests/**/*.fixture.ts` | Fixture files in tests directory |

## Example: .repo-sliceignore

Create a `.repo-sliceignore` file in your repository root:

```
# Generated files
**/generated/**
**/*.gen.ts

# Large assets
**/assets/**
**/*.pdf

# Vendor code
**/vendor/**
```

## Related

- [Configuration Overview](./overview.md)

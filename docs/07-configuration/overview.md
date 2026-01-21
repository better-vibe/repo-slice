# Configuration

**File:** `src/config.ts`

## Purpose

Configuration controls default behavior for budgets, workspace detection, ignore patterns, and redaction.

## Loading Order

Configuration is loaded from JSON files and merged in order:

1. `repoRoot/.repo-slicerc.json` - Repository-wide defaults
2. `workspaceRoot/.repo-slicerc.json` - Workspace overrides
3. CLI flags - Override both config files

## Default Configuration

```json
{
  "budgetChars": 28000,
  "depth": 2,
  "includeTests": "auto",
  "ignore": ["**/dist/**", "**/.next/**", "**/build/**", "**/*.snap"],
  "workspaces": {
    "mode": "auto",
    "pythonImportRoots": ["src", "."]
  },
  "redact": {
    "enabled": false,
    "patterns": [
      "BEGIN PRIVATE KEY",
      "AWS_SECRET_ACCESS_KEY",
      "API_KEY=",
      "SECRET_KEY="
    ]
  }
}
```

## Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `budgetChars` | number | `28000` | Hard character cap |
| `depth` | number | `2` | Import graph expansion depth |
| `includeTests` | `"auto"` \| `true` \| `false` | `"auto"` | Include test files |
| `ignore` | string[] | See above | Additional ignore globs |
| `workspaces.mode` | `"auto"` \| `"all"` | `"auto"` | Workspace selection mode |
| `workspaces.pythonImportRoots` | string[] | `["src", "."]` | Python module roots |
| `redact.enabled` | boolean | `false` | Enable redaction by default |
| `redact.patterns` | string[] | See above | Patterns to redact |

## Example: Custom Configuration

```json
{
  "budgetChars": 50000,
  "depth": 3,
  "includeTests": true,
  "ignore": ["**/generated/**"],
  "workspaces": {
    "pythonImportRoots": ["lib", "src"]
  }
}
```

## Related

- [Ignore Patterns](./ignore-patterns.md)
- [CLI Options](../06-cli/options.md)
- [Redaction](../08-output/redaction.md)

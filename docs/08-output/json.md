# JSON Format

**File:** `src/output/json.ts`

## Purpose

JSON output is designed for tooling integration and programmatic access to the context bundle.

## Structure (Current)

```json
{
  "meta": {
    "repoRoot": "/path/to/repo",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "command": "repo-slice pack --entry src/index.ts",
    "scope": {
      "mode": "auto",
      "workspaces": ["packages/core"]
    },
    "budget": {
      "chars": 28000,
      "usedChars": 12000,
      "tokens": 7000
    }
  },
  "items": [
    {
      "kind": "snippet",
      "lang": "ts",
      "filePath": "src/services/user.ts",
      "workspaceRoot": "packages/core",
      "range": {
        "start": 10,
        "end": 25
      },
      "content": "...",
      "reasons": ["symbol definition"]
    }
  ],
  "omitted": [
    {
      "filePath": "src/utils/helpers.ts",
      "reason": "budget exceeded",
      "score": 50
    }
  ]
}
```

## Fields

### meta

| Field | Description |
|-------|-------------|
| `repoRoot` | Absolute path to repository root |
| `generatedAt` | ISO timestamp (omitted with `--no-timestamp`) |
| `command` | Full command that generated this output |
| `scope.mode` | Workspace selection mode |
| `scope.workspaces` | List of included workspaces |
| `budget.chars` | Character budget limit |
| `budget.usedChars` | Characters actually used |
| `budget.tokens` | Estimated token count |

### items

| Field | Description |
|-------|-------------|
| `kind` | `"file"` or `"snippet"` |
| `lang` | Language identifier (e.g., `"ts"`, `"py"`) |
| `filePath` | Relative path within workspace |
| `workspaceRoot` | Workspace containing this file |
| `range` | Line range for snippets |
| `content` | The actual code content |
| `reasons` | Why this item was included (with `--reason`) |

### omitted

| Field | Description |
|-------|-------------|
| `filePath` | Path of omitted file |
| `reason` | Why it was omitted |
| `score` | Relevance score |

## Usage

```bash
repo-slice pack --entry src/index.ts --format json --out bundle.json
```

## Planned

- Stable IDs for items to enable diffing between runs

## Related

- [Output Overview](./overview.md)
- [Markdown Format](./markdown.md)

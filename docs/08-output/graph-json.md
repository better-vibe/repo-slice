# Graph JSON Format

**File:** `src/graph/types.ts`

## Purpose

Graph JSON output provides structured dependency data for tooling integration and programmatic analysis. Use this format for custom visualizations, CI checks, or further processing.

## Usage

```bash
repo-slice graph --entry src/index.ts --format json --out graph.json
```

## Structure

```json
{
  "meta": {
    "repoRoot": ".",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "command": "repo-slice graph --entry src/cli.ts",
    "scope": {
      "mode": "auto",
      "workspaces": ["repo-slice"]
    },
    "graphType": "imports",
    "depth": 2,
    "maxNodes": 500,
    "maxEdges": 2000,
    "collapse": "external",
    "truncated": false
  },
  "nodes": [
    {
      "id": "ts:src/cli.ts",
      "kind": "file",
      "lang": "ts",
      "name": "cli.ts",
      "filePath": "src/cli.ts",
      "workspaceRoot": ".",
      "anchor": true,
      "external": false,
      "confidence": 1.0
    }
  ],
  "edges": [
    {
      "from": "ts:src/cli.ts",
      "to": "ts:src/commands/graph.ts",
      "type": "imports",
      "confidence": 1.0
    }
  ]
}
```

## Fields

### meta

| Field | Description |
|-------|-------------|
| `repoRoot` | Relative path to repository root from cwd |
| `generatedAt` | ISO timestamp (omitted with `--no-timestamp`) |
| `command` | Full command that generated this output |
| `scope.mode` | Workspace selection mode (`auto`, `explicit`, `all`) |
| `scope.workspaces` | List of included workspace IDs |
| `graphType` | Graph type: `imports`, `calls`, or `combined` |
| `depth` | Traversal depth from anchors |
| `maxNodes` | Maximum node limit |
| `maxEdges` | Maximum edge limit |
| `collapse` | Collapse mode used |
| `truncated` | Whether the graph was truncated |
| `truncatedNodes` | Number of nodes removed (if truncated) |
| `truncatedEdges` | Number of edges removed (if truncated) |

### nodes

| Field | Description |
|-------|-------------|
| `id` | Unique node identifier (format: `lang:path` or `lang:path#symbol`) |
| `kind` | Node kind: `file`, `module`, `function`, `method`, `constructor`, `class` |
| `lang` | Language: `ts` or `py` |
| `name` | Display name for the node |
| `filePath` | Relative file path within repo |
| `range` | Optional line range (`startLine`, `endLine`, `startCol`, `endCol`) |
| `workspaceRoot` | Workspace containing this node |
| `anchor` | Whether this node originated from an anchor |
| `external` | Whether this is an external dependency |
| `confidence` | Resolution confidence (0.0 to 1.0) |

### edges

| Field | Description |
|-------|-------------|
| `from` | Source node ID |
| `to` | Target node ID |
| `type` | Edge type (see below) |
| `callsite` | Optional call location (`filePath`, `range`) |
| `confidence` | Edge confidence (0.0 to 1.0) |

## Edge Types

| Type | Description |
|------|-------------|
| `imports` | Module import relationship |
| `tests` | Test file imports subject under test |
| `calls` | Direct function/method call |
| `calls-dynamic` | Dynamic/computed call (lower confidence) |
| `calls-unknown` | Unresolved call target |

## Node Kinds

| Kind | Description |
|------|-------------|
| `file` | File-level node (used with `--collapse file`) |
| `module` | External module or collapsed external |
| `function` | Standalone function |
| `method` | Class method |
| `constructor` | Class constructor |
| `class` | Class definition (used with `--collapse class`) |

## Truncation

When the graph exceeds `--max-nodes` or `--max-edges`, it is truncated:

- Anchor nodes are preserved
- Higher-confidence edges are kept
- `meta.truncated` is set to `true`
- `meta.truncatedNodes` and `meta.truncatedEdges` report removed counts

```json
{
  "meta": {
    "truncated": true,
    "truncatedNodes": 45,
    "truncatedEdges": 120
  }
}
```

## Example: Processing with jq

```bash
# Count nodes by kind
repo-slice graph --entry src/index.ts --format json | \
  jq '.nodes | group_by(.kind) | map({kind: .[0].kind, count: length})'

# List all anchor nodes
repo-slice graph --entry src/index.ts --format json | \
  jq '.nodes | map(select(.anchor)) | .[].name'

# Find nodes with low confidence
repo-slice graph --entry src/index.ts --format json | \
  jq '.nodes | map(select(.confidence < 0.8))'
```

## Determinism

With `--no-timestamp`, JSON output is deterministic:

```bash
repo-slice graph --entry src/index.ts --format json --no-timestamp
```

Nodes and edges are sorted alphabetically by ID to ensure reproducible output across runs.

## Related

- [Output Overview](./overview.md)
- [DOT Format](./dot.md)
- [CLI Options](../06-cli/options.md)

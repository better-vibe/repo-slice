# CLI Commands

**File:** `src/cli.ts`

## Available Commands

| Command | Description |
|---------|-------------|
| `repo-slice pack` | Generate a context bundle |
| `repo-slice graph` | Generate dependency graphs |
| `repo-slice workspaces` | List detected workspaces |
| `repo-slice version` | Print CLI version |
| `repo-slice help` | Show help information |

## pack

The primary command for generating context bundles. Accepts anchors (entry files, symbols, diffs, logs) and produces a Markdown or JSON output.

```bash
repo-slice pack --entry src/index.ts
```

See [Options](./options.md) for all available flags.

## graph

Generate dependency graphs from anchors. Supports import graphs, call graphs, or combined graphs. Output can be JSON (for tooling) or DOT (for visualization with Graphviz).

```bash
# Import graph from entry file
repo-slice graph --entry src/index.ts

# Call graph with DOT output
repo-slice graph --entry src/index.ts --graph-type calls --format dot

# Combined graph to file
repo-slice graph --symbol UserService --graph-type combined --out deps.json
```

See [Options](./options.md) for graph-specific flags and [Examples](./examples.md) for more usage patterns.

## workspaces

Lists all detected workspaces in the repository, useful for debugging workspace detection.

```bash
repo-slice workspaces
```

## version

Prints the current CLI version.

```bash
repo-slice version
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Runtime error |
| `2` | Anchor resolution failure (e.g., symbol not found) |
| `3` | Invalid CLI usage |

## Related

- [Options](./options.md)
- [Examples](./examples.md)

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

The primary command for generating context bundles. Accepts anchors (entry files, symbols, diffs, logs, folders) and produces a Markdown or JSON output.

### Basic Usage

```bash
# Entry file anchor
repo-slice pack --entry src/index.ts

# Symbol anchor
repo-slice pack --symbol UserService

# Folder anchor (no import parsing)
repo-slice pack --folder docs/
```

### Folder Packing

The `--folder` option packs all files in a directory without import graph traversal:

```bash
# Pack documentation
repo-slice pack --folder docs/

# Pack with size limit (skip files > 5MB)
repo-slice pack --folder assets/ --folder-max-size 5

# Include hidden files
repo-slice pack --folder config/ --folder-include-hidden

# Mix with entry files
repo-slice pack --entry src/app.ts --folder public/
```

**Folder Packing Behavior:**
- All files included as-is (text files with content, binary files with metadata)
- No import graph analysis (different from `--entry`)
- Respects `.gitignore` patterns
- Files exceeding `--folder-max-size` listed in omitted section
- Empty directories explicitly tracked

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

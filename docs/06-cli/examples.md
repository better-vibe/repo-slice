# CLI Examples

Common usage patterns for `repo-slice pack`.

## Basic Usage

### Entry File

Generate a context bundle starting from an entry file:

```bash
repo-slice pack --entry apps/web/src/main.ts
```

### Symbol Query

Find a symbol and its context:

```bash
repo-slice pack --symbol UserService.create --reason
```

## Diff-Based Context

Generate context for changes between branches:

```bash
repo-slice pack --from-diff main...HEAD --reason
```

## Log-Based Context

Parse error logs to find relevant code:

```bash
repo-slice pack --from-log ./logs/pytest.txt --reason
```

## Monorepo Usage

### All Workspaces

Search across all workspaces:

```bash
repo-slice pack --symbol createUser --all-workspaces
```

### Specific Workspace

Target a specific workspace by name:

```bash
repo-slice pack --entry src/index.ts --workspace web
```

## Output Formats

### JSON Output

Generate JSON instead of Markdown:

```bash
repo-slice pack --format json --out bundle.json
```

### Deterministic Output

Omit timestamp for reproducible builds:

```bash
repo-slice pack --entry src/index.ts --no-timestamp
```

## Budget Control

### Custom Character Budget

Increase the character limit:

```bash
repo-slice pack --entry src/index.ts --budget-chars 50000
```

### Token-Based Budget

Target a specific token count:

```bash
repo-slice pack --entry src/index.ts --budget-tokens 8000
```

## Safety

### Redact Secrets

Replace sensitive values in output:

```bash
repo-slice pack --entry src/index.ts --redact
```

---

# Graph Command Examples

Common usage patterns for `repo-slice graph`.

## Basic Usage

### Import Graph

Generate an import dependency graph from an entry file:

```bash
repo-slice graph --entry src/index.ts
```

### Call Graph

Generate a function/method call graph:

```bash
repo-slice graph --entry src/index.ts --graph-type calls
```

### Combined Graph

Generate both imports and calls in one graph:

```bash
repo-slice graph --entry src/index.ts --graph-type combined
```

## Symbol-Based Graphs

### From Symbol Query

Generate a graph centered on a specific symbol:

```bash
repo-slice graph --symbol UserService.create
```

### Multiple Anchors

Combine multiple entry points:

```bash
repo-slice graph --entry src/api/routes.ts --symbol AuthMiddleware
```

## Output Formats

### JSON Output (default)

```bash
repo-slice graph --entry src/index.ts --format json --out graph.json
```

### DOT Output for Visualization

Generate DOT format for Graphviz:

```bash
repo-slice graph --entry src/index.ts --format dot --out graph.dot

# Render to PNG with Graphviz
dot -Tpng graph.dot -o graph.png

# Render to SVG
dot -Tsvg graph.dot -o graph.svg
```

## Controlling Graph Size

### Depth Control

Limit traversal depth from anchors:

```bash
# Only direct dependencies
repo-slice graph --entry src/index.ts --depth 1

# Deep traversal
repo-slice graph --entry src/index.ts --depth 5
```

### Node and Edge Limits

Prevent excessive graph size:

```bash
repo-slice graph --entry src/index.ts --max-nodes 100 --max-edges 500
```

### Include External Dependencies

Show external packages in the graph:

```bash
repo-slice graph --entry src/index.ts --include-external
```

## Collapse Modes

### No Collapse

Show all nodes individually:

```bash
repo-slice graph --entry src/index.ts --collapse none
```

### File-Level Graph

Collapse symbols to file level:

```bash
repo-slice graph --entry src/index.ts --graph-type calls --collapse file
```

### Class-Level Graph

Collapse methods to class level:

```bash
repo-slice graph --entry src/index.ts --graph-type calls --collapse class
```

## Diff-Based Graphs

### Changed Files Graph

Graph dependencies of changed files:

```bash
repo-slice graph --from-diff main...HEAD
```

## Deterministic Output

### Reproducible Builds

Omit timestamp for reproducible output:

```bash
repo-slice graph --entry src/index.ts --no-timestamp
```

## Related

- [Commands](./commands.md)
- [Options](./options.md)
- [Graph JSON Format](../08-output/graph-json.md)
- [DOT Format](../08-output/dot.md)
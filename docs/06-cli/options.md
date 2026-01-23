# CLI Options

Reference for `repo-slice pack` and `repo-slice graph` command options.

## Anchor Options

| Option | Description |
|--------|-------------|
| `--entry <path>` | Add entry file as anchor (repeatable) |
| `--symbol <query>` | Add symbol query as anchor (repeatable) |
| `--from-diff <revRange>` | Add changed files + hunks as anchors |
| `--from-log <path>` | Parse logs into file/line anchors |

## Workspace Scope Options

| Option | Default | Description |
|--------|---------|-------------|
| `--workspace <auto\|name\|path>` | `auto` | Select workspace by name or path |
| `--all-workspaces` | - | Search across all detected workspaces |
| `--fallback-all` | - | Retry across all workspaces if symbols not found |

## Selection / Budget Options

| Option | Default | Description |
|--------|---------|-------------|
| `--depth <n>` | `2` | Import graph expansion depth |
| `--budget-chars <n>` | `28000` | Hard character cap |
| `--budget-tokens <n>` | - | Soft token cap (chars/4 estimate) |
| `--include-tests <auto\|true\|false>` | `auto` | Include test files in output |

## Output Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format <md\|json>` | `md` | Output format |
| `--out <path>` | stdout | Write output to file |
| `--reason` | - | Include reasons and omitted list |
| `--no-timestamp` | - | Omit generatedAt timestamp |

## Safety / Diagnostics Options

| Option | Description |
|--------|-------------|
| `--redact` | Replace sensitive values with `[REDACTED]` |
| `--debug` | Emit diagnostics to stderr |

---

# Graph Command Options

Reference for `repo-slice graph` command options. The graph command shares anchor and workspace options with pack.

## Anchor Options (shared with pack)

| Option | Description |
|--------|-------------|
| `--entry <path>` | Add entry file as anchor (repeatable) |
| `--symbol <query>` | Add symbol query as anchor (repeatable) |
| `--symbol-strict` | Fail if any symbol resolves to multiple definitions |
| `--from-diff <revRange>` | Add changed files as anchors |
| `--from-log <path>` | Parse logs into file/line anchors |

## Workspace Scope Options (shared with pack)

| Option | Default | Description |
|--------|---------|-------------|
| `--workspace <auto\|name\|path>` | `auto` | Select workspace by name or path |
| `--all-workspaces` | - | Search across all detected workspaces |
| `--fallback-all` | - | Retry across all workspaces if symbols not found |

## Graph Control Options

| Option | Default | Description |
|--------|---------|-------------|
| `--graph-type <imports\|calls\|combined>` | `imports` | Type of dependency graph to generate |
| `--depth <n>` | `2` | Graph traversal depth from anchors |
| `--scope <symbol\|file\|workspace>` | auto | Scope level for graph nodes |
| `--include-tests <auto\|true\|false>` | `auto` | Include test files in graph |
| `--include-external` | - | Include external dependencies as nodes |
| `--max-nodes <n>` | `500` | Maximum number of nodes (truncates if exceeded) |
| `--max-edges <n>` | `2000` | Maximum number of edges (truncates if exceeded) |
| `--collapse <none\|external\|file\|class>` | `external` | Node collapse strategy |
| `--python-engine <treesitter\|pyright>` | `treesitter` | Python analysis engine |

### Graph Types

| Type | Description |
|------|-------------|
| `imports` | Module import/dependency relationships |
| `calls` | Function and method call relationships |
| `combined` | Both imports and calls in one graph |

### Collapse Modes

| Mode | Description |
|------|-------------|
| `none` | Show all nodes individually |
| `external` | Collapse external dependencies into single node |
| `file` | Collapse all symbols to file-level nodes |
| `class` | Collapse methods/constructors to class-level nodes |

## Graph Output Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format <json\|dot>` | `json` | Output format |
| `--out <path>` | stdout | Write output to file |
| `--no-timestamp` | - | Omit generatedAt timestamp for reproducibility |
| `--debug` | - | Emit diagnostics to stderr |

## Related

- [Commands](./commands.md)
- [Examples](./examples.md)
- [Configuration](../07-configuration/overview.md)
- [Graph JSON Format](../08-output/graph-json.md)
- [DOT Format](../08-output/dot.md)
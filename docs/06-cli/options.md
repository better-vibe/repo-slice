# CLI Options

Reference for all `repo-slice pack` command options.

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

## Related

- [Commands](./commands.md)
- [Examples](./examples.md)
- [Configuration](../07-configuration/overview.md)

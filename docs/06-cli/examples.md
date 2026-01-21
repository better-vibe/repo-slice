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

## Related

- [Commands](./commands.md)
- [Options](./options.md)

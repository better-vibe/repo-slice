# Anchors

**File:** `src/anchors/`

## Purpose

Anchors are the starting points for context extraction. They seed the slice engine with initial files, symbols, or code locations that are then expanded via import graphs.

## Anchor Types

| Type | Flag | Description |
|------|------|-------------|
| Entry | `--entry <path>` | A specific file to include |
| Symbol | `--symbol <query>` | A symbol to find and include |
| Diff | `--from-diff <revRange>` | Changed files from git diff |
| Log | `--from-log <path>` | File/line references from error logs |

## Entry Anchors

Entry anchors specify files directly:

```bash
repo-slice pack --entry src/index.ts
repo-slice pack --entry src/main.ts --entry src/config.ts
```

The `--entry` flag is repeatable to specify multiple entry points.

## Symbol Anchors

Symbol anchors find code by name:

```bash
repo-slice pack --symbol createUser
repo-slice pack --symbol UserService.create
repo-slice pack --symbol billing.invoice:Invoice
```

See [Analyzers](../04-analyzers/overview.md) for language-specific query formats.

## Diff Anchors

Diff anchors extract changed code from git:

```bash
repo-slice pack --from-diff main...HEAD
repo-slice pack --from-diff HEAD~3..HEAD
```

The diff parser:
- Identifies changed files
- Extracts modified line ranges as snippets
- Scores diff hunks highly for relevance

## Log Anchors

Log anchors parse error output to find relevant code:

```bash
repo-slice pack --from-log ./pytest.log
repo-slice pack --from-log ./tsc-errors.txt
```

Supported log formats:
- TypeScript compiler (`tsc`) errors
- pytest output

The log parser extracts file paths and line numbers from stack traces and error messages.

## Combining Anchors

Multiple anchor types can be combined:

```bash
repo-slice pack \
  --entry src/index.ts \
  --symbol UserService \
  --from-diff main...HEAD
```

All anchors contribute to the initial candidate set, which is then expanded and scored together.

## Related

- [Candidates](./candidates.md)
- [Engine Overview](../05-engine/overview.md)
- [CLI Options](../06-cli/options.md)

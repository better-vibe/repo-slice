# Budget Enforcement

**File:** `src/engine/budget.ts`

## Purpose

Budget enforcement ensures the output bundle stays within size limits, making it suitable for AI context windows and copy/paste workflows.

## How It Works (Current)

- Items are included in ranked order until budget is exhausted
- Higher-scored candidates are included first
- Omitted items are listed when `--reason` is enabled

## Budget Types

| Budget | Flag | Default | Type |
|--------|------|---------|------|
| Characters | `--budget-chars` | 28000 | Hard cap |
| Tokens | `--budget-tokens` | - | Soft cap (chars / 4 estimate) |

## Character Budget

The `--budget-chars` flag sets a hard character limit. Once this limit is reached, no additional candidates are included.

```bash
repo-slice pack --entry src/index.ts --budget-chars 50000
```

## Token Budget

The `--budget-tokens` flag provides token-based budgeting using a `chars / 4` estimation. This is useful when targeting specific LLM context windows.

```bash
repo-slice pack --entry src/index.ts --budget-tokens 8000
```

## Viewing Omitted Items

Use the `--reason` flag to see which items were omitted and why:

```bash
repo-slice pack --entry src/index.ts --reason
```

## Related

- [Engine Overview](./overview.md)
- [Scoring](./scoring.md)
- [CLI Options](../06-cli/options.md)

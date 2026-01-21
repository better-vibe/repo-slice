# Scoring

**File:** `src/engine/candidates.ts`

## Purpose

The scoring system assigns numeric relevance scores to candidates, determining their priority for inclusion in the output bundle.

## Anchor Scores (Current)

| Anchor Type | Score Level |
|-------------|-------------|
| Symbol definition | High |
| Diagnostic snippet | High |
| Diff hunk snippet | High |
| Entry file | High |

## Expansion Scores (Current)

| Import Distance | Score Level |
|-----------------|-------------|
| Distance 1 | High |
| Distance 2 | Medium |
| Distance 3+ | Low (if depth allows) |

## Additional Boosts

| Boost Type | Description |
|------------|-------------|
| Barrel files | `index.ts`, `index.js`, etc. |
| Config files | `next.config.*`, `vite.config.*`, etc. |
| Related tests | Controlled by `--include-tests` flag |

## Planned

- More nuanced size penalties for large files
- Improved extraction of API surfaces for oversized anchors

## Related

- [Engine Overview](./overview.md)
- [Budgets](./budgets.md)

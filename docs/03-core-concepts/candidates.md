# Candidates

**File:** `src/engine/candidates.ts`

## Purpose

Candidates are the units of code considered for inclusion in the output bundle. The engine generates, scores, and selects candidates to produce the final context.

## Candidate Types

| Kind | Description |
|------|-------------|
| `file` | Full file content |
| `snippet` | A line-range excerpt from a file |

## Candidate Properties

Each candidate includes:

| Property | Type | Description |
|----------|------|-------------|
| `kind` | `"file"` \| `"snippet"` | Type of candidate |
| `filePath` | string | Path relative to workspace |
| `workspaceRoot` | string | Workspace containing the file |
| `score` | number | Relevance score |
| `reasons` | string[] | Why this candidate was included |
| `estimatedChars` | number | Size estimate for budgeting |
| `range` | object | Start/end lines (snippets only) |

## Candidate Lifecycle

```mermaid
graph LR
    A[Anchor Resolution] --> B[Initial Candidates]
    B --> C[Context Expansion]
    C --> D[Scoring]
    D --> E[Budget Selection]
    E --> F[Output Bundle]
```

### 1. Generation

Initial candidates are created from anchors:
- Entry files become file candidates
- Symbol matches become snippet candidates
- Diff hunks become snippet candidates
- Log references become snippet candidates

### 2. Expansion

Candidates are expanded via import graphs:
- Follow imports up to `--depth` levels
- Related files (tests, configs) may be added
- Each expansion level decreases score

### 3. Scoring

Candidates receive scores based on:
- Anchor type (symbol definition = high)
- Import distance (closer = higher)
- Special boosts (barrel files, configs)

### 4. Selection

Candidates are selected by budget:
- Sort by score (descending)
- Include until budget exhausted
- Track omitted items

## File vs Snippet

The engine prefers snippets over full files when:
- Only a portion of the file is relevant
- The file exceeds size thresholds
- Multiple distinct regions are relevant

Full files are used when:
- The entire file is relevant (e.g., small config)
- Entry file anchors

## Related

- [Anchors](./anchors.md)
- [Scoring](../05-engine/scoring.md)
- [Budgets](../05-engine/budgets.md)

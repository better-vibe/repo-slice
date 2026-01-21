# Slice Engine

**File:** `src/engine/`

## Purpose

The slice engine converts anchors into scored candidates, expands context via import graphs, and selects items within a strict budget.

## Pipeline

1. **Anchor Resolution** - Convert entry files, symbols, diffs, or logs into initial candidates
2. **Context Expansion** - Follow import graphs to discover related files
3. **Scoring** - Assign scores based on relevance and proximity
4. **Budget Selection** - Select top candidates within character/token limits
5. **Output Generation** - Render selected items as Markdown or JSON

## Candidate Model (Current)

Candidates are either:
- `file`: full file content
- `snippet`: a line-range excerpt

Each candidate includes:
- `score` - Numeric relevance score
- `reasons[]` - Why this candidate was included
- `estimatedChars` - Size estimate for budgeting
- `workspaceRoot` + `filePath` - Location information

## Deterministic Ordering

Tie-breakers are stable to ensure reproducible output:

1. score (descending)
2. kind (snippet before file)
3. file path (lexicographic)
4. snippet start line (ascending)

## Related

- [Scoring](./scoring.md)
- [Budgets](./budgets.md)
- [Anchors](../03-core-concepts/anchors.md)
- [Candidates](../03-core-concepts/candidates.md)

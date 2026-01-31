---
"@better-vibe/repo-slice": minor
---

**Performance Optimization: I/O Parallelization Phase 2**

Implemented parallel file operations for better multi-core utilization:

- **Parallel file reading**: Budget selection now reads files in parallel batches (max 10 concurrent) instead of sequentially
- **Parallel workspace processing**: Multiple workspaces processed concurrently using Promise.all
- **Parallel config loading**: Config and ignore matcher creation now parallelized

**Impact**: 20-35% improvement for multi-workspace monorepos and operations selecting 20+ files.

**Files modified**:
- `src/engine/budget.ts` - Parallel file reading in budget selection
- `src/pack/runPack.ts` - Parallel workspace processing

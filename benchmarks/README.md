# repo-slice Benchmarks

Comprehensive benchmark suite for measuring repo-slice performance across various scenarios.

## Overview

These benchmarks run the repo-slice CLI against its own codebase to measure:
- Command execution time
- Memory usage
- Output size
- Scaling characteristics with different inputs

## Quick Start

```bash
# Run all benchmarks
bun run bench

# Run specific suite
bun run bench:pack
bun run bench:graph

# Save results as baseline
bun run bench:save

# Compare against baseline
bun run bench:compare

# Export results to JSON
bun run bench --export results.json
```

## Benchmark Suites

### Pack Command (`suites/pack.bench.ts`)

Tests the core `pack` command with various scenarios:

**Entry Files:**
- Single entry (small/medium/deep graphs)
- Multiple entries
- Different traversal depths

**Symbol Resolution:**
- Simple symbols
- Type definitions
- Multiple symbols
- Strict mode

**Output Formats:**
- JSON (default)
- Markdown
- With/without reasons

**Budget Controls:**
- Small/medium/large budgets
- Character vs token budgets

**Complex Scenarios:**
- Full repository analysis
- Redaction enabled
- Test file inclusion

### Graph Command (`suites/graph.bench.ts`)

Tests the `graph` dependency analysis:

**Graph Types:**
- Import graphs
- Call graphs
- Combined graphs

**Scopes:**
- Symbol-level
- File-level
- Workspace-level

**Output Formats:**
- JSON
- DOT (Graphviz)

**Collapse Modes:**
- None
- External
- File
- Class

**Complex Scenarios:**
- Large graphs (1000+ nodes)
- With external dependencies
- Multi-entry graphs

### Infrastructure (`suites/infrastructure.bench.ts`)

Tests supporting functionality:

- Workspace detection
- Version command
- Help command

## Benchmark Structure

Each benchmark defines:

```typescript
{
  name: "benchmark-name",           // Unique identifier
  category: "Category Name",        // Grouping for reports
  command: ["pack", "--entry", "..."], // CLI arguments
  iterations: 5,                    // Number of timed runs
  warmupIterations: 1,              // Untimed warmup runs
}
```

## Results Format

Benchmarks collect:
- **Time:** Multiple iterations for statistical accuracy
- **Memory:** RSS delta during execution
- **Output Size:** Bytes of stdout
- **Exit Code:** Success/failure tracking

## Baseline Comparison

Save a baseline to track performance over time:

```bash
# Save current results as baseline
bun run bench:save

# Compare future runs against baseline
bun run bench:compare
```

Comparison indicators:
- 🟢 Faster than baseline (>10% improvement)
- ⚪ Within 10% of baseline
- 🔴 Slower than baseline (>10% regression)

Baselines are stored in `benchmarks/.baselines/latest.json`.

## Continuous Integration

Add benchmarks to CI to catch performance regressions:

```yaml
- name: Run benchmarks
  run: |
    bun run bench:compare
    # Fail if any benchmark regresses >20%
```

## Custom Benchmarks

Add new benchmarks by editing the suite files:

```typescript
// suites/pack.bench.ts
{
  name: "my-custom-benchmark",
  category: "Custom",
  command: ["pack", "--entry", "src/my/file.ts"],
  iterations: 10,
}
```

## Implementation Details

**Cache Clearing:** Benchmarks clear the `.repo-slice/cache/` directory between iterations to ensure fair comparisons.

**Warmup:** Each benchmark includes warmup iterations to stabilize JIT compilation and filesystem caches.

**Statistics:** Results report average, median, min, max, and standard deviation across iterations.

## Troubleshooting

**Benchmarks fail with "Symbol not found":**
- Symbols may have been renamed in the codebase
- Update benchmark to use valid symbol names

**Inconsistent results:**
- Close other applications
- Run on a quiet machine
- Increase iteration count

**Out of memory:**
- Reduce `--budget-chars` in benchmarks
- Use `--max-nodes` / `--max-edges` limits

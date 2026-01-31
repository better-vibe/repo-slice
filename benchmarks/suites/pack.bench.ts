/**
 * Pack command benchmarks
 * 
 * Tests various pack command scenarios to measure performance
 * of the core bundling functionality.
 */

import { BenchmarkSuite } from "../lib/runner.ts";

export const packSuite: BenchmarkSuite = {
  name: "Pack Command",
  benchmarks: [
    // Entry file scenarios
    {
      name: "single-entry-small",
      category: "Entry Files",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--no-timestamp",
        "--depth", "0",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "single-entry-medium",
      category: "Entry Files",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--no-timestamp",
        "--depth", "2",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "single-entry-deep",
      category: "Entry Files",
      command: [
        "pack",
        "--entry", "src/pack/runPack.ts",
        "--no-timestamp",
        "--depth", "5",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "multiple-entries",
      category: "Entry Files",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--entry", "src/config.ts",
        "--entry", "src/ignore.ts",
        "--no-timestamp",
        "--depth", "1",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Symbol resolution scenarios
    {
      name: "symbol-simple",
      category: "Symbol Resolution",
      command: [
        "pack",
        "--symbol", "renderHelp",
        "--no-timestamp",
        "--depth", "1",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "symbol-type",
      category: "Symbol Resolution",
      command: [
        "pack",
        "--symbol", "PackCliArgs",
        "--no-timestamp",
        "--depth", "1",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "symbol-multiple",
      category: "Symbol Resolution",
      command: [
        "pack",
        "--symbol", "renderHelp",
        "--symbol", "versionCommand",
        "--symbol", "PackCliArgs",
        "--no-timestamp",
        "--depth", "1",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "symbol-strict",
      category: "Symbol Resolution",
      command: [
        "pack",
        "--symbol", "runPack",
        "--symbol-strict",
        "--no-timestamp",
        "--depth", "1",
      ],
      iterations: 5,
      warmupIterations: 1,
    },

    // Output format scenarios
    {
      name: "format-json-default",
      category: "Output Formats",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--no-timestamp",
        "--depth", "1",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "format-md",
      category: "Output Formats",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--no-timestamp",
        "--depth", "1",
        "--format", "md",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "format-json-with-reason",
      category: "Output Formats",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--no-timestamp",
        "--depth", "1",
        "--reason",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Budget scenarios
    {
      name: "budget-small",
      category: "Budget",
      command: [
        "pack",
        "--entry", "src/pack/runPack.ts",
        "--no-timestamp",
        "--depth", "3",
        "--budget-chars", "5000",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "budget-medium",
      category: "Budget",
      command: [
        "pack",
        "--entry", "src/pack/runPack.ts",
        "--no-timestamp",
        "--depth", "3",
        "--budget-chars", "50000",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "budget-large",
      category: "Budget",
      command: [
        "pack",
        "--entry", "src/pack/runPack.ts",
        "--no-timestamp",
        "--depth", "3",
        "--budget-chars", "200000",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "budget-with-tokens",
      category: "Budget",
      command: [
        "pack",
        "--entry", "src/pack/runPack.ts",
        "--no-timestamp",
        "--depth", "3",
        "--budget-chars", "50000",
        "--budget-tokens", "10000",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Test inclusion scenarios
    {
      name: "include-tests-auto",
      category: "Test Inclusion",
      command: [
        "pack",
        "--entry", "src/engine/budget.ts",
        "--no-timestamp",
        "--depth", "2",
        "--include-tests", "auto",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "include-tests-true",
      category: "Test Inclusion",
      command: [
        "pack",
        "--entry", "src/engine/budget.ts",
        "--no-timestamp",
        "--depth", "2",
        "--include-tests", "true",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Complex scenarios
    {
      name: "complex-deep-graph",
      category: "Complex Scenarios",
      command: [
        "pack",
        "--entry", "src/adapters/index.ts",
        "--no-timestamp",
        "--depth", "3",
        "--budget-chars", "100000",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "complex-full-repo",
      category: "Complex Scenarios",
      command: [
        "pack",
        "--entry", "src/cli.ts",
        "--entry", "src/pack/runPack.ts",
        "--entry", "src/graph/runGraph.ts",
        "--no-timestamp",
        "--depth", "3",
        "--budget-chars", "100000",
      ],
      iterations: 2,
      warmupIterations: 1,
    },
    {
      name: "complex-with-redact",
      category: "Complex Scenarios",
      command: [
        "pack",
        "--entry", "src/config.ts",
        "--no-timestamp",
        "--depth", "2",
        "--redact",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
  ],
};

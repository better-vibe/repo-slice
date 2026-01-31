/**
 * Graph command benchmarks
 * 
 * Tests various graph generation scenarios to measure performance
 * of the dependency graph analysis.
 */

import { BenchmarkSuite } from "../lib/runner.ts";

export const graphSuite: BenchmarkSuite = {
  name: "Graph Command",
  benchmarks: [
    // Basic graph generation
    {
      name: "graph-imports-shallow",
      category: "Import Graph",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--graph-type", "imports",
        "--depth", "1",
        "--no-timestamp",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "graph-imports-medium",
      category: "Import Graph",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--graph-type", "imports",
        "--depth", "3",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "graph-imports-deep",
      category: "Import Graph",
      command: [
        "graph",
        "--entry", "src/pack/runPack.ts",
        "--graph-type", "imports",
        "--depth", "5",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Call graph generation
    {
      name: "graph-calls-shallow",
      category: "Call Graph",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--graph-type", "calls",
        "--depth", "1",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "graph-calls-medium",
      category: "Call Graph",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--graph-type", "calls",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Combined graph
    {
      name: "graph-combined",
      category: "Combined Graph",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--graph-type", "combined",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Output formats
    {
      name: "graph-format-json",
      category: "Output Formats",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--format", "json",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "graph-format-dot",
      category: "Output Formats",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--format", "dot",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 5,
      warmupIterations: 1,
    },

    // Symbol-based graphs
    {
      name: "graph-symbol-single",
      category: "Symbol Graph",
      command: [
        "graph",
        "--symbol", "renderHelp",
        "--graph-type", "imports",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 5,
      warmupIterations: 1,
    },
    {
      name: "graph-symbol-multiple",
      category: "Symbol Graph",
      command: [
        "graph",
        "--symbol", "renderHelp",
        "--symbol", "versionCommand",
        "--symbol", "runPack",
        "--graph-type", "imports",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Scope variations
    {
      name: "graph-scope-symbol",
      category: "Scope",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--scope", "symbol",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "graph-scope-file",
      category: "Scope",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--scope", "file",
        "--depth", "2",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Collapse modes
    {
      name: "graph-collapse-none",
      category: "Collapse Modes",
      command: [
        "graph",
        "--entry", "src/pack/runPack.ts",
        "--collapse", "none",
        "--depth", "3",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "graph-collapse-external",
      category: "Collapse Modes",
      command: [
        "graph",
        "--entry", "src/pack/runPack.ts",
        "--collapse", "external",
        "--depth", "3",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "graph-collapse-file",
      category: "Collapse Modes",
      command: [
        "graph",
        "--entry", "src/pack/runPack.ts",
        "--collapse", "file",
        "--depth", "3",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },

    // Large graphs
    {
      name: "graph-large-full-repo",
      category: "Large Graphs",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--entry", "src/pack/runPack.ts",
        "--entry", "src/graph/runGraph.ts",
        "--entry", "src/workspaces/detectWorkspaces.ts",
        "--depth", "3",
        "--max-nodes", "1000",
        "--max-edges", "5000",
        "--no-timestamp",
      ],
      iterations: 2,
      warmupIterations: 1,
    },
    {
      name: "graph-large-with-external",
      category: "Large Graphs",
      command: [
        "graph",
        "--entry", "src/cli.ts",
        "--depth", "3",
        "--include-external",
        "--max-nodes", "1000",
        "--no-timestamp",
      ],
      iterations: 2,
      warmupIterations: 1,
    },

    // Complex scenarios
    {
      name: "graph-adapters-module",
      category: "Complex Scenarios",
      command: [
        "graph",
        "--entry", "src/adapters/index.ts",
        "--graph-type", "combined",
        "--depth", "3",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
    {
      name: "graph-workspaces-module",
      category: "Complex Scenarios",
      command: [
        "graph",
        "--entry", "src/workspaces/detectWorkspaces.ts",
        "--graph-type", "combined",
        "--depth", "3",
        "--no-timestamp",
      ],
      iterations: 3,
      warmupIterations: 1,
    },
  ],
};

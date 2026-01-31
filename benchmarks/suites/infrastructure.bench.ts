/**
 * Workspaces and infrastructure benchmarks
 * 
 * Tests workspace detection and core infrastructure performance.
 */

import { BenchmarkSuite } from "../lib/runner.ts";

export const infrastructureSuite: BenchmarkSuite = {
  name: "Infrastructure",
  benchmarks: [
    // Workspaces command
    {
      name: "workspaces-list-json",
      category: "Workspaces",
      command: [
        "workspaces",
        "--format", "json",
      ],
      iterations: 10,
      warmupIterations: 2,
    },
    {
      name: "workspaces-list-text",
      category: "Workspaces",
      command: [
        "workspaces",
        "--format", "text",
      ],
      iterations: 10,
      warmupIterations: 2,
    },

    // Version command (baseline measurement)
    {
      name: "version",
      category: "Baselines",
      command: ["version"],
      iterations: 20,
      warmupIterations: 5,
    },

    // Help command
    {
      name: "help",
      category: "Baselines",
      command: ["--help"],
      iterations: 20,
      warmupIterations: 5,
    },
  ],
};

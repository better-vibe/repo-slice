/**
 * Benchmark runner infrastructure for repo-slice
 * 
 * Provides utilities for:
 * - Running benchmarks with timing
 * - Collecting memory usage statistics
 * - Comparing against baselines
 * - Generating reports
 */

import { spawn } from "bun";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";

export interface BenchmarkResult {
  name: string;
  category: string;
  iterations: number;
  times: number[];
  memoryDelta: number;
  outputSize: number;
  exitCode: number;
  error?: string;
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkDefinition[];
}

export interface BenchmarkDefinition {
  name: string;
  category: string;
  command: string[];
  iterations?: number;
  warmupIterations?: number;
  skip?: boolean;
}

export interface BaselineResult {
  timestamp: string;
  gitCommit?: string;
  results: BenchmarkResult[];
}

const REPO_ROOT = join(import.meta.dir, "..", "..");
const CLI_PATH = join(REPO_ROOT, "src", "cli.ts");
const BASELINE_PATH = join(REPO_ROOT, "benchmarks", ".baselines", "latest.json");

/**
 * Run a single benchmark
 */
export async function runBenchmark(
  def: BenchmarkDefinition
): Promise<BenchmarkResult> {
  const iterations = def.iterations ?? 5;
  const warmupIterations = def.warmupIterations ?? 1;
  const times: number[] = [];

  // Warmup runs (not measured)
  for (let i = 0; i < warmupIterations; i++) {
    await runCommand(def.command);
  }

  // Clear any cached data between runs
  await clearCache();

  // Measured runs
  let outputSize = 0;
  let exitCode = 0;
  const startMemory = process.memoryUsage.rss();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await runCommand(def.command);
    const end = performance.now();

    times.push(end - start);
    outputSize = result.stdout.length;
    exitCode = result.exitCode;

    if (result.exitCode !== 0 && !def.skip) {
      return {
        name: def.name,
        category: def.category,
        iterations: i + 1,
        times,
        memoryDelta: 0,
        outputSize,
        exitCode: result.exitCode,
        error: result.stderr.slice(0, 500),
      };
    }

    // Clear cache between iterations for fair measurement
    if (i < iterations - 1) {
      await clearCache();
    }
  }

  const endMemory = process.memoryUsage.rss();

  return {
    name: def.name,
    category: def.category,
    iterations,
    times,
    memoryDelta: endMemory - startMemory,
    outputSize,
    exitCode,
  };
}

/**
 * Run a CLI command and return output
 */
async function runCommand(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = spawn({
    cmd: ["bun", "run", CLI_PATH, ...args],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

/**
 * Clear the repo-slice cache to ensure fair benchmarks
 */
async function clearCache(): Promise<void> {
  try {
    const cacheDir = join(REPO_ROOT, ".repo-slice", "cache");
    await Bun.$`rm -rf ${cacheDir}`.quiet();
  } catch {
    // Ignore errors if cache doesn't exist
  }
}

/**
 * Run a full benchmark suite
 */
export async function runSuite(suite: BenchmarkSuite): Promise<BenchmarkResult[]> {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Running suite: ${suite.name}`);
  console.log("=".repeat(70));

  const results: BenchmarkResult[] = [];

  for (const def of suite.benchmarks) {
    if (def.skip) {
      console.log(`\n⏭️  Skipping: ${def.name}`);
      continue;
    }

    process.stdout.write(`\n⏱️  Running: ${def.name}... `);
    const start = performance.now();
    const result = await runBenchmark(def);
    const duration = performance.now() - start;

    if (result.exitCode !== 0) {
      console.log(`\n❌ Failed (${duration.toFixed(0)}ms)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    } else {
      const avg = average(result.times);
      console.log(`✅ Done - Avg: ${avg.toFixed(1)}ms`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Load baseline results for comparison
 */
export async function loadBaseline(): Promise<BaselineResult | null> {
  try {
    const content = await readFile(BASELINE_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save results as new baseline
 */
export async function saveBaseline(results: BenchmarkResult[]): Promise<void> {
  const baselineDir = join(REPO_ROOT, "benchmarks", ".baselines");
  await mkdir(baselineDir, { recursive: true });

  // Get current git commit
  let gitCommit: string | undefined;
  try {
    const proc = spawn({
      cmd: ["git", "rev-parse", "--short", "HEAD"],
      cwd: REPO_ROOT,
      stdout: "pipe",
    });
    gitCommit = (await new Response(proc.stdout).text()).trim();
  } catch {
    // Ignore git errors
  }

  const baseline: BaselineResult = {
    timestamp: new Date().toISOString(),
    gitCommit,
    results,
  };

  await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`\n💾 Baseline saved to: ${BASELINE_PATH}`);
}

/**
 * Calculate statistics
 */
export function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stdDev(values: number[]): number {
  const avg = average(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

export function min(values: number[]): number {
  return Math.min(...values);
}

export function max(values: number[]): number {
  return Math.max(...values);
}

/**
 * Format time for display
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

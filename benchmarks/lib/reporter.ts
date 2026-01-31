/**
 * Benchmark reporter with comparison against baselines
 */

import {
  BenchmarkResult,
  BaselineResult,
  average,
  median,
  stdDev,
  min,
  max,
  formatTime,
  formatBytes,
  loadBaseline,
} from "./runner.ts";

interface Comparison {
  current: number;
  baseline: number;
  delta: number;
  deltaPercent: number;
  isRegression: boolean;
}

/**
 * Generate a formatted report
 */
export async function generateReport(
  results: BenchmarkResult[],
  options: { compare?: boolean; save?: boolean } = {}
): Promise<string> {
  const baseline = options.compare ? await loadBaseline() : null;
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push("=".repeat(90));
  lines.push("REPO-SLICE BENCHMARK RESULTS".padStart(55).padEnd(90));
  lines.push("=".repeat(90));
  lines.push("");

  // Summary statistics
  const successful = results.filter((r) => r.exitCode === 0);
  const failed = results.filter((r) => r.exitCode !== 0);

  lines.push(`Total benchmarks: ${results.length}`);
  lines.push(`Successful: ${successful.length} ✅`);
  if (failed.length > 0) {
    lines.push(`Failed: ${failed.length} ❌`);
  }
  lines.push("");

  if (baseline && options.compare) {
    lines.push(`Comparing against baseline from: ${baseline.timestamp}`);
    if (baseline.gitCommit) {
      lines.push(`Baseline commit: ${baseline.gitCommit}`);
    }
    lines.push("");
  }

  // Group by category
  const byCategory = groupByCategory(successful);

  for (const [category, categoryResults] of Object.entries(byCategory)) {
    lines.push("-".repeat(90));
    lines.push(`Category: ${category}`.padEnd(90));
    lines.push("-".repeat(90));
    lines.push("");

    // Table header
    if (baseline && options.compare) {
      lines.push(
        `${"Benchmark".padEnd(40)} ${"Avg".padStart(10)} ${"Baseline".padStart(10)} ${"Δ%".padStart(8)} ${"Status".padStart(8)}`
      );
    } else {
      lines.push(
        `${"Benchmark".padEnd(40)} ${"Avg".padStart(10)} ${"Median".padStart(10)} ${"Min".padStart(10)} ${"Max".padStart(10)}`
      );
    }
    lines.push("".padEnd(90, "-"));

    for (const result of categoryResults) {
      const avg = average(result.times);
      const med = median(result.times);
      const minimum = min(result.times);
      const maximum = max(result.times);

      if (baseline && options.compare) {
        const baselineResult = baseline.results.find(
          (r) => r.name === result.name && r.category === result.category
        );

        if (baselineResult) {
          const baselineAvg = average(baselineResult.times);
          const delta = avg - baselineAvg;
          const deltaPercent = (delta / baselineAvg) * 100;
          const isRegression = delta > baselineAvg * 0.1; // 10% threshold

          const status = isRegression ? "🔴" : delta < 0 ? "🟢" : "⚪";
          const deltaStr =
            deltaPercent > 0 ? `+${deltaPercent.toFixed(1)}%` : `${deltaPercent.toFixed(1)}%`;

          lines.push(
            `${result.name.slice(0, 39).padEnd(40)} ${formatTime(avg).padStart(10)} ${formatTime(baselineAvg).padStart(10)} ${deltaStr.padStart(8)} ${status.padStart(8)}`
          );
        } else {
          lines.push(
            `${result.name.slice(0, 39).padEnd(40)} ${formatTime(avg).padStart(10)} ${"N/A".padStart(10)} ${"N/A".padStart(8)} ${"⚪".padStart(8)}`
          );
        }
      } else {
        lines.push(
          `${result.name.slice(0, 39).padEnd(40)} ${formatTime(avg).padStart(10)} ${formatTime(med).padStart(10)} ${formatTime(minimum).padStart(10)} ${formatTime(maximum).padStart(10)}`
        );
      }
    }

    lines.push("");
  }

  // Failed benchmarks
  if (failed.length > 0) {
    lines.push("-".repeat(90));
    lines.push("FAILED BENCHMARKS".padEnd(90));
    lines.push("-".repeat(90));
    lines.push("");

    for (const result of failed) {
      lines.push(`❌ ${result.category} / ${result.name}`);
      if (result.error) {
        lines.push(`   Error: ${result.error}`);
      }
      lines.push("");
    }
  }

  // Footer
  lines.push("=".repeat(90));
  lines.push("");

  if (baseline && options.compare) {
    lines.push("Legend:");
    lines.push("  🟢 = Faster than baseline (>10% improvement)");
    lines.push("  ⚪ = Within 10% of baseline");
    lines.push("  🔴 = Slower than baseline (>10% regression)");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Group results by category
 */
function groupByCategory(
  results: BenchmarkResult[]
): Record<string, BenchmarkResult[]> {
  const grouped: Record<string, BenchmarkResult[]> = {};

  for (const result of results) {
    if (!grouped[result.category]) {
      grouped[result.category] = [];
    }
    grouped[result.category].push(result);
  }

  // Sort categories
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  );
}

/**
 * Print report to console
 */
export async function printReport(
  results: BenchmarkResult[],
  options: { compare?: boolean; save?: boolean } = {}
): Promise<void> {
  const report = await generateReport(results, options);
  console.log(report);
}

/**
 * Export results to JSON for external analysis
 */
export async function exportToJSON(
  results: BenchmarkResult[],
  outputPath: string
): Promise<void> {
  const export_ = {
    timestamp: new Date().toISOString(),
    gitCommit: await getGitCommit(),
    results: results.map((r) => ({
      ...r,
      stats: {
        avg: average(r.times),
        median: median(r.times),
        min: min(r.times),
        max: max(r.times),
        stdDev: stdDev(r.times),
      },
    })),
  };

  await Bun.write(outputPath, JSON.stringify(export_, null, 2));
}

async function getGitCommit(): Promise<string | undefined> {
  try {
    const proc = Bun.spawn({
      cmd: ["git", "rev-parse", "--short", "HEAD"],
      stdout: "pipe",
    });
    return (await new Response(proc.stdout).text()).trim();
  } catch {
    return undefined;
  }
}

/**
 * Main benchmark runner for repo-slice
 * 
 * Usage:
 *   bun run benchmarks/run.ts                    # Run all benchmarks
 *   bun run benchmarks/run.ts --save             # Run and save as baseline
 *   bun run benchmarks/run.ts --compare          # Run and compare against baseline
 *   bun run benchmarks/run.ts --ci               # CI mode - fail on >20% regression
 *   bun run benchmarks/run.ts --threshold 15     # Set custom regression threshold (%)
 *   bun run benchmarks/run.ts --export results.json  # Export to JSON
 *   bun run benchmarks/run.ts --suite pack       # Run only pack benchmarks
 * 
 * Available suites:
 *   - pack          Pack command benchmarks
 *   - graph         Graph command benchmarks
 *   - infrastructure Infrastructure benchmarks
 */

import { runSuite, saveBaseline, BenchmarkResult, loadBaseline, average } from "./lib/runner.ts";
import { printReport, exportToJSON } from "./lib/reporter.ts";
import { packSuite } from "./suites/pack.bench.ts";
import { graphSuite } from "./suites/graph.bench.ts";
import { infrastructureSuite } from "./suites/infrastructure.bench.ts";

const args = process.argv.slice(2);

// Parse arguments
const shouldSave = args.includes("--save");
const shouldCompare = args.includes("--compare");
const ciMode = args.includes("--ci");
const shouldExport = args.includes("--export");
const exportPathIndex = args.indexOf("--export");
const exportPath = exportPathIndex !== -1 ? args[exportPathIndex + 1] : null;
const suiteFilterIndex = args.indexOf("--suite");
const suiteFilter = suiteFilterIndex !== -1 ? args[suiteFilterIndex + 1] : null;
const thresholdIndex = args.indexOf("--threshold");
const regressionThreshold = thresholdIndex !== -1 
  ? parseFloat(args[thresholdIndex + 1]) 
  : (ciMode ? 20 : 10); // Default: 10%, CI mode: 20%

// Define all suites
const allSuites = {
  pack: packSuite,
  graph: graphSuite,
  infrastructure: infrastructureSuite,
};

// Filter suites if specified
const suitesToRun = suiteFilter
  ? { [suiteFilter]: allSuites[suiteFilter as keyof typeof allSuites] }
  : allSuites;

if (suiteFilter && !allSuites[suiteFilter as keyof typeof allSuites]) {
  console.error(`Unknown suite: ${suiteFilter}`);
  console.error(`Available suites: ${Object.keys(allSuites).join(", ")}`);
  process.exit(1);
}

/**
 * Check for performance regressions
 */
function checkRegressions(
  results: BenchmarkResult[],
  baseline: Awaited<ReturnType<typeof loadBaseline>>,
  threshold: number
): { hasRegression: boolean; regressions: string[] } {
  if (!baseline) {
    return { hasRegression: false, regressions: [] };
  }

  const regressions: string[] = [];

  for (const result of results) {
    if (result.exitCode !== 0) continue;

    const baselineResult = baseline.results.find(
      (r) => r.name === result.name && r.category === result.category
    );

    if (baselineResult && baselineResult.exitCode === 0) {
      const currentAvg = average(result.times);
      const baselineAvg = average(baselineResult.times);
      const deltaPercent = ((currentAvg - baselineAvg) / baselineAvg) * 100;

      if (deltaPercent > threshold) {
        regressions.push(
          `${result.category}/${result.name}: +${deltaPercent.toFixed(1)}% (threshold: ${threshold}%)`
        );
      }
    }
  }

  return {
    hasRegression: regressions.length > 0,
    regressions,
  };
}

async function main(): Promise<void> {
  console.log("🏁 Starting repo-slice benchmarks");
  console.log(`📅 ${new Date().toISOString()}`);
  if (ciMode || shouldCompare) {
    console.log(`📊 Regression threshold: ${regressionThreshold}%`);
  }
  console.log("");

  const allResults: BenchmarkResult[] = [];

  // Run each suite
  for (const [name, suite] of Object.entries(suitesToRun)) {
    if (!suite) {
      console.log(`⚠️ Suite '${name}' not found, skipping`);
      continue;
    }

    try {
      const results = await runSuite(suite);
      allResults.push(...results);
    } catch (error) {
      console.error(`\n❌ Suite '${name}' failed:`, error);
    }
  }

  // Generate and print report
  await printReport(allResults, { compare: shouldCompare || ciMode, save: shouldSave });

  // Check for regressions in CI mode
  if (ciMode || shouldCompare) {
    const baseline = await loadBaseline();
    if (baseline) {
      const { hasRegression, regressions } = checkRegressions(
        allResults,
        baseline,
        regressionThreshold
      );

      if (hasRegression) {
        console.log("\n🔴 PERFORMANCE REGRESSIONS DETECTED:");
        regressions.forEach((r) => console.log(`   - ${r}`));
        
        if (ciMode) {
          console.log("\n❌ CI check failed due to performance regressions");
          process.exit(2);
        }
      } else {
        console.log("\n✅ No significant performance regressions detected");
      }
    } else if (ciMode) {
      console.log("\n⚠️ No baseline found for comparison");
      console.log("   Run 'bun run bench:save' to create a baseline");
    }
  }

  // Export to JSON if requested
  if (shouldExport && exportPath) {
    await exportToJSON(allResults, exportPath);
    console.log(`📄 Results exported to: ${exportPath}`);
  }

  // Save baseline if requested
  if (shouldSave) {
    await saveBaseline(allResults);
  }

  // Exit with error code if any benchmarks failed
  const failed = allResults.filter((r) => r.exitCode !== 0);
  if (failed.length > 0) {
    console.log(`\n❌ ${failed.length} benchmark(s) failed`);
    process.exit(1);
  }

  console.log("\n✅ All benchmarks completed successfully");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

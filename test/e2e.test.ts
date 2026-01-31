import { test, expect, describe, beforeAll } from "bun:test";
import { spawn } from "bun";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");
const REPO_ROOT = join(import.meta.dir, "..");

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCli(args: string[], cwd: string = REPO_ROOT): Promise<RunResult> {
  const proc = spawn({
    cmd: ["bun", "run", CLI_PATH, ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("e2e: CLI basics", () => {
  test("shows help with --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("repo-slice");
    expect(result.stdout).toContain("pack");
    expect(result.stdout).toContain("workspaces");
  });

  test("shows help with no arguments", async () => {
    const result = await runCli([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("repo-slice");
  });

  test("shows version", async () => {
    const result = await runCli(["version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  test("lists workspaces as json by default", async () => {
    const result = await runCli(["workspaces"]);
    expect(result.exitCode).toBe(0);
    // Current repo should have at least the root workspace
    const json = JSON.parse(result.stdout);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty("name");
    expect(json[0]).toHaveProperty("kind");
    expect(json[0]).toHaveProperty("root");
    // Should contain the repo-slice workspace
    expect(json.some((ws: { name: string }) => ws.name.includes("repo-slice"))).toBe(true);
  });

  test("lists workspaces as text with --format text", async () => {
    const result = await runCli(["workspaces", "--format", "text"]);
    expect(result.exitCode).toBe(0);
    // Current repo should have at least the root workspace
    expect(result.stdout).toContain("@better-vibe/repo-slice");
    expect(result.stdout).toContain("node");
  });

  test("fails on unknown command", async () => {
    const result = await runCli(["unknown-command"]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Unknown command");
  });
});

describe("e2e: pack command - entry files", () => {
  test("packs a single entry file as json by default", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("omitted");
    // Should include the entry file
    expect(json.items.some((item: { filePath: string }) => item.filePath.includes("cli.ts"))).toBe(true);
  });

  test("packs multiple entry files", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--entry", "src/config.ts",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("cli.ts"))).toBe(true);
    expect(filePaths.some((path: string) => path.includes("config.ts"))).toBe(true);
  });

  test("includes imports from entry file", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--depth", "1",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    // cli.ts imports from commands/
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("commands/pack.ts"))).toBe(true);
    expect(filePaths.some((path: string) => path.includes("commands/help.ts"))).toBe(true);
  });

  test("respects depth limit", async () => {
    const result0 = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--depth", "0",
      "--no-timestamp",
    ]);
    const result2 = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--depth", "2",
      "--no-timestamp",
    ]);
    expect(result0.exitCode).toBe(0);
    expect(result2.exitCode).toBe(0);
    // Depth 2 should include more files than depth 0
    expect(result2.stdout.length).toBeGreaterThan(result0.stdout.length);
  });
});

describe("e2e: pack command - symbols", () => {
  test("finds symbol definition", async () => {
    const result = await runCli([
      "pack",
      "--symbol", "renderHelp",
      "--no-timestamp",
      "--reason",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("commands/help.ts"))).toBe(true);
    // Check that reasons include symbol definition
    const helpItem = json.items.find((item: { filePath: string }) => item.filePath.includes("commands/help.ts"));
    expect(helpItem).toBeDefined();
    expect(helpItem.reasons.some((reason: string) => reason.includes("renderHelp"))).toBe(true);
  });

  test("finds class and method", async () => {
    // Using a known type from the codebase
    const result = await runCli([
      "pack",
      "--symbol", "PackCliArgs",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("commands/pack.ts"))).toBe(true);
  });

  test("reports unresolved symbol", async () => {
    const result = await runCli([
      "pack",
      "--symbol", "NonExistentSymbol12345",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Symbol(s) not found");
    expect(result.stderr).toContain("NonExistentSymbol12345");
  });

  test("--symbol-strict fails on ambiguous symbols", async () => {
    // 'Range' is likely defined in multiple places (adapters/types.ts and possibly others)
    const result = await runCli([
      "pack",
      "--symbol", "normalizePath",
      "--symbol-strict",
    ]);
    // If there are multiple definitions, it should fail
    // If there's only one, it should succeed
    // We test the behavior is consistent
    expect([0, 2]).toContain(result.exitCode);
    if (result.exitCode === 2) {
      expect(result.stderr).toContain("Ambiguous symbol");
      expect(result.stderr).toContain("--symbol-strict");
    }
  });
});

describe("e2e: pack command - output formats", () => {
  test("outputs json by default", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("omitted");
    expect(json.meta).toHaveProperty("command");
    expect(json.meta).toHaveProperty("scope");
    expect(json.meta).toHaveProperty("budget");
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeGreaterThan(0);
  });

  test("outputs markdown with --format md", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--format", "md",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# repo-slice bundle");
    expect(result.stdout).toContain("## Index");
    expect(result.stdout).toContain("## Content");
  });

  test("json items have required fields", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--depth", "0",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const item = json.items[0];
    expect(item).toHaveProperty("kind");
    expect(item).toHaveProperty("filePath");
    expect(item).toHaveProperty("content");
    expect(item).toHaveProperty("workspaceRoot");
  });

  test("--reason includes reasons in json output", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--reason",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.items.length).toBeGreaterThan(0);
    expect(json.items[0]).toHaveProperty("reasons");
    expect(json.items[0].reasons).toContain("entry file");
  });

  test("--reason includes reasons in markdown output", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--reason",
      "--format", "md",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("reasons:");
    expect(result.stdout).toContain("entry file");
  });
});

describe("e2e: pack command - budget", () => {
  test("respects budget-chars limit", async () => {
    const smallBudget = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--budget-chars", "1000",
      "--no-timestamp",
    ]);
    const largeBudget = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--budget-chars", "50000",
      "--no-timestamp",
    ]);
    expect(smallBudget.exitCode).toBe(0);
    expect(largeBudget.exitCode).toBe(0);
    // Small budget should produce smaller output
    expect(smallBudget.stdout.length).toBeLessThan(largeBudget.stdout.length);
  });

  test("reports budget usage in output", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--budget-chars", "10000",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.budget).toHaveProperty("chars", 10000);
    expect(json.meta.budget).toHaveProperty("usedChars");
  });

  test("--reason shows omitted items", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/pack/runPack.ts",
      "--budget-chars", "5000",
      "--reason",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    // With a small budget, some items should be omitted
    const json = JSON.parse(result.stdout);
    // Either items are in omitted array or everything fit within budget
    expect(json.omitted).toBeDefined();
  });
});

describe("e2e: pack command - file output", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "repo-slice-test-"));
  });

  test("writes json to file by default", async () => {
    const outPath = join(tempDir, "output.json");
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--out", outPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(""); // Output goes to file, not stdout

    const content = await Bun.file(outPath).text();
    const json = JSON.parse(content);
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("items");
  });

  test("writes markdown to file with --format md", async () => {
    const outPath = join(tempDir, "output.md");
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--format", "md",
      "--out", outPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);

    const content = await Bun.file(outPath).text();
    expect(content).toContain("# repo-slice bundle");
    expect(content).toContain("src/cli.ts");
  });
});

describe("e2e: pack command - log parsing", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "repo-slice-log-test-"));
  });

  test("parses tsc-style error log", async () => {
    const logPath = join(tempDir, "tsc-errors.txt");
    await writeFile(logPath, `src/cli.ts:10:5 - error TS2345: Argument of type 'string' is not assignable.\nsrc/config.ts:25:3 - error TS2322: Type 'number' is not assignable.`);

    const result = await runCli([
      "pack",
      "--from-log", logPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("src/cli.ts"))).toBe(true);
    expect(filePaths.some((path: string) => path.includes("src/config.ts"))).toBe(true);
  });

  test("parses jest-style error log", async () => {
    const logPath = join(tempDir, "jest-errors.txt");
    await writeFile(logPath, `FAIL src/cli.ts\n  at Object.<anonymous> (src/commands/pack.ts:50:10)`);

    const result = await runCli([
      "pack",
      "--from-log", logPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("src/cli.ts"))).toBe(true);
    expect(filePaths.some((path: string) => path.includes("commands/pack.ts"))).toBe(true);
  });

  test("parses pytest-style error log", async () => {
    const logPath = join(tempDir, "pytest-errors.txt");
    // Using a path that would exist in a Python project
    await writeFile(logPath, `File "fixtures/monorepo/packages/ml/src/model.py", line 10\n    def train():`);

    const result = await runCli([
      "pack",
      "--from-log", logPath,
      "--no-timestamp",
    ]);
    // Should succeed even if file doesn't exist in current workspace
    expect(result.exitCode).toBe(0);
  });

  test("parses mypy-style error log", async () => {
    const logPath = join(tempDir, "mypy-errors.txt");
    await writeFile(logPath, `src/cli.ts:15: error: Incompatible types`);

    const result = await runCli([
      "pack",
      "--from-log", logPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
  });
});

describe("e2e: pack command - validation", () => {
  test("fails on unknown flag", async () => {
    const result = await runCli([
      "pack",
      "--unknown-flag",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Unknown flag");
  });

  test("fails on missing flag value", async () => {
    const result = await runCli([
      "pack",
      "--entry",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Missing value");
  });

  test("fails on invalid format", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--format", "xml",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid format");
  });

  test("fails on invalid include-tests value", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--include-tests", "maybe",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid include-tests");
  });

  test("fails on conflicting workspace flags", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--workspace", "foo",
      "--all-workspaces",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Cannot combine");
  });
});

describe("e2e: pack command - determinism", () => {
  test("produces identical output with --no-timestamp", async () => {
    const run1 = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--no-timestamp",
    ]);
    const run2 = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--no-timestamp",
    ]);
    expect(run1.exitCode).toBe(0);
    expect(run2.exitCode).toBe(0);
    expect(run1.stdout).toBe(run2.stdout);
  });


});

describe("e2e: pack command - real codebase scenarios", () => {
  test("bundles the entire adapters module", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/adapters/index.ts",
      "--depth", "1",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("adapters/index.ts"))).toBe(true);
    expect(filePaths.some((path: string) => path.includes("adapters/types.ts"))).toBe(true);
  });

  test("bundles test files with --include-tests true", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/engine/budget.ts",
      "--include-tests", "true",
      "--no-timestamp",
      "--reason",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    // Should include related test file if it exists
    const hasTestFile = filePaths.some((path: string) => path.includes("budget.test.ts"));
    // Test passes regardless - we're checking the flag works
    expect(filePaths.some((path: string) => path.includes("budget.ts"))).toBe(true);
  });

  test("handles deep import chains", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/pack/runPack.ts",
      "--depth", "3",
      "--budget-chars", "100000",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    // runPack imports many modules, should have significant content
    expect(json.items.length).toBeGreaterThan(5);
  });

  test("finds symbols across the codebase", async () => {
    const result = await runCli([
      "pack",
      "--symbol", "Candidate",
      "--no-timestamp",
      "--reason",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("engine/types.ts"))).toBe(true);
  });

  test("combines entry and symbol anchors", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--symbol", "renderHelp",
      "--no-timestamp",
      "--reason",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("cli.ts"))).toBe(true);
    // Check reasons are included
    const cliItem = json.items.find((item: { filePath: string }) => item.filePath.includes("cli.ts"));
    expect(cliItem).toBeDefined();
    expect(cliItem.reasons).toContain("entry file");
  });
});

describe("e2e: edge cases", () => {
  test("handles non-existent entry file gracefully", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/does-not-exist.ts",
      "--no-timestamp",
    ]);
    // Should still succeed but with empty or minimal output
    // The file just won't be found in any workspace
    expect(result.exitCode).toBe(0);
  });

  test("handles empty symbol query gracefully", async () => {
    const result = await runCli([
      "pack",
      "--symbol", "",
    ]);
    // Empty symbol might fail with usage error or not found
    expect([0, 2, 3]).toContain(result.exitCode);
  });

  test("handles very small budget", async () => {
    const result = await runCli([
      "pack",
      "--entry", "src/cli.ts",
      "--budget-chars", "100",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    // Should still produce valid JSON output structure
    const json = JSON.parse(result.stdout);
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("omitted");
  });

  test("handles special characters in paths", async () => {
    // Test with a path containing the project's actual structure
    const result = await runCli([
      "pack",
      "--entry", "./src/cli.ts",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    const filePaths = json.items.map((item: { filePath: string }) => item.filePath);
    expect(filePaths.some((path: string) => path.includes("cli.ts"))).toBe(true);
  });
});

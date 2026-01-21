import { test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderJsonBundle } from "../src/output/json.js";

test("renders json bundle (golden)", async () => {
  const repoRoot = "/repo";
  const meta = {
    repoRoot,
    command: "repo-slice pack --entry packages/web/src/index.ts --format json",
    scope: { mode: "nearest", workspaces: ["packages/web"] },
    budget: { chars: 100, usedChars: 25 },
  };
  const items = [
    {
      kind: "snippet" as const,
      lang: "ts" as const,
      workspaceRoot: "/repo/packages/web",
      filePath: "/repo/packages/web/src/index.ts",
      range: { startLine: 1, endLine: 1 },
      reasons: ["entry file"],
      content: "export const value = 1;",
    },
  ];
  const omitted: never[] = [];
  const output = renderJsonBundle({
    meta,
    items,
    omitted,
  });
  const expected = await readFile(
    join(import.meta.dir, "..", "fixtures", "golden", "bundle.json"),
    "utf8"
  );
  expect(output).toBe(expected);
});

test("renders json bundle with omitted items", async () => {
  const repoRoot = "/repo";
  const meta = {
    repoRoot,
    command: "repo-slice pack --entry src/app.ts --budget-chars 50 --format json",
    scope: { mode: "nearest", workspaces: ["root"] },
    budget: { chars: 50, usedChars: 25 },
  };
  const items = [
    {
      kind: "snippet" as const,
      lang: "ts" as const,
      workspaceRoot: "/repo",
      filePath: "/repo/src/app.ts",
      range: { startLine: 1, endLine: 1 },
      reasons: ["entry file"],
      content: "export function main() {}",
    },
  ];
  const omitted = [
    {
      kind: "file" as const,
      filePath: "/repo/src/utils.ts",
      range: undefined,
      reason: "exceeds budget",
      score: 500,
      estimatedChars: 1000,
    },
  ];
  const output = renderJsonBundle({
    meta,
    items,
    omitted,
  });
  const expected = await readFile(
    join(import.meta.dir, "..", "fixtures", "golden", "bundle-omitted.json"),
    "utf8"
  );
  expect(output).toBe(expected);
});

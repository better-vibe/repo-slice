import { test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderMarkdownBundle } from "../src/output/markdown.js";

test("renders markdown bundle (golden)", async () => {
  const repoRoot = "/repo";
  const meta = {
    repoRoot,
    command: "repo-slice pack --entry packages/web/src/index.ts",
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
  const output = renderMarkdownBundle({
    meta,
    items,
    omitted,
    includeReasons: true,
  });
  const expected = await readFile(
    join(import.meta.dir, "..", "fixtures", "golden", "bundle.md"),
    "utf8"
  );
  expect(output).toBe(expected);
});

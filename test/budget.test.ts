import { test, expect } from "bun:test";
import { selectCandidatesWithBudget } from "../src/engine/budget.js";
import type { Candidate } from "../src/engine/types.js";
import { join } from "node:path";

test("budget selection never exceeds cap", async () => {
  const candidates: Candidate[] = [
    {
      id: "a",
      kind: "snippet",
      lang: "ts",
      workspaceId: ".",
      workspaceRoot: "/repo",
      filePath: join(import.meta.dir, "..", "fixtures", "monorepo", "packages", "web", "src", "index.ts"),
      range: { startLine: 1, endLine: 1 },
      score: 100,
      reasons: ["test"],
      estimatedChars: 10,
    },
    {
      id: "b",
      kind: "snippet",
      lang: "ts",
      workspaceId: ".",
      workspaceRoot: "/repo",
      filePath: join(import.meta.dir, "..", "fixtures", "monorepo", "services", "billing", "src", "invoice.py"),
      range: { startLine: 1, endLine: 1 },
      score: 90,
      reasons: ["test"],
      estimatedChars: 10,
    },
  ];
  const result = await selectCandidatesWithBudget({
    candidates,
    budgetChars: 5,
  });
  expect(result.items.length).toBe(0);
  expect(result.usedChars).toBe(0);
});

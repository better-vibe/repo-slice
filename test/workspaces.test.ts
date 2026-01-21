import { test, expect } from "bun:test";
import { join } from "node:path";
import { detectWorkspaces } from "../src/workspaces/detectWorkspaces.js";
import { resolveWorkspaceScope } from "../src/workspaces/scope.js";

test("detects node and python workspaces", async () => {
  const repoRoot = join(import.meta.dir, "..", "fixtures", "monorepo");
  const workspaces = await detectWorkspaces(repoRoot);
  const ids = workspaces.map((ws) => ws.id).sort();
  expect(ids).toEqual([".", "packages/web", "services/billing"].sort());
});

test("resolves nearest workspace by cwd", async () => {
  const repoRoot = join(import.meta.dir, "..", "fixtures", "monorepo");
  const workspaces = await detectWorkspaces(repoRoot);
  const cwd = join(repoRoot, "packages", "web");
  const scope = await resolveWorkspaceScope({
    workspaces,
    cwd,
    workspaceFlag: "auto",
  });
  expect(scope.workspaces[0]?.id).toBe("packages/web");
});

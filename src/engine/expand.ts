import { dirname, join, basename, extname } from "node:path";
import fg from "fast-glob";
import type { AdapterIndex } from "../adapters/types.js";
import type { Candidate } from "./types.js";
import { estimateFileChars } from "./candidates.js";
import { languageFromPath } from "../utils/lang.js";
import type { IgnoreMatcher } from "../ignore.js";
import type { Workspace } from "../workspaces/types.js";
import { fileExists } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";

const DISTANCE_SCORES: Record<number, number> = {
  1: 250,
  2: 150,
};

const DEFAULT_DISTANCE_SCORE = 50;
const BARREL_SCORE = 120;
const CONFIG_SCORE = 110;
const TEST_SCORE = 100;

export async function expandFromAnchors(options: {
  adapters: AdapterIndex[];
  workspaces: Workspace[];
  anchorFiles: Set<string>;
  depth: number;
  includeTests: "auto" | "true" | "false";
  ignoreMatchers: Map<string, IgnoreMatcher>;
}): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const adapterByFile = new Map<string, AdapterIndex>();
  for (const adapter of options.adapters) {
    for (const file of adapter.files) {
      adapterByFile.set(file, adapter);
    }
  }

  for (const anchorFile of options.anchorFiles) {
    const adapter = adapterByFile.get(anchorFile);
    if (!adapter) continue;
    const graph = adapter.importGraph;
    const visited = new Set<string>([anchorFile]);
    const queue: Array<{ file: string; distance: number }> = [
      { file: anchorFile, distance: 0 },
    ];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const nextDistance = current.distance + 1;
      if (nextDistance > options.depth) continue;
      const neighbors = graph.get(current.file);
      if (!neighbors) continue;
      // Sort by file path for determinism (neighbors is Map<string, ImportEdgeType>)
      const sortedNeighbors = Array.from(neighbors.keys()).sort();
      for (const neighbor of sortedNeighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push({ file: neighbor, distance: nextDistance });
        const estimatedChars = await estimateFileChars(neighbor);
        const edgeType = neighbors.get(neighbor);
        const isDynamic = edgeType === "imports-dynamic";
        candidates.push({
          id: "",
          kind: "file",
          lang: languageFromPath(neighbor),
          workspaceId: adapter.workspace.id,
          workspaceRoot: adapter.workspace.root,
          filePath: neighbor,
          score: DISTANCE_SCORES[nextDistance] ?? DEFAULT_DISTANCE_SCORE,
          reasons: [isDynamic ? `dynamic-import-distance ${nextDistance}` : `import-distance ${nextDistance}`],
          estimatedChars,
        });
      }
    }

    const barrel = await findBarrelFile(anchorFile);
    if (barrel) {
      const estimatedChars = await estimateFileChars(barrel);
      candidates.push({
        id: "",
        kind: "file",
        lang: languageFromPath(barrel),
        workspaceId: adapter.workspace.id,
        workspaceRoot: adapter.workspace.root,
        filePath: barrel,
        score: BARREL_SCORE,
        reasons: ["barrel file"],
        estimatedChars,
      });
    }

    if (options.includeTests !== "false") {
      const shouldInclude =
        options.includeTests === "true" || /[\\/](src|lib)[\\/]/.test(anchorFile);
      if (shouldInclude) {
        const matcher =
          options.ignoreMatchers.get(adapter.workspace.id) ??
          options.ignoreMatchers.values().next().value;
        const tests = await findRelatedTests(
          adapter.workspace.root,
          anchorFile,
          matcher
        );
        for (const testFile of tests) {
          const estimatedChars = await estimateFileChars(testFile);
          candidates.push({
            id: "",
            kind: "file",
            lang: languageFromPath(testFile),
            workspaceId: adapter.workspace.id,
            workspaceRoot: adapter.workspace.root,
            filePath: testFile,
            score: TEST_SCORE,
            reasons: ["related test"],
            estimatedChars,
          });
        }
      }
    }
  }

  const configBoosters = await findConfigBoosters(options.workspaces);
  for (const booster of configBoosters) {
    const estimatedChars = await estimateFileChars(booster.filePath);
    candidates.push({
      id: "",
      kind: "file",
      lang: languageFromPath(booster.filePath),
      workspaceId: booster.workspace.id,
      workspaceRoot: booster.workspace.root,
      filePath: booster.filePath,
      score: CONFIG_SCORE,
      reasons: ["config booster"],
      estimatedChars,
    });
  }

  return candidates;
}

async function findBarrelFile(anchorFile: string): Promise<string | null> {
  const dir = dirname(anchorFile);
  const candidates = ["index.ts", "index.tsx", "index.js", "index.jsx"];
  for (const name of candidates) {
    const path = join(dir, name);
    if (await fileExists(path)) return path;
  }
  return null;
}

async function findRelatedTests(
  workspaceRoot: string,
  anchorFile: string,
  ignoreMatcher: IgnoreMatcher
): Promise<string[]> {
  const base = basename(anchorFile, extname(anchorFile));
  const patterns = [
    `**/${base}.test.*`,
    `**/${base}.spec.*`,
    `**/test_${base}.*`,
  ];
  const matches = await fg(patterns, {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  return matches
    .map((file) => normalizePath(file))
    .filter((file) => !ignoreMatcher.ignores(file))
    .sort();
}

async function findConfigBoosters(
  workspaces: Workspace[]
): Promise<Array<{ workspace: Workspace; filePath: string }>> {
  const boosters = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "next-env.d.ts",
    "vite.config.ts",
    "vite.config.js",
    "svelte.config.js",
    "remix.config.js",
  ];
  const results: Array<{ workspace: Workspace; filePath: string }> = [];
  for (const workspace of workspaces) {
    for (const name of boosters) {
      const filePath = join(workspace.root, name);
      if (await fileExists(filePath)) {
        results.push({ workspace, filePath });
      }
    }
  }
  return results;
}


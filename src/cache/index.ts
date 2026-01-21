import { join } from "node:path";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";
import { sha1 } from "../utils/hash.js";
import type { FileStat, WorkspaceCache } from "./types.js";
import type { ImportGraph } from "../adapters/types.js";

export async function loadWorkspaceCache(options: {
  repoRoot: string;
  workspaceRoot: string;
  configHash: string;
  version: string;
}): Promise<WorkspaceCache | null> {
  const cachePath = workspaceCachePath(options.repoRoot, options.workspaceRoot, options.configHash, options.version);
  if (!(await fileExists(cachePath))) return null;
  try {
    const raw = await readFile(cachePath, "utf8");
    const cache = JSON.parse(raw) as WorkspaceCache;
    if (cache.version !== options.version) return null;
    if (cache.configHash !== options.configHash) return null;
    if (cache.workspaceRoot !== options.workspaceRoot) return null;
    return cache;
  } catch {
    return null;
  }
}

export async function saveWorkspaceCache(options: {
  repoRoot: string;
  workspaceRoot: string;
  configHash: string;
  version: string;
  cache: WorkspaceCache;
}): Promise<void> {
  const cachePath = workspaceCachePath(options.repoRoot, options.workspaceRoot, options.configHash, options.version);
  const cacheDir = cachePath.replace(/\/index\.json$/, "");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(options.cache, null, 2), "utf8");
}

export function workspaceCacheKey(workspaceRoot: string, configHash: string, version: string): string {
  return sha1(`${workspaceRoot}|${configHash}|${version}`);
}

export function workspaceCachePath(repoRoot: string, workspaceRoot: string, configHash: string, version: string): string {
  const key = workspaceCacheKey(workspaceRoot, configHash, version);
  return join(repoRoot, ".repo-slice", "cache", key, "index.json");
}

export function isCacheValid(cache: WorkspaceCache, fileStats: FileStat[]): boolean {
  if (cache.files.length !== fileStats.length) return false;
  const sortedStats = [...fileStats].sort((a, b) => a.path.localeCompare(b.path));
  const sortedCache = [...cache.files].sort((a, b) => a.path.localeCompare(b.path));
  for (let i = 0; i < sortedStats.length; i += 1) {
    const current = sortedStats[i];
    const cached = sortedCache[i];
    if (current.path !== cached.path) return false;
    if (current.mtimeMs !== cached.mtimeMs) return false;
    if (current.size !== cached.size) return false;
  }
  return true;
}

export function serializeImportGraph(graph: ImportGraph): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const [key, value] of graph.entries()) {
    record[key] = Array.from(value).sort();
  }
  return record;
}

export function deserializeImportGraph(record: Record<string, string[]>): ImportGraph {
  const graph: ImportGraph = new Map();
  for (const [key, value] of Object.entries(record)) {
    graph.set(key, new Set(value));
  }
  return graph;
}

export async function collectFileStats(files: string[]): Promise<FileStat[]> {
  const stats: FileStat[] = [];
  for (const file of files) {
    try {
      const info = await stat(file);
      stats.push({
        path: file,
        mtimeMs: info.mtimeMs,
        size: info.size,
      });
    } catch {
      continue;
    }
  }
  return stats;
}

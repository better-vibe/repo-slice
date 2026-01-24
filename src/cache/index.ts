import { join } from "node:path";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";
import { sha1 } from "../utils/hash.js";
import type { FileStat, SerializedImportGraph, LegacySerializedImportGraph, WorkspaceCache } from "./types.js";
import type { ImportGraph, ImportEdgeType } from "../adapters/types.js";

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

export function serializeImportGraph(graph: ImportGraph): SerializedImportGraph {
  const record: SerializedImportGraph = {};
  for (const [source, targets] of graph.entries()) {
    const targetRecord: Record<string, ImportEdgeType> = {};
    // Sort keys for deterministic output
    const sortedTargets = Array.from(targets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [target, edgeType] of sortedTargets) {
      targetRecord[target] = edgeType;
    }
    record[source] = targetRecord;
  }
  return record;
}

/**
 * Deserialize import graph with backward compatibility for legacy format.
 * Legacy format: Record<string, string[]> (all edges treated as "imports")
 * New format: Record<string, Record<string, ImportEdgeType>>
 */
export function deserializeImportGraph(record: SerializedImportGraph | LegacySerializedImportGraph): ImportGraph {
  const graph: ImportGraph = new Map();
  for (const [source, targets] of Object.entries(record)) {
    const targetMap = new Map<string, ImportEdgeType>();
    if (Array.isArray(targets)) {
      // Legacy format: string[] - treat all as static imports
      for (const target of targets) {
        targetMap.set(target, "imports");
      }
    } else {
      // New format: Record<string, ImportEdgeType>
      for (const [target, edgeType] of Object.entries(targets)) {
        targetMap.set(target, edgeType as ImportEdgeType);
      }
    }
    graph.set(source, targetMap);
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

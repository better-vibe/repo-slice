/**
 * Worker Pool Integration for Adapter Building
 * 
 * Provides parallel parsing capabilities using worker threads.
 * Falls back to main-thread parsing for single-core systems or small file sets.
 */

import { WorkerPool, getWorkerPool } from "./pool.js";
import type { ImportGraph, CallExpression } from "../adapters/types.js";

export interface ParallelParseOptions {
  workspaceRoot: string;
  tsFiles?: string[];
  pyFiles?: string[];
  pythonImportRoots?: string[];
  useWorkers?: boolean;
}

export interface ParallelParseResult {
  ts?: {
    importGraph: ImportGraph;
    callExpressions: CallExpression[];
  };
  py?: {
    moduleMap: Map<string, string>;
    definitions: Map<string, unknown[]>;
    importGraph: ImportGraph;
  };
  stats: {
    tsFilesParsed: number;
    pyFilesParsed: number;
    usedWorkers: boolean;
  };
}

/**
 * Parse files in parallel using worker threads
 */
export async function parseFilesParallel(
  options: ParallelParseOptions
): Promise<ParallelParseResult> {
  const { workspaceRoot, tsFiles = [], pyFiles = [], pythonImportRoots = [] } = options;

  // Determine if we should use workers
  const totalFiles = tsFiles.length + pyFiles.length;
  const useWorkers = options.useWorkers !== false && totalFiles > 20;

  const result: ParallelParseResult = {
    stats: {
      tsFilesParsed: 0,
      pyFilesParsed: 0,
      usedWorkers: false,
    },
  };

  if (!useWorkers) {
    // Fallback: return empty result, let main thread handle parsing
    // This keeps backward compatibility
    return result;
  }

  try {
    const pool = await getWorkerPool();
    const tasks: Promise<void>[] = [];

    // Parse TypeScript files in parallel
    if (tsFiles.length > 0) {
      tasks.push(
        pool
          .execute("ts-parse", { files: tsFiles, workspaceRoot })
          .then((output: unknown) => {
            const { importGraph, callExpressions } = output as {
              importGraph: Record<string, Record<string, string>>;
              callExpressions: CallExpression[];
            };

            // Convert record to ImportGraph (Map)
            const graph: ImportGraph = new Map();
            for (const [source, targets] of Object.entries(importGraph)) {
              const targetMap = new Map<string, import("../adapters/types.js").ImportEdgeType>();
              for (const [target, edgeType] of Object.entries(targets)) {
                targetMap.set(target, edgeType as import("../adapters/types.js").ImportEdgeType);
              }
              graph.set(source, targetMap);
            }

            result.ts = {
              importGraph: graph,
              callExpressions,
            };
            result.stats.tsFilesParsed = tsFiles.length;
          })
      );
    }

    // Parse Python files in parallel
    if (pyFiles.length > 0) {
      tasks.push(
        pool
          .execute("py-parse", { files: pyFiles, workspaceRoot, pythonImportRoots })
          .then((output: unknown) => {
            const { moduleMap, definitions, importGraph } = output as {
              moduleMap: Record<string, string>;
              definitions: Record<string, unknown[]>;
              importGraph: Record<string, Record<string, string>>;
            };

            // Convert records to Maps
            const graph: ImportGraph = new Map();
            for (const [source, targets] of Object.entries(importGraph)) {
              const targetMap = new Map<string, import("../adapters/types.js").ImportEdgeType>();
              for (const [target, edgeType] of Object.entries(targets)) {
                targetMap.set(target, edgeType as import("../adapters/types.js").ImportEdgeType);
              }
              graph.set(source, targetMap);
            }

            result.py = {
              moduleMap: new Map(Object.entries(moduleMap)),
              definitions: new Map(Object.entries(definitions)),
              importGraph: graph,
            };
            result.stats.pyFilesParsed = pyFiles.length;
          })
      );
    }

    await Promise.all(tasks);
  } catch (error) {
    console.warn("Worker pool parsing failed, falling back to main thread:", error);
    // Return empty result to trigger fallback
    return { stats: { tsFilesParsed: 0, pyFilesParsed: 0, usedWorkers: false } };
  }

  return result;
}

/**
 * Terminate the worker pool when done
 */
export async function terminateWorkers(): Promise<void> {
  const { terminateWorkerPool } = await import("./pool.js");
  await terminateWorkerPool();
}

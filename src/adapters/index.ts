import type { AdapterIndex, ImportGraph, PythonDefinition, CallExpression } from "./types.js";
import type { Workspace } from "../workspaces/types.js";
import type { IgnoreMatcher } from "../ignore.js";

export interface AdapterCacheData {
  tsImportGraph?: ImportGraph;
  tsCallExpressions?: CallExpression[];  // NEW: Cached TypeScript call expressions
  pyModuleMap?: Map<string, string>;
  pyDefinitions?: Map<string, PythonDefinition[]>;
  pyImportGraph?: ImportGraph;
  pyCallExpressions?: CallExpression[];  // NEW: Cached Python call expressions
}

export interface BuildAdaptersOptions {
  workspace: Workspace;
  ignoreMatcher: IgnoreMatcher;
  pythonImportRoots: string[];
  files?: { tsFiles?: string[]; pyFiles?: string[] };
  cache?: AdapterCacheData;
  cacheDir?: string;  // NEW: Cache directory for incremental parsing
  enableIncremental?: boolean;  // NEW: Enable incremental TypeScript parsing
}

export async function buildAdaptersForWorkspace(options: BuildAdaptersOptions): Promise<AdapterIndex[]> {
  const adapters: AdapterIndex[] = [];
  
  // Only build TypeScript adapter if TypeScript files exist
  if (options.files?.tsFiles && options.files.tsFiles.length > 0) {
    const { buildTsAdapter } = await import("./ts/index.js");
    const tsAdapter = await buildTsAdapter({
      workspace: options.workspace,
      ignoreMatcher: options.ignoreMatcher,
      files: options.files.tsFiles,
      cachedImportGraph: options.cache?.tsImportGraph,
      cachedCallExpressions: options.cache?.tsCallExpressions,
      // NEW: Enable incremental parsing if cache directory provided
      enableIncremental: options.enableIncremental,
      cacheDir: options.cacheDir,
    });
    if (tsAdapter) adapters.push(tsAdapter);
  }
  
  // Only build Python adapter if Python files exist
  if (options.files?.pyFiles && options.files.pyFiles.length > 0) {
    const { buildPythonAdapter } = await import("./python/index.js");
    const pyAdapter = await buildPythonAdapter({
      workspace: options.workspace,
      ignoreMatcher: options.ignoreMatcher,
      pythonImportRoots: options.pythonImportRoots,
      files: options.files.pyFiles,
      cachedModuleMap: options.cache?.pyModuleMap,
      cachedDefinitions: options.cache?.pyDefinitions,
      cachedImportGraph: options.cache?.pyImportGraph,
      cachedCallExpressions: options.cache?.pyCallExpressions,  // NEW: Pass cached call expressions
    });
    if (pyAdapter) adapters.push(pyAdapter);
  }
  
  return adapters;
}

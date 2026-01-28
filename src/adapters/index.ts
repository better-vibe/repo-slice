import type { AdapterIndex, ImportGraph, PythonDefinition } from "./types.js";
import type { Workspace } from "../workspaces/types.js";
import type { IgnoreMatcher } from "../ignore.js";

export interface AdapterCacheData {
  tsImportGraph?: ImportGraph;
  pyModuleMap?: Map<string, string>;
  pyDefinitions?: Map<string, PythonDefinition[]>;
  pyImportGraph?: ImportGraph;
}

export async function buildAdaptersForWorkspace(options: {
  workspace: Workspace;
  ignoreMatcher: IgnoreMatcher;
  pythonImportRoots: string[];
  files?: { tsFiles?: string[]; pyFiles?: string[] };
  cache?: AdapterCacheData;
}): Promise<AdapterIndex[]> {
  const adapters: AdapterIndex[] = [];
  
  // Only build TypeScript adapter if TypeScript files exist
  if (options.files?.tsFiles && options.files.tsFiles.length > 0) {
    const { buildTsAdapter } = await import("./ts/index.js");
    const tsAdapter = await buildTsAdapter({
      workspace: options.workspace,
      ignoreMatcher: options.ignoreMatcher,
      files: options.files.tsFiles,
      cachedImportGraph: options.cache?.tsImportGraph,
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
    });
    if (pyAdapter) adapters.push(pyAdapter);
  }
  
  return adapters;
}

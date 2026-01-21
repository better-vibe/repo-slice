import type { Range } from "../adapters/types.js";

export interface FileStat {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface PythonDefinitionCache {
  name: string;
  kind: "function" | "class" | "method";
  range: Range;
  className?: string;
  classRange?: Range;
}

export interface WorkspaceCache {
  version: string;
  workspaceRoot: string;
  configHash: string;
  files: FileStat[];
  ts?: {
    importGraph: Record<string, string[]>;
  };
  py?: {
    moduleMap: Record<string, string>;
    definitions: Record<string, PythonDefinitionCache[]>;
    importGraph: Record<string, string[]>;
  };
}

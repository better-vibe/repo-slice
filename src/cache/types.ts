import type { ImportEdgeType, Range } from "../adapters/types.js";

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

/**
 * Serialized import graph format.
 * Maps source file -> (target file -> edge type).
 * Legacy format (string[]) is accepted for backward compatibility during deserialization.
 */
export type SerializedImportGraph = Record<string, Record<string, ImportEdgeType>>;

/**
 * Legacy format for backward compatibility.
 */
export type LegacySerializedImportGraph = Record<string, string[]>;

export interface WorkspaceCache {
  version: string;
  workspaceRoot: string;
  configHash: string;
  files: FileStat[];
  ts?: {
    importGraph: SerializedImportGraph | LegacySerializedImportGraph;
  };
  py?: {
    moduleMap: Record<string, string>;
    definitions: Record<string, PythonDefinitionCache[]>;
    importGraph: SerializedImportGraph | LegacySerializedImportGraph;
  };
}

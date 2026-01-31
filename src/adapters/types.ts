import type { Workspace } from "../workspaces/types.js";

export type Language = "ts" | "py";

export interface Range {
  startLine: number;
  endLine: number;
}

export interface PythonDefinition {
  name: string;
  kind: "function" | "class" | "method";
  range: Range;
  className?: string;
  classRange?: Range;
}

export type LocationKind =
  | "definition"
  | "reference"
  | "diagnostic"
  | "diff-hunk"
  | "context";

export interface SymbolLocation {
  filePath: string;
  range: Range;
  kind: LocationKind;
  lang: Language;
  symbolPosition?: number;
  symbolName?: string;
}

export type ImportEdgeType = "imports" | "imports-dynamic";

/**
 * Import graph maps source file -> (target file -> edge type).
 * Edge type is "imports" for static imports, "imports-dynamic" for dynamic imports.
 */
export type ImportGraph = Map<string, Map<string, ImportEdgeType>>;

export interface CallExpression {
  callerFile: string;
  callerSymbol?: string;
  calleeSymbol: string;
  range: Range;
  confidence: number;
  isDynamic: boolean;
}

export interface AdapterMetadata {
  py?: {
    moduleMap: Map<string, string>;
    definitions: Map<string, PythonDefinition[]>;
    callExpressions?: CallExpression[];  // For caching
  };
  ts?: {
    callExpressions?: CallExpression[];  // For caching
  };
}

export interface AdapterIndex {
  lang: Language;
  workspace: Workspace;
  files: string[];
  importGraph: ImportGraph;
  findSymbolDefinitions: (query: string) => Promise<SymbolLocation[]>;
  findSymbolReferences: (
    definition: SymbolLocation,
    options?: { limit?: number; anchorFiles?: string[] }
  ) => Promise<SymbolLocation[]>;
  extractSnippet: (filePath: string, range: Range) => Promise<string>;
  findCallExpressions?: (options?: {
    files?: string[];
    symbolFilter?: string[];
  }) => Promise<CallExpression[]>;
  metadata?: AdapterMetadata;
}

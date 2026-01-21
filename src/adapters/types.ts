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

export type ImportGraph = Map<string, Set<string>>;

export interface AdapterMetadata {
  py?: {
    moduleMap: Map<string, string>;
    definitions: Map<string, PythonDefinition[]>;
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
  metadata?: AdapterMetadata;
}

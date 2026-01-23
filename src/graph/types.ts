import type { Language, Range } from "../adapters/types.js";

export type GraphType = "imports" | "calls" | "combined";
export type CollapseMode = "none" | "external" | "file" | "class";
export type GraphOutputFormat = "json" | "dot";
export type NodeKind = "file" | "module" | "function" | "method" | "constructor" | "class";
export type EdgeType = "imports" | "tests" | "calls" | "calls-dynamic" | "calls-unknown";

export interface GraphRange {
  startLine: number;
  endLine: number;
  startCol?: number;
  endCol?: number;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  lang: Language;
  name: string;
  filePath: string;
  range?: GraphRange;
  workspaceRoot: string;
  anchor: boolean;
  external: boolean;
  confidence: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  callsite?: { filePath: string; range: Range };
  confidence: number;
}

export interface GraphMeta {
  repoRoot: string;
  generatedAt?: string;
  command: string;
  scope: { mode: string; workspaces: string[] };
  graphType: GraphType;
  depth: number;
  maxNodes: number;
  maxEdges: number;
  collapse: CollapseMode;
  truncated: boolean;
  truncatedNodes?: number;
  truncatedEdges?: number;
}

export interface GraphOutput {
  meta: GraphMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphCliArgs {
  entries: string[];
  symbols: string[];
  symbolStrict?: boolean;
  fromDiff?: string;
  fromLog?: string;
  workspace?: string;
  allWorkspaces?: boolean;
  fallbackAll?: boolean;
  graphType: GraphType;
  depth: number;
  scope?: "symbol" | "file" | "workspace";
  includeTests?: IncludeTestsMode;
  includeExternal?: boolean;
  maxNodes: number;
  maxEdges: number;
  collapse: CollapseMode;
  pythonEngine?: "treesitter" | "pyright";
  format: GraphOutputFormat;
  out?: string;
  debug?: boolean;
  noTimestamp?: boolean;
}

export type IncludeTestsMode = "auto" | "true" | "false";

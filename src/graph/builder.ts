import type { AdapterIndex, CallExpression } from "../adapters/types.js";
import type {
  GraphNode,
  GraphEdge,
  GraphType,
  IncludeTestsMode,
  CollapseMode,
  NodeKind,
  EdgeType,
} from "./types.js";
import { buildImportGraph } from "./imports.js";
import { truncateGraph } from "./truncate.js";
import { applyCollapse } from "./collapse.js";
import type { IgnoreMatcher } from "../ignore.js";
import { toPosixPath } from "../utils/path.js";
import { relative } from "node:path";

export interface GraphBuilderOptions {
  adapters: AdapterIndex[];
  anchorFiles: Set<string>;
  repoRoot: string;
  graphType: GraphType;
  depth: number;
  includeTests: IncludeTestsMode;
  includeExternal: boolean;
  maxNodes: number;
  maxEdges: number;
  collapse: CollapseMode;
  ignoreMatchers: Map<string, IgnoreMatcher>;
}

export interface GraphBuilderResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  truncatedNodes: number;
  truncatedEdges: number;
}

export async function buildGraph(
  options: GraphBuilderOptions
): Promise<GraphBuilderResult> {
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];

  if (options.graphType === "imports" || options.graphType === "combined") {
    const importResult = await buildImportGraph({
      adapters: options.adapters,
      anchorFiles: options.anchorFiles,
      repoRoot: options.repoRoot,
      depth: options.depth,
      includeTests: options.includeTests,
      includeExternal: options.includeExternal,
      ignoreMatchers: options.ignoreMatchers,
    });
    nodes = mergeNodes(nodes, importResult.nodes);
    edges = mergeEdges(edges, importResult.edges);
  }

  if (options.graphType === "calls" || options.graphType === "combined") {
    const callResult = await buildCallGraph(options);
    nodes = mergeNodes(nodes, callResult.nodes);
    edges = mergeEdges(edges, callResult.edges);
  }

  const collapsed = applyCollapse(nodes, edges, options.collapse);
  nodes = collapsed.nodes;
  edges = collapsed.edges;

  sortForDeterminism(nodes, edges);

  const truncateResult = truncateGraph(nodes, edges, {
    maxNodes: options.maxNodes,
    maxEdges: options.maxEdges,
  });

  sortForDeterminism(truncateResult.nodes, truncateResult.edges);

  return {
    nodes: truncateResult.nodes,
    edges: truncateResult.edges,
    truncated: truncateResult.truncated,
    truncatedNodes: truncateResult.truncatedNodes,
    truncatedEdges: truncateResult.truncatedEdges,
  };
}

async function buildCallGraph(
  options: GraphBuilderOptions
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const anchorFilesArray = Array.from(options.anchorFiles);

  for (const adapter of options.adapters) {
    if (!adapter.findCallExpressions) continue;

    const callExpressions = adapter.findCallExpressions({
      files: anchorFilesArray.filter((f) =>
        f.startsWith(adapter.workspace.root)
      ),
    });

    for (const call of callExpressions) {
      const callerNodeId = createCallNodeId(
        call.callerFile,
        call.callerSymbol,
        adapter.lang,
        options.repoRoot
      );
      const calleeNodeId = normalizeCalleeId(
        call.calleeSymbol,
        adapter.lang,
        options.repoRoot
      );

      if (!nodes.has(callerNodeId)) {
        nodes.set(callerNodeId, createCallNode({
          id: callerNodeId,
          filePath: call.callerFile,
          symbolName: call.callerSymbol,
          lang: adapter.lang,
          repoRoot: options.repoRoot,
          workspaceRoot: adapter.workspace.root,
          anchor: options.anchorFiles.has(call.callerFile),
          confidence: 1.0,
        }));
      }

      if (!nodes.has(calleeNodeId)) {
        nodes.set(calleeNodeId, createCallNode({
          id: calleeNodeId,
          filePath: extractFileFromCalleeId(call.calleeSymbol),
          symbolName: extractSymbolFromCalleeId(call.calleeSymbol),
          lang: adapter.lang,
          repoRoot: options.repoRoot,
          workspaceRoot: adapter.workspace.root,
          anchor: false,
          confidence: call.confidence,
        }));
      }

      const edgeType: EdgeType = call.isDynamic
        ? "calls-dynamic"
        : call.confidence < 0.5
          ? "calls-unknown"
          : "calls";

      edges.push({
        from: callerNodeId,
        to: calleeNodeId,
        type: edgeType,
        callsite: {
          filePath: toPosixPath(relative(options.repoRoot, call.callerFile)),
          range: call.range,
        },
        confidence: call.confidence,
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

function createCallNodeId(
  filePath: string,
  symbolName: string | undefined,
  lang: "ts" | "py",
  repoRoot: string
): string {
  const relPath = toPosixPath(relative(repoRoot, filePath));
  if (symbolName) {
    return `${lang}:${relPath}#${symbolName}`;
  }
  return `${lang}:${relPath}`;
}

function normalizeCalleeId(
  calleeSymbol: string,
  lang: "ts" | "py",
  repoRoot: string
): string {
  if (calleeSymbol.includes("#")) {
    const parts = calleeSymbol.split("#");
    const filePart = parts[0];
    const symbolPart = parts.slice(1).join("#");
    if (filePart.includes("/")) {
      return `${lang}:${filePart}#${symbolPart}`;
    }
  }
  if (calleeSymbol.startsWith("/") || calleeSymbol.includes(":")) {
    return `${lang}:${calleeSymbol}`;
  }
  return `${lang}:[unresolved]#${calleeSymbol}`;
}

function extractFileFromCalleeId(calleeSymbol: string): string {
  if (calleeSymbol.includes("#")) {
    const filePart = calleeSymbol.split("#")[0];
    if (filePart.includes("/")) {
      return filePart;
    }
  }
  return "[unresolved]";
}

function extractSymbolFromCalleeId(calleeSymbol: string): string {
  if (calleeSymbol.includes("#")) {
    return calleeSymbol.split("#").slice(1).join("#");
  }
  return calleeSymbol;
}

function createCallNode(options: {
  id: string;
  filePath: string;
  symbolName?: string;
  lang: "ts" | "py";
  repoRoot: string;
  workspaceRoot: string;
  anchor: boolean;
  confidence: number;
}): GraphNode {
  const { id, filePath, symbolName, lang, repoRoot, workspaceRoot, anchor, confidence } = options;
  const relPath = filePath.startsWith("/")
    ? toPosixPath(relative(repoRoot, filePath))
    : filePath;
  const relWorkspace = workspaceRoot.startsWith("/")
    ? toPosixPath(relative(repoRoot, workspaceRoot)) || "."
    : workspaceRoot;

  let kind: NodeKind = "function";
  if (symbolName) {
    if (symbolName.includes(".")) {
      const parts = symbolName.split(".");
      if (parts[parts.length - 1] === "constructor") {
        kind = "constructor";
      } else {
        kind = "method";
      }
    }
  } else {
    kind = "file";
  }

  return {
    id,
    kind,
    lang,
    name: symbolName ?? relPath.split("/").pop() ?? relPath,
    filePath: relPath,
    workspaceRoot: relWorkspace,
    anchor,
    external: filePath === "[unresolved]",
    confidence,
  };
}

function mergeNodes(existing: GraphNode[], incoming: GraphNode[]): GraphNode[] {
  const map = new Map<string, GraphNode>();
  for (const node of existing) {
    map.set(node.id, node);
  }
  for (const node of incoming) {
    const existingNode = map.get(node.id);
    if (!existingNode) {
      map.set(node.id, node);
    } else {
      map.set(node.id, {
        ...existingNode,
        anchor: existingNode.anchor || node.anchor,
        confidence: Math.max(existingNode.confidence, node.confidence),
      });
    }
  }
  return Array.from(map.values());
}

function mergeEdges(existing: GraphEdge[], incoming: GraphEdge[]): GraphEdge[] {
  const set = new Set<string>();
  const result: GraphEdge[] = [];
  for (const edge of existing) {
    const key = `${edge.from}|${edge.to}|${edge.type}`;
    if (!set.has(key)) {
      set.add(key);
      result.push(edge);
    }
  }
  for (const edge of incoming) {
    const key = `${edge.from}|${edge.to}|${edge.type}`;
    if (!set.has(key)) {
      set.add(key);
      result.push(edge);
    }
  }
  return result;
}

function sortForDeterminism(nodes: GraphNode[], edges: GraphEdge[]): void {
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => {
    const fromCmp = a.from.localeCompare(b.from);
    if (fromCmp !== 0) return fromCmp;
    const toCmp = a.to.localeCompare(b.to);
    if (toCmp !== 0) return toCmp;
    return a.type.localeCompare(b.type);
  });
}

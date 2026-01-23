import type { GraphNode, GraphEdge } from "./types.js";

export interface TruncateOptions {
  maxNodes: number;
  maxEdges: number;
}

export interface TruncateResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  truncatedNodes: number;
  truncatedEdges: number;
}

export function truncateGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: TruncateOptions
): TruncateResult {
  let truncated = false;
  let truncatedNodes = 0;
  let truncatedEdges = 0;

  const anchorNodes = nodes.filter((n) => n.anchor);
  const nonAnchorNodes = nodes.filter((n) => !n.anchor);

  nonAnchorNodes.sort((a, b) => {
    if (a.external !== b.external) {
      return a.external ? 1 : -1;
    }
    return b.confidence - a.confidence || a.id.localeCompare(b.id);
  });

  let finalNodes: GraphNode[];
  if (anchorNodes.length >= options.maxNodes) {
    finalNodes = anchorNodes.slice(0, options.maxNodes);
    truncatedNodes = anchorNodes.length - options.maxNodes + nonAnchorNodes.length;
    truncated = true;
  } else {
    const remainingSlots = options.maxNodes - anchorNodes.length;
    const selectedNonAnchors = nonAnchorNodes.slice(0, remainingSlots);
    finalNodes = [...anchorNodes, ...selectedNonAnchors];
    truncatedNodes = nonAnchorNodes.length - selectedNonAnchors.length;
    if (truncatedNodes > 0) truncated = true;
  }

  const nodeIds = new Set(finalNodes.map((n) => n.id));

  let filteredEdges = edges.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
  );

  filteredEdges.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.from.localeCompare(b.from) || a.to.localeCompare(b.to);
  });

  if (filteredEdges.length > options.maxEdges) {
    truncatedEdges = filteredEdges.length - options.maxEdges;
    filteredEdges = filteredEdges.slice(0, options.maxEdges);
    truncated = true;
  }

  return {
    nodes: finalNodes,
    edges: filteredEdges,
    truncated,
    truncatedNodes,
    truncatedEdges,
  };
}

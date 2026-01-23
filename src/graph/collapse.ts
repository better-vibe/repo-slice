import type { GraphNode, GraphEdge, CollapseMode } from "./types.js";
import { dirname } from "node:path";

export interface CollapseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function applyCollapse(
  nodes: GraphNode[],
  edges: GraphEdge[],
  mode: CollapseMode
): CollapseResult {
  switch (mode) {
    case "none":
      return { nodes, edges };
    case "external":
      return collapseExternal(nodes, edges);
    case "file":
      return collapseToFile(nodes, edges);
    case "class":
      return collapseToClass(nodes, edges);
    default:
      return { nodes, edges };
  }
}

function collapseExternal(
  nodes: GraphNode[],
  edges: GraphEdge[]
): CollapseResult {
  const externalNodes = nodes.filter((n) => n.external);
  const internalNodes = nodes.filter((n) => !n.external);

  if (externalNodes.length === 0) {
    return { nodes, edges };
  }

  const externalNodeId = "__external__";
  const externalIds = new Set(externalNodes.map((n) => n.id));

  const collapsedExternalNode: GraphNode = {
    id: externalNodeId,
    kind: "module",
    lang: "ts",
    name: "external",
    filePath: "__external__",
    workspaceRoot: ".",
    anchor: false,
    external: true,
    confidence: 1.0,
  };

  const newEdges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const edge of edges) {
    const fromExternal = externalIds.has(edge.from);
    const toExternal = externalIds.has(edge.to);

    let newFrom = edge.from;
    let newTo = edge.to;

    if (fromExternal) newFrom = externalNodeId;
    if (toExternal) newTo = externalNodeId;

    if (newFrom === externalNodeId && newTo === externalNodeId) {
      continue;
    }

    const edgeKey = `${newFrom}|${newTo}|${edge.type}`;
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey);
      newEdges.push({
        ...edge,
        from: newFrom,
        to: newTo,
      });
    }
  }

  const hasExternalEdges = newEdges.some(
    (e) => e.from === externalNodeId || e.to === externalNodeId
  );

  const finalNodes = hasExternalEdges
    ? [...internalNodes, collapsedExternalNode]
    : internalNodes;

  return {
    nodes: finalNodes,
    edges: newEdges,
  };
}

function collapseToFile(
  nodes: GraphNode[],
  edges: GraphEdge[]
): CollapseResult {
  const fileNodes = new Map<string, GraphNode>();
  const nodeIdToFileId = new Map<string, string>();

  for (const node of nodes) {
    const fileId = `${node.lang}:${node.filePath}`;
    nodeIdToFileId.set(node.id, fileId);

    if (!fileNodes.has(fileId)) {
      fileNodes.set(fileId, {
        id: fileId,
        kind: "file",
        lang: node.lang,
        name: node.filePath.split("/").pop() ?? node.filePath,
        filePath: node.filePath,
        workspaceRoot: node.workspaceRoot,
        anchor: node.anchor,
        external: node.external,
        confidence: node.confidence,
      });
    } else {
      const existingNode = fileNodes.get(fileId)!;
      existingNode.anchor = existingNode.anchor || node.anchor;
      existingNode.confidence = Math.max(existingNode.confidence, node.confidence);
    }
  }

  const newEdges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const edge of edges) {
    const newFrom = nodeIdToFileId.get(edge.from) ?? edge.from;
    const newTo = nodeIdToFileId.get(edge.to) ?? edge.to;

    if (newFrom === newTo) continue;

    const edgeKey = `${newFrom}|${newTo}|${edge.type}`;
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey);
      newEdges.push({
        ...edge,
        from: newFrom,
        to: newTo,
      });
    }
  }

  return {
    nodes: Array.from(fileNodes.values()),
    edges: newEdges,
  };
}

function collapseToClass(
  nodes: GraphNode[],
  edges: GraphEdge[]
): CollapseResult {
  const classNodes = new Map<string, GraphNode>();
  const nodeIdToClassId = new Map<string, string>();

  for (const node of nodes) {
    let classId: string;

    if (node.kind === "method" || node.kind === "constructor") {
      const parts = node.id.split("#");
      if (parts.length >= 2) {
        const symbolPath = parts[1];
        const symbolParts = symbolPath.split(".");
        if (symbolParts.length >= 2) {
          classId = `${parts[0]}#${symbolParts[0]}`;
        } else {
          classId = node.id;
        }
      } else {
        classId = node.id;
      }
    } else if (node.kind === "class") {
      classId = node.id;
    } else {
      classId = node.id;
    }

    nodeIdToClassId.set(node.id, classId);

    if (!classNodes.has(classId)) {
      const className = classId.includes("#")
        ? classId.split("#")[1]
        : node.name;
      classNodes.set(classId, {
        id: classId,
        kind: node.kind === "method" || node.kind === "constructor" ? "class" : node.kind,
        lang: node.lang,
        name: className,
        filePath: node.filePath,
        range: node.range,
        workspaceRoot: node.workspaceRoot,
        anchor: node.anchor,
        external: node.external,
        confidence: node.confidence,
      });
    } else {
      const existingNode = classNodes.get(classId)!;
      existingNode.anchor = existingNode.anchor || node.anchor;
      existingNode.confidence = Math.max(existingNode.confidence, node.confidence);
    }
  }

  const newEdges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const edge of edges) {
    const newFrom = nodeIdToClassId.get(edge.from) ?? edge.from;
    const newTo = nodeIdToClassId.get(edge.to) ?? edge.to;

    if (newFrom === newTo) continue;

    const edgeKey = `${newFrom}|${newTo}|${edge.type}`;
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey);
      newEdges.push({
        ...edge,
        from: newFrom,
        to: newTo,
      });
    }
  }

  return {
    nodes: Array.from(classNodes.values()),
    edges: newEdges,
  };
}

import type { GraphOutput, GraphNode, GraphEdge } from "../graph/types.js";

export function renderDotGraph(output: GraphOutput): string {
  const lines: string[] = [];
  lines.push("digraph G {");
  lines.push("  rankdir=LR;");
  lines.push("  node [shape=box];");
  lines.push("");

  const workspaces = new Set(output.nodes.map((n) => n.workspaceRoot));
  const useSubgraphs = workspaces.size > 1;

  if (useSubgraphs) {
    const nodesByWorkspace = groupNodesByWorkspace(output.nodes);
    let clusterIndex = 0;
    for (const [workspace, nodes] of nodesByWorkspace.entries()) {
      lines.push(`  subgraph cluster_${clusterIndex} {`);
      lines.push(`    label="${escapeLabel(workspace)}";`);
      for (const node of nodes) {
        lines.push(`    ${renderNode(node)}`);
      }
      lines.push("  }");
      lines.push("");
      clusterIndex++;
    }
  } else {
    for (const node of output.nodes) {
      lines.push(`  ${renderNode(node)}`);
    }
  }

  lines.push("");

  for (const edge of output.edges) {
    lines.push(`  ${renderEdge(edge)}`);
  }

  lines.push("}");
  return lines.join("\n");
}

function groupNodesByWorkspace(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const map = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const existing = map.get(node.workspaceRoot);
    if (existing) {
      existing.push(node);
    } else {
      map.set(node.workspaceRoot, [node]);
    }
  }
  return map;
}

function renderNode(node: GraphNode): string {
  const attrs: string[] = [`label="${escapeLabel(node.name)}"`];

  if (node.anchor) {
    attrs.push('style="filled"');
    attrs.push('fillcolor="lightblue"');
  } else if (node.external) {
    attrs.push('style="dashed"');
    attrs.push('color="gray"');
  }

  if (node.kind === "class") {
    attrs.push('shape="ellipse"');
  } else if (node.kind === "function" || node.kind === "method") {
    attrs.push('shape="diamond"');
  }

  return `"${escapeId(node.id)}" [${attrs.join(", ")}];`;
}

function renderEdge(edge: GraphEdge): string {
  const attrs: string[] = [];

  // Dynamic imports and calls get dashed lines
  if (edge.type === "imports-dynamic" || edge.type === "calls-dynamic" || edge.type === "calls-unknown") {
    attrs.push('style="dashed"');
  }
  if (edge.type === "tests") {
    attrs.push('color="green"');
    attrs.push('label="tests"');
  }
  if (edge.type === "calls") {
    attrs.push('color="blue"');
  }
  // Low confidence edges get dotted lines (only if not already styled)
  if (edge.confidence < 0.8 && !attrs.some(a => a.includes("style"))) {
    attrs.push('style="dotted"');
  }

  const attrStr = attrs.length > 0 ? ` [${attrs.join(", ")}]` : "";
  return `"${escapeId(edge.from)}" -> "${escapeId(edge.to)}"${attrStr};`;
}

function escapeId(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeLabel(label: string): string {
  return label
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

import { test, expect, describe } from "bun:test";
import { truncateGraph } from "../../src/graph/truncate.js";
import type { GraphNode, GraphEdge } from "../../src/graph/types.js";

function createNode(id: string, anchor: boolean = false, external: boolean = false): GraphNode {
  return {
    id,
    kind: "file",
    lang: "ts",
    name: id.split("/").pop() ?? id,
    filePath: id.replace("ts:", ""),
    workspaceRoot: ".",
    anchor,
    external,
    confidence: 1.0,
  };
}

function createEdge(from: string, to: string): GraphEdge {
  return {
    from,
    to,
    type: "imports",
    confidence: 1.0,
  };
}

describe("truncateGraph", () => {
  test("does not truncate when under limits", () => {
    const nodes = [
      createNode("ts:a.ts", true),
      createNode("ts:b.ts"),
    ];
    const edges = [createEdge("ts:a.ts", "ts:b.ts")];

    const result = truncateGraph(nodes, edges, { maxNodes: 10, maxEdges: 10 });

    expect(result.truncated).toBe(false);
    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);
    expect(result.truncatedNodes).toBe(0);
    expect(result.truncatedEdges).toBe(0);
  });

  test("prioritizes anchor nodes during truncation", () => {
    const nodes = [
      createNode("ts:anchor1.ts", true),
      createNode("ts:anchor2.ts", true),
      createNode("ts:other1.ts"),
      createNode("ts:other2.ts"),
      createNode("ts:other3.ts"),
    ];
    const edges: GraphEdge[] = [];

    const result = truncateGraph(nodes, edges, { maxNodes: 3, maxEdges: 10 });

    expect(result.truncated).toBe(true);
    expect(result.nodes.length).toBe(3);
    expect(result.truncatedNodes).toBe(2);

    const resultIds = result.nodes.map(n => n.id);
    expect(resultIds).toContain("ts:anchor1.ts");
    expect(resultIds).toContain("ts:anchor2.ts");
  });

  test("truncates edges to maxEdges", () => {
    const nodes = [
      createNode("ts:a.ts", true),
      createNode("ts:b.ts"),
      createNode("ts:c.ts"),
    ];
    const edges = [
      createEdge("ts:a.ts", "ts:b.ts"),
      createEdge("ts:a.ts", "ts:c.ts"),
      createEdge("ts:b.ts", "ts:c.ts"),
    ];

    const result = truncateGraph(nodes, edges, { maxNodes: 10, maxEdges: 2 });

    expect(result.truncated).toBe(true);
    expect(result.edges.length).toBe(2);
    expect(result.truncatedEdges).toBe(1);
  });

  test("removes edges referencing truncated nodes", () => {
    const nodes = [
      createNode("ts:a.ts", true),
      createNode("ts:b.ts"),
      createNode("ts:c.ts"),
    ];
    const edges = [
      createEdge("ts:a.ts", "ts:b.ts"),
      createEdge("ts:a.ts", "ts:c.ts"),
    ];

    const result = truncateGraph(nodes, edges, { maxNodes: 2, maxEdges: 10 });

    expect(result.nodes.length).toBe(2);
    const resultIds = new Set(result.nodes.map(n => n.id));

    for (const edge of result.edges) {
      expect(resultIds.has(edge.from)).toBe(true);
      expect(resultIds.has(edge.to)).toBe(true);
    }
  });

  test("deprioritizes external nodes", () => {
    const nodes = [
      createNode("ts:anchor.ts", true),
      createNode("ts:internal.ts"),
      createNode("ts:external.ts", false, true),
    ];
    const edges: GraphEdge[] = [];

    const result = truncateGraph(nodes, edges, { maxNodes: 2, maxEdges: 10 });

    const resultIds = result.nodes.map(n => n.id);
    expect(resultIds).toContain("ts:anchor.ts");
    expect(resultIds).toContain("ts:internal.ts");
    expect(resultIds).not.toContain("ts:external.ts");
  });
});

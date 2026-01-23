import { test, expect, describe } from "bun:test";
import { applyCollapse } from "../../src/graph/collapse.js";
import type { GraphNode, GraphEdge } from "../../src/graph/types.js";

function createNode(
  id: string,
  options: { anchor?: boolean; external?: boolean; kind?: GraphNode["kind"] } = {}
): GraphNode {
  const { anchor = false, external = false, kind = "file" } = options;
  const filePath = id.includes("#") ? id.split(":")[1].split("#")[0] : id.replace("ts:", "").replace("py:", "");
  return {
    id,
    kind,
    lang: id.startsWith("py:") ? "py" : "ts",
    name: id.split("/").pop()?.split("#").pop() ?? id,
    filePath,
    workspaceRoot: ".",
    anchor,
    external,
    confidence: 1.0,
  };
}

function createEdge(from: string, to: string, type: GraphEdge["type"] = "imports"): GraphEdge {
  return { from, to, type, confidence: 1.0 };
}

describe("applyCollapse - none mode", () => {
  test("returns nodes and edges unchanged", () => {
    const nodes = [
      createNode("ts:a.ts", { anchor: true }),
      createNode("ts:b.ts", { external: true }),
    ];
    const edges = [createEdge("ts:a.ts", "ts:b.ts")];

    const result = applyCollapse(nodes, edges, "none");

    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);
    expect(result.nodes).toEqual(nodes);
    expect(result.edges).toEqual(edges);
  });
});

describe("applyCollapse - external mode", () => {
  test("collapses all external nodes to single node", () => {
    const nodes = [
      createNode("ts:internal.ts", { anchor: true }),
      createNode("ts:ext1.ts", { external: true }),
      createNode("ts:ext2.ts", { external: true }),
    ];
    const edges = [
      createEdge("ts:internal.ts", "ts:ext1.ts"),
      createEdge("ts:internal.ts", "ts:ext2.ts"),
    ];

    const result = applyCollapse(nodes, edges, "external");

    expect(result.nodes.length).toBe(2);
    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain("ts:internal.ts");
    expect(nodeIds).toContain("__external__");
    expect(nodeIds).not.toContain("ts:ext1.ts");
    expect(nodeIds).not.toContain("ts:ext2.ts");
  });

  test("deduplicates edges to collapsed external node", () => {
    const nodes = [
      createNode("ts:internal.ts", { anchor: true }),
      createNode("ts:ext1.ts", { external: true }),
      createNode("ts:ext2.ts", { external: true }),
    ];
    const edges = [
      createEdge("ts:internal.ts", "ts:ext1.ts"),
      createEdge("ts:internal.ts", "ts:ext2.ts"),
    ];

    const result = applyCollapse(nodes, edges, "external");

    const externalEdges = result.edges.filter(
      e => e.to === "__external__" && e.from === "ts:internal.ts"
    );
    expect(externalEdges.length).toBe(1);
  });

  test("removes edges between external nodes", () => {
    const nodes = [
      createNode("ts:internal.ts", { anchor: true }),
      createNode("ts:ext1.ts", { external: true }),
      createNode("ts:ext2.ts", { external: true }),
    ];
    const edges = [
      createEdge("ts:internal.ts", "ts:ext1.ts"),
      createEdge("ts:ext1.ts", "ts:ext2.ts"),
    ];

    const result = applyCollapse(nodes, edges, "external");

    const internalEdges = result.edges.filter(
      e => e.from === "__external__" && e.to === "__external__"
    );
    expect(internalEdges.length).toBe(0);
  });

  test("does not add external node if no external edges remain", () => {
    const nodes = [
      createNode("ts:a.ts", { anchor: true }),
      createNode("ts:b.ts"),
    ];
    const edges = [createEdge("ts:a.ts", "ts:b.ts")];

    const result = applyCollapse(nodes, edges, "external");

    expect(result.nodes.length).toBe(2);
    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).not.toContain("__external__");
  });
});

describe("applyCollapse - file mode", () => {
  test("collapses symbol nodes to file nodes", () => {
    const nodes = [
      createNode("ts:src/foo.ts#funcA", { kind: "function" }),
      createNode("ts:src/foo.ts#funcB", { kind: "function" }),
      createNode("ts:src/bar.ts#funcC", { kind: "function" }),
    ];
    const edges = [
      createEdge("ts:src/foo.ts#funcA", "ts:src/bar.ts#funcC", "calls"),
    ];

    const result = applyCollapse(nodes, edges, "file");

    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain("ts:src/foo.ts");
    expect(nodeIds).toContain("ts:src/bar.ts");
    expect(nodeIds).not.toContain("ts:src/foo.ts#funcA");
    expect(nodeIds).not.toContain("ts:src/foo.ts#funcB");
  });

  test("removes self-edges after file collapse", () => {
    const nodes = [
      createNode("ts:src/foo.ts#funcA", { kind: "function" }),
      createNode("ts:src/foo.ts#funcB", { kind: "function" }),
    ];
    const edges = [
      createEdge("ts:src/foo.ts#funcA", "ts:src/foo.ts#funcB", "calls"),
    ];

    const result = applyCollapse(nodes, edges, "file");

    expect(result.edges.length).toBe(0);
  });

  test("preserves anchor status when collapsing", () => {
    const nodes = [
      createNode("ts:src/foo.ts#funcA", { kind: "function", anchor: true }),
      createNode("ts:src/foo.ts#funcB", { kind: "function" }),
    ];
    const edges: GraphEdge[] = [];

    const result = applyCollapse(nodes, edges, "file");

    const fooNode = result.nodes.find(n => n.id === "ts:src/foo.ts");
    expect(fooNode?.anchor).toBe(true);
  });
});

describe("applyCollapse - class mode", () => {
  test("collapses method nodes to class nodes", () => {
    const nodes = [
      createNode("ts:src/foo.ts#MyClass.methodA", { kind: "method" }),
      createNode("ts:src/foo.ts#MyClass.methodB", { kind: "method" }),
      createNode("ts:src/bar.ts#OtherClass.methodC", { kind: "method" }),
    ];
    const edges = [
      createEdge("ts:src/foo.ts#MyClass.methodA", "ts:src/bar.ts#OtherClass.methodC", "calls"),
    ];

    const result = applyCollapse(nodes, edges, "class");

    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain("ts:src/foo.ts#MyClass");
    expect(nodeIds).toContain("ts:src/bar.ts#OtherClass");
    expect(nodeIds).not.toContain("ts:src/foo.ts#MyClass.methodA");
    expect(nodeIds).not.toContain("ts:src/foo.ts#MyClass.methodB");
  });

  test("removes self-edges after class collapse", () => {
    const nodes = [
      createNode("ts:src/foo.ts#MyClass.methodA", { kind: "method" }),
      createNode("ts:src/foo.ts#MyClass.methodB", { kind: "method" }),
    ];
    const edges = [
      createEdge("ts:src/foo.ts#MyClass.methodA", "ts:src/foo.ts#MyClass.methodB", "calls"),
    ];

    const result = applyCollapse(nodes, edges, "class");

    expect(result.edges.length).toBe(0);
  });

  test("preserves non-method nodes", () => {
    const nodes = [
      createNode("ts:src/foo.ts", { kind: "file" }),
      createNode("ts:src/foo.ts#MyClass.method", { kind: "method" }),
    ];
    const edges: GraphEdge[] = [];

    const result = applyCollapse(nodes, edges, "class");

    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain("ts:src/foo.ts");
    expect(nodeIds).toContain("ts:src/foo.ts#MyClass");
  });
});

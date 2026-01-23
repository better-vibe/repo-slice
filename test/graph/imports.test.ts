import { test, expect, describe } from "bun:test";
import type { GraphNode, GraphEdge } from "../../src/graph/types.js";

describe("import graph types", () => {
  test("GraphNode has required fields", () => {
    const node: GraphNode = {
      id: "ts:src/foo.ts",
      kind: "file",
      lang: "ts",
      name: "foo.ts",
      filePath: "src/foo.ts",
      workspaceRoot: ".",
      anchor: true,
      external: false,
      confidence: 1.0,
    };
    expect(node.id).toBe("ts:src/foo.ts");
    expect(node.kind).toBe("file");
    expect(node.anchor).toBe(true);
    expect(node.external).toBe(false);
  });

  test("GraphEdge has required fields", () => {
    const edge: GraphEdge = {
      from: "ts:src/a.ts",
      to: "ts:src/b.ts",
      type: "imports",
      confidence: 1.0,
    };
    expect(edge.from).toBe("ts:src/a.ts");
    expect(edge.to).toBe("ts:src/b.ts");
    expect(edge.type).toBe("imports");
    expect(edge.confidence).toBe(1.0);
  });

  test("node id follows lang:path#symbol format", () => {
    const fileNode: GraphNode = {
      id: "ts:src/cli.ts",
      kind: "file",
      lang: "ts",
      name: "cli.ts",
      filePath: "src/cli.ts",
      workspaceRoot: ".",
      anchor: false,
      external: false,
      confidence: 1.0,
    };
    expect(fileNode.id).toMatch(/^ts:/);
    expect(fileNode.id).not.toContain("#");

    const symbolNode: GraphNode = {
      id: "ts:src/commands/pack.ts#packCommand",
      kind: "function",
      lang: "ts",
      name: "packCommand",
      filePath: "src/commands/pack.ts",
      workspaceRoot: ".",
      anchor: false,
      external: false,
      confidence: 1.0,
    };
    expect(symbolNode.id).toMatch(/^ts:.*#/);
    expect(symbolNode.id).toContain("#packCommand");
  });
});

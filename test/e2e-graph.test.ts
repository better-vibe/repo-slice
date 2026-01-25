import { test, expect, describe, beforeAll } from "bun:test";
import { spawn } from "bun";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");
const REPO_ROOT = join(import.meta.dir, "..");

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCli(args: string[], cwd: string = REPO_ROOT): Promise<RunResult> {
  const proc = spawn({
    cmd: ["bun", "run", CLI_PATH, ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("e2e: graph command - basics", () => {
  test("shows help with --help", async () => {
    const result = await runCli(["graph", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("repo-slice graph");
    expect(result.stdout).toContain("--graph-type");
    expect(result.stdout).toContain("--depth");
    expect(result.stdout).toContain("--collapse");
  });

  test("fails on unknown flag", async () => {
    const result = await runCli(["graph", "--unknown-flag"]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Unknown flag");
  });
});

describe("e2e: graph command - JSON output", () => {
  test("generates import graph JSON", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("nodes");
    expect(json).toHaveProperty("edges");
    expect(json.meta.graphType).toBe("imports");
  });

  test("JSON has required meta fields", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta).toHaveProperty("command");
    expect(json.meta).toHaveProperty("scope");
    expect(json.meta).toHaveProperty("graphType");
    expect(json.meta).toHaveProperty("depth");
    expect(json.meta).toHaveProperty("maxNodes");
    expect(json.meta).toHaveProperty("maxEdges");
    expect(json.meta).toHaveProperty("collapse");
    expect(json.meta).toHaveProperty("truncated");
  });

  test("JSON nodes have required fields", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
      "--depth", "1",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.nodes.length).toBeGreaterThan(0);

    const node = json.nodes[0];
    expect(node).toHaveProperty("id");
    expect(node).toHaveProperty("kind");
    expect(node).toHaveProperty("lang");
    expect(node).toHaveProperty("name");
    expect(node).toHaveProperty("filePath");
    expect(node).toHaveProperty("workspaceRoot");
    expect(node).toHaveProperty("anchor");
    expect(node).toHaveProperty("external");
    expect(node).toHaveProperty("confidence");
  });

  test("JSON edges have required fields", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
      "--depth", "1",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.edges.length).toBeGreaterThan(0);

    const edge = json.edges[0];
    expect(edge).toHaveProperty("from");
    expect(edge).toHaveProperty("to");
    expect(edge).toHaveProperty("type");
    expect(edge).toHaveProperty("confidence");
  });
});

describe("e2e: graph command - DOT output", () => {
  test("generates valid DOT output", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "dot",
      "--no-timestamp",
      "--depth", "1",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("digraph G {");
    expect(result.stdout).toContain("rankdir=LR");
    expect(result.stdout).toContain("}");
  });

  test("DOT output contains nodes and edges", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "dot",
      "--no-timestamp",
      "--depth", "1",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[label=");
    expect(result.stdout).toContain("->");
  });

  test("DOT highlights anchor nodes", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "dot",
      "--no-timestamp",
      "--depth", "1",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('fillcolor="lightblue"');
    expect(result.stdout).toContain('style="filled"');
  });
});

describe("e2e: graph command - graph types", () => {
  test("imports graph type (default)", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--graph-type", "imports",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.graphType).toBe("imports");

    const edgeTypes = new Set(json.edges.map((e: any) => e.type));
    expect(edgeTypes.has("imports")).toBe(true);
  });

  test("calls graph type", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--graph-type", "calls",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.graphType).toBe("calls");
  });

  test("combined graph type", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--graph-type", "combined",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.graphType).toBe("combined");
  });
});

describe("e2e: graph command - depth control", () => {
  test("respects depth limit", async () => {
    const depth0 = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "0",
      "--format", "json",
      "--no-timestamp",
    ]);
    const depth2 = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "2",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(depth0.exitCode).toBe(0);
    expect(depth2.exitCode).toBe(0);

    const json0 = JSON.parse(depth0.stdout);
    const json2 = JSON.parse(depth2.stdout);

    expect(json2.nodes.length).toBeGreaterThanOrEqual(json0.nodes.length);
  });

  test("depth 0 includes only anchor nodes", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "0",
      "--format", "json",
      "--no-timestamp",
      "--collapse", "none",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);

    // With depth 0, we should have minimal nodes (just the anchor)
    const anchorNodes = json.nodes.filter((n: any) => n.anchor);
    expect(anchorNodes.length).toBeGreaterThan(0);
  });
});

describe("e2e: graph command - truncation", () => {
  test("reports truncation when exceeded", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "5",
      "--max-nodes", "5",
      "--max-edges", "10",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);

    expect(json.nodes.length).toBeLessThanOrEqual(5);
    expect(json.edges.length).toBeLessThanOrEqual(10);

    if (json.meta.truncated) {
      expect(json.meta.truncatedNodes !== undefined || json.meta.truncatedEdges !== undefined).toBe(true);
    }
  });

  test("preserves anchor nodes during truncation", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "3",
      "--max-nodes", "3",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);

    const anchorNodes = json.nodes.filter((n: any) => n.anchor);
    expect(anchorNodes.length).toBeGreaterThan(0);
  });
});

describe("e2e: graph command - collapse modes", () => {
  test("collapse=none includes all nodes", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--collapse", "none",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.collapse).toBe("none");
  });

  test("collapse=external is default", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.collapse).toBe("external");
  });

  test("collapse=file collapses to file level", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--graph-type", "calls",
      "--collapse", "file",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.meta.collapse).toBe("file");

    for (const node of json.nodes) {
      expect(node.kind).toBe("file");
    }
  });
});

describe("e2e: graph command - determinism", () => {
  test("produces identical output with --no-timestamp", async () => {
    const run1 = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
    ]);
    const run2 = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(run1.exitCode).toBe(0);
    expect(run2.exitCode).toBe(0);
    expect(run1.stdout).toBe(run2.stdout);
  });

  test("DOT output is deterministic", async () => {
    const run1 = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "dot",
      "--no-timestamp",
    ]);
    const run2 = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "dot",
      "--no-timestamp",
    ]);
    expect(run1.exitCode).toBe(0);
    expect(run2.exitCode).toBe(0);
    expect(run1.stdout).toBe(run2.stdout);
  });
});

describe("e2e: graph command - file output", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "repo-slice-graph-test-"));
  });

  test("writes JSON to file with --out", async () => {
    const outPath = join(tempDir, "graph.json");
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "json",
      "--out", outPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const content = await Bun.file(outPath).text();
    const json = JSON.parse(content);
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("nodes");
    expect(json).toHaveProperty("edges");
  });

  test("writes DOT to file with --out", async () => {
    const outPath = join(tempDir, "graph.dot");
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "dot",
      "--out", outPath,
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);

    const content = await Bun.file(outPath).text();
    expect(content).toContain("digraph G {");
  });
});

describe("e2e: graph command - symbol anchors", () => {
  test("accepts --symbol anchor", async () => {
    const result = await runCli([
      "graph",
      "--symbol", "packCommand",
      "--format", "json",
      "--no-timestamp",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.nodes.length).toBeGreaterThan(0);
  });

  test("reports unresolved symbol", async () => {
    const result = await runCli([
      "graph",
      "--symbol", "NonExistentSymbol12345",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Symbol(s) not found");
  });
});

describe("e2e: graph command - validation", () => {
  test("fails on invalid graph-type", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--graph-type", "invalid",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid graph-type");
  });

  test("fails on invalid collapse mode", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--collapse", "invalid",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid collapse");
  });

  test("fails on invalid format", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--format", "xml",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid format");
  });

  test("fails on conflicting workspace flags", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--workspace", "foo",
      "--all-workspaces",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Cannot combine");
  });
});

describe("e2e: graph command - dynamic imports", () => {
  test("detects dynamic imports as imports-dynamic edges", async () => {
    // src/cli.ts uses dynamic imports: await import("./commands/pack.js")
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "1",
      "--format", "json",
      "--no-timestamp",
      "--collapse", "none",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    
    // Find edges from cli.ts
    const cliNodeId = json.nodes.find((n: any) => n.filePath.endsWith("cli.ts"))?.id;
    expect(cliNodeId).toBeDefined();
    
    // Check for imports-dynamic edges to dynamically imported commands
    const dynamicEdges = json.edges.filter((e: any) => 
      e.from === cliNodeId && e.type === "imports-dynamic"
    );
    
    // cli.ts has dynamic imports to pack.ts, graph.ts, workspaces.ts, version.ts
    expect(dynamicEdges.length).toBeGreaterThanOrEqual(4);
    
    // Verify at least one points to commands/pack
    const packEdge = dynamicEdges.find((e: any) => 
      e.to.includes("commands/pack")
    );
    expect(packEdge).toBeDefined();
    expect(packEdge.type).toBe("imports-dynamic");
    // Dynamic imports have slightly lower confidence
    expect(packEdge.confidence).toBeLessThan(1.0);
  });

  test("static imports have higher precedence than dynamic", async () => {
    // src/cli.ts has a static import of renderHelp from help.js
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "1",
      "--format", "json",
      "--no-timestamp",
      "--collapse", "none",
    ]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    
    // Find edge from cli.ts to help.ts (static import)
    const cliNodeId = json.nodes.find((n: any) => n.filePath.endsWith("cli.ts"))?.id;
    const helpEdge = json.edges.find((e: any) => 
      e.from === cliNodeId && e.to.includes("commands/help")
    );
    
    // help.ts is imported statically, so should be "imports" not "imports-dynamic"
    expect(helpEdge).toBeDefined();
    expect(helpEdge.type).toBe("imports");
    expect(helpEdge.confidence).toBe(1.0);
  });

  test("DOT output shows dynamic imports with dashed lines", async () => {
    const result = await runCli([
      "graph",
      "--entry", "src/cli.ts",
      "--depth", "1",
      "--format", "dot",
      "--no-timestamp",
      "--collapse", "none",
    ]);
    expect(result.exitCode).toBe(0);
    
    // DOT output should contain dashed style for dynamic imports
    expect(result.stdout).toContain('style="dashed"');
  });
});

import type { AdapterIndex, ImportEdgeType } from "../adapters/types.js";
import type { GraphNode, GraphEdge, IncludeTestsMode, EdgeType } from "./types.js";
import { languageFromPath } from "../utils/lang.js";
import { toPosixPath } from "../utils/path.js";
import { relative, basename, extname, dirname, join } from "node:path";
import fg from "fast-glob";
import type { IgnoreMatcher } from "../ignore.js";

export interface ImportGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ImportGraphOptions {
  adapters: AdapterIndex[];
  anchorFiles: Set<string>;
  repoRoot: string;
  depth: number;
  includeTests: IncludeTestsMode;
  includeExternal: boolean;
  ignoreMatchers: Map<string, IgnoreMatcher>;
}

export async function buildImportGraph(
  options: ImportGraphOptions
): Promise<ImportGraphResult> {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adapterByFile = new Map<string, AdapterIndex>();

  for (const adapter of options.adapters) {
    for (const file of adapter.files) {
      adapterByFile.set(file, adapter);
    }
  }

  for (const anchorFile of options.anchorFiles) {
    const adapter = adapterByFile.get(anchorFile);
    if (!adapter) continue;

    const graph = adapter.importGraph;
    const visited = new Set<string>([anchorFile]);
    const queue: Array<{ file: string; distance: number }> = [
      { file: anchorFile, distance: 0 },
    ];

    const anchorNode = createFileNode({
      filePath: anchorFile,
      repoRoot: options.repoRoot,
      workspaceRoot: adapter.workspace.root,
      anchor: true,
      external: false,
    });
    nodes.set(anchorNode.id, anchorNode);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const nextDistance = current.distance + 1;
      if (nextDistance > options.depth) continue;

      const neighbors = graph.get(current.file);
      if (!neighbors) continue;

      // Sort neighbor entries by target file for determinism
      const sortedNeighbors = Array.from(neighbors.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );
      for (const [neighbor, importEdgeType] of sortedNeighbors) {
        const fromId = createNodeId(current.file, options.repoRoot);
        const toId = createNodeId(neighbor, options.repoRoot);

        if (!visited.has(neighbor)) {
          visited.add(neighbor);

          const neighborAdapter = adapterByFile.get(neighbor);
          const isExternal = !neighborAdapter;

          if (!isExternal || options.includeExternal) {
            const neighborNode = createFileNode({
              filePath: neighbor,
              repoRoot: options.repoRoot,
              workspaceRoot: neighborAdapter?.workspace.root ?? options.repoRoot,
              anchor: false,
              external: isExternal,
            });
            nodes.set(neighborNode.id, neighborNode);
            queue.push({ file: neighbor, distance: nextDistance });
          }
        }

        const fromNode = nodes.get(fromId);
        const toNode = nodes.get(toId);
        if (fromNode && toNode) {
          // Map adapter edge type to graph edge type
          const graphEdgeType: EdgeType = importEdgeType === "imports-dynamic" 
            ? "imports-dynamic" 
            : "imports";
          edges.push({
            from: fromId,
            to: toId,
            type: graphEdgeType,
            confidence: importEdgeType === "imports-dynamic" ? 0.9 : 1.0,
          });
        }
      }
    }

    if (options.includeTests !== "false") {
      const shouldInclude =
        options.includeTests === "true" || /[\\/](src|lib)[\\/]/.test(anchorFile);
      if (shouldInclude) {
        const matcher =
          options.ignoreMatchers.get(adapter.workspace.id) ??
          options.ignoreMatchers.values().next().value;
        const tests = await findRelatedTests(
          adapter.workspace.root,
          anchorFile,
          matcher
        );
        for (const testFile of tests) {
          const testNode = createFileNode({
            filePath: testFile,
            repoRoot: options.repoRoot,
            workspaceRoot: adapter.workspace.root,
            anchor: false,
            external: false,
          });
          if (!nodes.has(testNode.id)) {
            nodes.set(testNode.id, testNode);
          }
          const anchorNodeId = createNodeId(anchorFile, options.repoRoot);
          edges.push({
            from: testNode.id,
            to: anchorNodeId,
            type: "tests",
            confidence: 1.0,
          });
        }
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

function createNodeId(filePath: string, repoRoot: string): string {
  const lang = languageFromPath(filePath);
  const relPath = toPosixPath(relative(repoRoot, filePath)) || filePath;
  return `${lang}:${relPath}`;
}

function createFileNode(options: {
  filePath: string;
  repoRoot: string;
  workspaceRoot: string;
  anchor: boolean;
  external: boolean;
}): GraphNode {
  const { filePath, repoRoot, workspaceRoot, anchor, external } = options;
  const relPath = toPosixPath(relative(repoRoot, filePath)) || filePath;
  const lang = languageFromPath(filePath);
  return {
    id: `${lang}:${relPath}`,
    kind: "file",
    lang,
    name: basename(filePath),
    filePath: relPath,
    workspaceRoot: toPosixPath(relative(repoRoot, workspaceRoot)) || ".",
    anchor,
    external,
    confidence: 1.0,
  };
}

async function findRelatedTests(
  workspaceRoot: string,
  anchorFile: string,
  ignoreMatcher?: IgnoreMatcher
): Promise<string[]> {
  const base = basename(anchorFile, extname(anchorFile));
  const patterns = [
    `**/${base}.test.*`,
    `**/${base}.spec.*`,
    `**/test_${base}.*`,
  ];
  const matches = await fg(patterns, {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  const filtered = ignoreMatcher
    ? matches.filter((file) => !ignoreMatcher.ignores(file))
    : matches;
  return filtered.sort();
}

import { detectRepoRoot } from "../workspaces/repoRoot.js";
import { detectWorkspaces } from "../workspaces/detectWorkspaces.js";
import {
  resolveWorkspaceScope,
  findWorkspaceForPath,
} from "../workspaces/scope.js";
import { loadConfig } from "../config.js";
import { createIgnoreMatcher, type IgnoreMatcher } from "../ignore.js";
import { buildAdaptersForWorkspace, type AdapterCacheData } from "../adapters/index.js";
import { resolveAnchors } from "../anchors/index.js";
import { getDiffHunks } from "../anchors/diff.js";
import { parseLogAnchors } from "../anchors/log.js";
import { buildGraph } from "./builder.js";
import type {
  GraphCliArgs,
  GraphMeta,
  GraphOutput,
} from "./types.js";
import { renderDotGraph } from "../output/dot.js";
import { createLogger } from "../utils/log.js";
import { readText } from "../utils/fs.js";
import { normalizePath, toPosixPath } from "../utils/path.js";
import fg from "fast-glob";
import { resolve as resolvePath, relative } from "node:path";
import { writeFile } from "node:fs/promises";
import type { Workspace } from "../workspaces/types.js";
import type { AdapterIndex } from "../adapters/types.js";

export async function runGraph(args: GraphCliArgs): Promise<void> {
  const cwd = process.cwd();
  const repoRoot = await detectRepoRoot(cwd);
  const allWorkspaces = await detectWorkspaces(repoRoot);
  const { config: repoConfig } = await loadConfig(repoRoot);
  const allWorkspacesFlag =
    args.allWorkspaces ?? repoConfig.workspaces.mode === "all";
  const workspaceFlag = args.workspace ?? repoConfig.workspaces.mode;
  const scope = await resolveWorkspaceScope({
    workspaces: allWorkspaces,
    cwd,
    workspaceFlag: workspaceFlag === "all" ? undefined : workspaceFlag,
    allWorkspaces: allWorkspacesFlag,
  });
  let scopeMode = scope.mode;

  if (scope.workspaces.length === 0) {
    throw new Error("No workspaces detected");
  }

  const primaryWorkspace = scope.workspaces[0];
  const { config: baseConfig } = await loadConfig(repoRoot, primaryWorkspace?.root);
  const effectiveConfig = applyCliOverrides(baseConfig, args);
  const includeTests = args.includeTests ?? effectiveConfig.includeTests;
  const logger = createLogger(Boolean(args.debug));

  const diffHunks = args.fromDiff
    ? await getDiffHunks(repoRoot, args.fromDiff)
    : undefined;
  const logPath = args.fromLog ? resolvePath(cwd, args.fromLog) : undefined;
  const logAnchors = logPath
    ? parseLogAnchors(await readText(logPath), repoRoot)
    : undefined;

  let bundleWorkspaces = collectAnchorWorkspaces({
    allWorkspaces,
    baseWorkspaces: scope.workspaces,
    cwd,
    entries: args.entries,
    diffHunks,
    logAnchors,
  });

  let adapters = await buildAdapters({
    repoRoot,
    workspaces: bundleWorkspaces,
    args,
    logger,
  });

  let symbolAdapters = filterAdaptersByWorkspaces(adapters, scope.workspaces);

  let anchorResolution = await resolveAnchors({
    repoRoot,
    cwd,
    workspaces: bundleWorkspaces,
    adapters: symbolAdapters,
    entries: args.entries,
    symbols: args.symbols,
    fromDiff: args.fromDiff,
    fromLog: logPath ?? args.fromLog,
    diffHunks,
    logAnchors,
  });

  if (
    anchorResolution.unresolvedSymbols.length > 0 &&
    args.fallbackAll &&
    !args.allWorkspaces
  ) {
    logger.debug("Symbol not found in scope; retrying across all workspaces");
    bundleWorkspaces = allWorkspaces;
    scopeMode = "all";
    adapters = await buildAdapters({
      repoRoot,
      workspaces: bundleWorkspaces,
      args,
      logger,
    });
    symbolAdapters = adapters;
    anchorResolution = await resolveAnchors({
      repoRoot,
      cwd,
      workspaces: bundleWorkspaces,
      adapters: symbolAdapters,
      entries: args.entries,
      symbols: args.symbols,
      fromDiff: args.fromDiff,
      fromLog: logPath ?? args.fromLog,
      diffHunks,
      logAnchors,
    });
  }

  if (anchorResolution.unresolvedSymbols.length > 0) {
    process.stderr.write(
      `Symbol(s) not found: ${anchorResolution.unresolvedSymbols.join(", ")}\n`
    );
    process.stderr.write("Try --all-workspaces or --fallback-all\n");
    process.exit(2);
  }

  if (args.symbolStrict && anchorResolution.ambiguousSymbols.length > 0) {
    process.stderr.write("Ambiguous symbol(s) found (--symbol-strict enabled):\n");
    for (const ambiguous of anchorResolution.ambiguousSymbols) {
      process.stderr.write(`  ${ambiguous.query}:\n`);
      for (const def of ambiguous.definitions) {
        const relPath = def.filePath.replace(repoRoot + "/", "");
        process.stderr.write(`    - ${relPath}:${def.range.startLine}\n`);
      }
    }
    process.stderr.write(
      "Use file-hint syntax (e.g., path/to/file.ts:SymbolName) to disambiguate.\n"
    );
    process.exit(2);
  }

  const ignoreMatchers = await buildIgnoreMatchers({
    repoRoot,
    workspaces: bundleWorkspaces,
    args,
  });

  const graphResult = await buildGraph({
    adapters,
    anchorFiles: anchorResolution.anchorFiles,
    repoRoot,
    graphType: args.graphType,
    depth: args.depth,
    includeTests,
    includeExternal: args.includeExternal ?? false,
    maxNodes: args.maxNodes,
    maxEdges: args.maxEdges,
    collapse: args.collapse,
    ignoreMatchers,
  });

  const meta: GraphMeta = {
    repoRoot: toPosixPath(relative(cwd, repoRoot)) || ".",
    generatedAt: args.noTimestamp ? undefined : new Date().toISOString(),
    command: `repo-slice ${process.argv.slice(2).join(" ")}`,
    scope: {
      mode: scopeMode,
      workspaces: bundleWorkspaces.map((ws) => ws.id),
    },
    graphType: args.graphType,
    depth: args.depth,
    maxNodes: args.maxNodes,
    maxEdges: args.maxEdges,
    collapse: args.collapse,
    truncated: graphResult.truncated,
    truncatedNodes: graphResult.truncatedNodes > 0 ? graphResult.truncatedNodes : undefined,
    truncatedEdges: graphResult.truncatedEdges > 0 ? graphResult.truncatedEdges : undefined,
  };

  const output: GraphOutput = {
    meta,
    nodes: graphResult.nodes,
    edges: graphResult.edges,
  };

  const rendered =
    args.format === "json"
      ? renderJsonGraph(output)
      : renderDotGraph(output);

  if (args.out) {
    const outPath = resolvePath(cwd, args.out);
    await writeFile(outPath, rendered, "utf8");
  } else {
    process.stdout.write(rendered + "\n");
  }
}

function renderJsonGraph(output: GraphOutput): string {
  return JSON.stringify(output, null, 2);
}

function applyCliOverrides(
  baseConfig: {
    depth: number;
    includeTests: "auto" | "true" | "false";
    ignore: string[];
    workspaces: { pythonImportRoots: string[] };
  },
  args: GraphCliArgs
) {
  return {
    ...baseConfig,
    depth: args.depth ?? baseConfig.depth,
    includeTests: args.includeTests ?? baseConfig.includeTests,
  };
}

function collectAnchorWorkspaces(options: {
  allWorkspaces: Workspace[];
  baseWorkspaces: Workspace[];
  cwd: string;
  entries: string[];
  diffHunks?: { filePath: string }[];
  logAnchors?: { filePath: string }[];
}): Workspace[] {
  const map = new Map<string, Workspace>();
  for (const ws of options.baseWorkspaces) {
    map.set(ws.root, ws);
  }
  for (const entry of options.entries) {
    const path = resolvePath(options.cwd, entry);
    const workspace = findWorkspaceForPath(options.allWorkspaces, path);
    if (workspace) map.set(workspace.root, workspace);
  }
  for (const hunk of options.diffHunks ?? []) {
    const workspace = findWorkspaceForPath(options.allWorkspaces, hunk.filePath);
    if (workspace) map.set(workspace.root, workspace);
  }
  for (const anchor of options.logAnchors ?? []) {
    const workspace = findWorkspaceForPath(options.allWorkspaces, anchor.filePath);
    if (workspace) map.set(workspace.root, workspace);
  }
  return Array.from(map.values()).sort((a, b) => a.root.localeCompare(b.root));
}

async function buildAdapters(options: {
  repoRoot: string;
  workspaces: Workspace[];
  args: GraphCliArgs;
  logger: { debug: (message: string) => void };
}): Promise<AdapterIndex[]> {
  const adapters: AdapterIndex[] = [];
  for (const workspace of options.workspaces) {
    const { config } = await loadConfig(options.repoRoot, workspace.root);
    const effectiveConfig = applyCliOverrides(config, options.args);
    options.logger.debug(`Indexing workspace ${workspace.root}`);
    const ignoreMatcher = await createIgnoreMatcher({
      repoRoot: options.repoRoot,
      workspaceRoot: workspace.root,
      extraIgnorePatterns: config.ignore,
    });
    const files = await detectWorkspaceFiles(workspace.root, ignoreMatcher);
    const workspaceAdapters = await buildAdaptersForWorkspace({
      workspace,
      ignoreMatcher,
      pythonImportRoots: config.workspaces.pythonImportRoots,
      files,
    });
    adapters.push(...workspaceAdapters);
  }
  return adapters;
}

async function buildIgnoreMatchers(options: {
  repoRoot: string;
  workspaces: Workspace[];
  args: GraphCliArgs;
}): Promise<Map<string, IgnoreMatcher>> {
  const map = new Map<string, IgnoreMatcher>();
  for (const workspace of options.workspaces) {
    const { config } = await loadConfig(options.repoRoot, workspace.root);
    const ignoreMatcher = await createIgnoreMatcher({
      repoRoot: options.repoRoot,
      workspaceRoot: workspace.root,
      extraIgnorePatterns: config.ignore,
    });
    map.set(workspace.id, ignoreMatcher);
  }
  return map;
}

function filterAdaptersByWorkspaces(
  adapters: AdapterIndex[],
  workspaces: Workspace[]
): AdapterIndex[] {
  const workspaceRoots = new Set(workspaces.map((ws) => ws.root));
  return adapters.filter((adapter) => workspaceRoots.has(adapter.workspace.root));
}

async function detectWorkspaceFiles(
  workspaceRoot: string,
  ignoreMatcher: IgnoreMatcher
): Promise<{ tsFiles: string[]; pyFiles: string[] }> {
  const tsFiles = await fg(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"], {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  const pyFiles = await fg(["**/*.py"], {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  return {
    tsFiles: tsFiles
      .map((file) => normalizePath(file))
      .filter((file) => !ignoreMatcher.ignores(file))
      .sort(),
    pyFiles: pyFiles
      .map((file) => normalizePath(file))
      .filter((file) => !ignoreMatcher.ignores(file))
      .sort(),
  };
}

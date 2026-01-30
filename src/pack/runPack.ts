import { detectRepoRoot } from "../workspaces/repoRoot.js";
import { detectWorkspaces } from "../workspaces/detectWorkspaces.js";
import {
  resolveWorkspaceScope,
  findWorkspaceForPath,
} from "../workspaces/scope.js";
import { loadConfig } from "../config.js";
import { createIgnoreMatcher } from "../ignore.js";
import { buildAdaptersForWorkspace } from "../adapters/index.js";
import { resolveAnchors } from "../anchors/index.js";
import { getDiffHunks } from "../anchors/diff.js";
import { parseLogAnchors } from "../anchors/log.js";
import {
  addCandidate,
  applySizePenalty,
  candidateId,
  estimateSnippetChars,
  rankCandidates,
} from "../engine/candidates.js";
import { expandFromAnchors } from "../engine/expand.js";
import { selectCandidatesWithBudget } from "../engine/budget.js";
import type { Candidate } from "../engine/types.js";
import type { Workspace } from "../workspaces/types.js";
import { renderMarkdownBundle } from "../output/markdown.js";
import { renderJsonBundle } from "../output/json.js";
import { redactContent } from "../redact.js";
import { createLogger } from "../utils/log.js";
import { readText } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";
import fg from "fast-glob";
import { resolve as resolvePath, join } from "node:path";
import { writeFile } from "node:fs/promises";
import type { PackCliArgs } from "../commands/pack.js";
import type { AdapterCacheData } from "../adapters/index.js";
import {
  collectFileStats,
  deserializeImportGraph,
  isCacheValid,
  loadWorkspaceCache,
  saveWorkspaceCache,
  serializeImportGraph,
} from "../cache/index.js";
import type { WorkspaceCache } from "../cache/types.js";
import { sha1 } from "../utils/hash.js";

export async function runPack(args: PackCliArgs): Promise<void> {
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
  const budgetChars = args.budgetChars ?? effectiveConfig.budgetChars;
  const budgetTokens = args.budgetTokens;
  const format = args.format ?? "json";
  const includeReasons = Boolean(args.reason);
  const redactEnabled = args.redact === true || effectiveConfig.redact.enabled;
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

  const candidateMap = new Map<string, Candidate>();
  for (const candidate of anchorResolution.candidates) {
    addCandidate(candidateMap, applySizePenalty(candidate));
  }

  const ignoreMatchers = await buildIgnoreMatchers({
    repoRoot,
    workspaces: bundleWorkspaces,
    args,
  });

  const expansionCandidates = await expandFromAnchors({
    adapters,
    workspaces: bundleWorkspaces,
    anchorFiles: anchorResolution.anchorFiles,
    depth: args.depth ?? effectiveConfig.depth,
    includeTests,
    ignoreMatchers,
  });
  for (const candidate of expansionCandidates) {
    addCandidate(candidateMap, applySizePenalty(candidate));
  }

  addHeaderSnippets(candidateMap, budgetChars);

  const ranked = rankCandidates(Array.from(candidateMap.values()));
  const selection = await selectCandidatesWithBudget({
    candidates: ranked,
    budgetChars,
    budgetTokens,
  });

  const outputItems = includeReasons
    ? selection.items
    : selection.items.map((item) => ({ ...item, reasons: [] }));
  const outputOmitted = includeReasons ? selection.omitted : [];

  if (redactEnabled) {
    for (const item of outputItems) {
      item.content = redactContent(item.content, effectiveConfig.redact.patterns);
    }
  }

  const meta = {
    repoRoot,
    generatedAt: args.noTimestamp ? undefined : new Date().toISOString(),
    command: `repo-slice ${process.argv.slice(2).join(" ")}`,
    scope: {
      mode: scopeMode,
      workspaces: bundleWorkspaces.map((ws) => ws.id),
    },
    budget: {
      chars: budgetChars,
      usedChars: selection.usedChars,
      tokens: budgetTokens,
      usedTokens: selection.usedTokens,
    },
    note: includeReasons ? scope.note : undefined,
  };

  const output =
    format === "json"
      ? renderJsonBundle({ meta, items: outputItems, omitted: outputOmitted })
      : renderMarkdownBundle({
          meta,
          items: outputItems,
          omitted: outputOmitted,
          includeReasons,
        });

  if (args.out) {
    const outPath = resolvePath(cwd, args.out);
    await writeFile(outPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

function applyCliOverrides(baseConfig: {
  budgetChars: number;
  depth: number;
  includeTests: "auto" | "true" | "false";
  redact: { enabled: boolean; patterns: string[] };
} & Record<string, unknown>, args: PackCliArgs) {
  return {
    ...baseConfig,
    budgetChars: args.budgetChars ?? baseConfig.budgetChars,
    depth: args.depth ?? baseConfig.depth,
    includeTests: args.includeTests ?? baseConfig.includeTests,
    redact: {
      ...baseConfig.redact,
      enabled: args.redact === true ? true : baseConfig.redact.enabled,
    },
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
  args: PackCliArgs;
  logger: { debug: (message: string) => void };
}) {
  const adapters: Awaited<ReturnType<typeof buildAdaptersForWorkspace>> = [];
  const version = await getPackageVersion(options.repoRoot);
  for (const workspace of options.workspaces) {
    const { config } = await loadConfig(options.repoRoot, workspace.root);
    const effectiveConfig = applyCliOverrides(config, options.args);
    options.logger.debug(`Indexing workspace ${workspace.root}`);
    const ignoreMatcher = await createIgnoreMatcher({
      repoRoot: options.repoRoot,
      workspaceRoot: workspace.root,
      extraIgnorePatterns: effectiveConfig.ignore,
    });
    const files = await detectWorkspaceFiles(workspace.root, ignoreMatcher);
    const allFiles = [...files.tsFiles, ...files.pyFiles].sort();
    const stats = await collectFileStats(allFiles);
    const configHash = hashWorkspaceConfig(effectiveConfig);
    const cache = await loadWorkspaceCache({
      repoRoot: options.repoRoot,
      workspaceRoot: workspace.root,
      configHash,
      version,
    });
    const cacheValid = cache ? isCacheValid(cache, stats) : false;
    const cacheData = cacheValid ? toAdapterCache(cache) : undefined;
    const workspaceAdapters = await buildAdaptersForWorkspace({
      workspace,
      ignoreMatcher,
      pythonImportRoots: effectiveConfig.workspaces.pythonImportRoots,
      files,
      cache: cacheData,
    });
    adapters.push(...workspaceAdapters);

    await saveWorkspaceCache({
      repoRoot: options.repoRoot,
      workspaceRoot: workspace.root,
      configHash,
      version,
      cache: buildWorkspaceCache({
        cache,
        workspace,
        version,
        configHash,
        stats,
        adapters: workspaceAdapters,
      }),
    });
  }
  return adapters.flat();
}

async function buildIgnoreMatchers(options: {
  repoRoot: string;
  workspaces: Workspace[];
  args: PackCliArgs;
}): Promise<Map<string, Awaited<ReturnType<typeof createIgnoreMatcher>>>> {
  const map = new Map<string, Awaited<ReturnType<typeof createIgnoreMatcher>>>();
  for (const workspace of options.workspaces) {
    const { config } = await loadConfig(options.repoRoot, workspace.root);
    const effectiveConfig = applyCliOverrides(config, options.args);
    const ignoreMatcher = await createIgnoreMatcher({
      repoRoot: options.repoRoot,
      workspaceRoot: workspace.root,
      extraIgnorePatterns: effectiveConfig.ignore,
    });
    map.set(workspace.id, ignoreMatcher);
  }
  return map;
}

function filterAdaptersByWorkspaces(
  adapters: Awaited<ReturnType<typeof buildAdaptersForWorkspace>>,
  workspaces: Workspace[]
) {
  const workspaceRoots = new Set(workspaces.map((ws) => ws.root));
  return adapters.filter((adapter) => workspaceRoots.has(adapter.workspace.root));
}

function addHeaderSnippets(candidateMap: Map<string, Candidate>, budgetChars: number): void {
  const headerLines = 80;
  for (const candidate of candidateMap.values()) {
    if (candidate.kind !== "file" || !candidate.anchor) continue;
    if (candidate.estimatedChars <= budgetChars / 2) continue;
    const snippetCandidate: Candidate = {
      id: "",
      kind: "snippet",
      lang: candidate.lang,
      workspaceId: candidate.workspaceId,
      workspaceRoot: candidate.workspaceRoot,
      filePath: candidate.filePath,
      range: { startLine: 1, endLine: headerLines },
      score: candidate.score - 200,
      reasons: [...candidate.reasons, "header snippet"],
      estimatedChars: estimateSnippetChars({ startLine: 1, endLine: headerLines }),
    };
    addCandidate(candidateMap, applySizePenalty(snippetCandidate));
  }
  for (const candidate of candidateMap.values()) {
    candidate.id = candidateId(candidate);
  }
}

async function detectWorkspaceFiles(
  workspaceRoot: string,
  ignoreMatcher: Awaited<ReturnType<typeof createIgnoreMatcher>>
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

function hashWorkspaceConfig(config: { ignore: string[]; workspaces: { pythonImportRoots: string[] } }): string {
  return sha1(
    JSON.stringify({
      ignore: config.ignore,
      pythonImportRoots: config.workspaces.pythonImportRoots,
    })
  );
}

async function getPackageVersion(repoRoot: string): Promise<string> {
  const raw = await readText(join(repoRoot, "package.json"));
  try {
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function toAdapterCache(cache: WorkspaceCache): AdapterCacheData {
  return {
    tsImportGraph: cache.ts ? deserializeImportGraph(cache.ts.importGraph) : undefined,
    pyModuleMap: cache.py ? new Map(Object.entries(cache.py.moduleMap)) : undefined,
    pyDefinitions: cache.py
      ? new Map(Object.entries(cache.py.definitions))
      : undefined,
    pyImportGraph: cache.py ? deserializeImportGraph(cache.py.importGraph) : undefined,
  };
}

function buildWorkspaceCache(options: {
  cache: WorkspaceCache | null;
  workspace: Workspace;
  version: string;
  configHash: string;
  stats: { path: string; mtimeMs: number; size: number }[];
  adapters: Awaited<ReturnType<typeof buildAdaptersForWorkspace>>;
}): WorkspaceCache {
  const tsAdapter = options.adapters.find((adapter) => adapter.lang === "ts");
  const pyAdapter = options.adapters.find((adapter) => adapter.lang === "py");
  const pyMeta = pyAdapter?.metadata?.py;

  return {
    version: options.version,
    workspaceRoot: options.workspace.root,
    configHash: options.configHash,
    files: options.stats,
    ts: tsAdapter
      ? {
          importGraph: serializeImportGraph(tsAdapter.importGraph),
        }
      : undefined,
    py: pyAdapter && pyMeta
      ? {
          moduleMap: Object.fromEntries(pyMeta.moduleMap.entries()),
          definitions: Object.fromEntries(pyMeta.definitions.entries()),
          importGraph: serializeImportGraph(pyAdapter.importGraph),
        }
      : undefined,
  };
}

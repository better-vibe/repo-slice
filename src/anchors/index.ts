import { readText } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";
import { resolve, isAbsolute } from "node:path";
import { languageFromPath } from "../utils/lang.js";
import type { AdapterIndex, SymbolLocation } from "../adapters/types.js";
import type { Candidate } from "../engine/types.js";
import { estimateFileChars, estimateSnippetChars } from "../engine/candidates.js";
import type { Workspace } from "../workspaces/types.js";
import { findWorkspaceForPath } from "../workspaces/scope.js";
import type { DiffHunk } from "./diff.js";
import { getDiffHunks } from "./diff.js";
import type { LogAnchor } from "./log.js";
import { parseLogAnchors } from "./log.js";

const SCORE_ENTRY = 800;
const SCORE_SYMBOL_DEFINITION = 1000;
const SCORE_SYMBOL_REFERENCE = 700;
const SCORE_DIAGNOSTIC = 950;
const SCORE_DIFF_HUNK = 850;

export interface AmbiguousSymbol {
  query: string;
  definitions: { filePath: string; range: { startLine: number; endLine: number } }[];
}

export interface AnchorResolution {
  candidates: Candidate[];
  anchorFiles: Set<string>;
  unresolvedSymbols: string[];
  ambiguousSymbols: AmbiguousSymbol[];
}

export async function resolveAnchors(options: {
  repoRoot: string;
  cwd: string;
  workspaces: Workspace[];
  adapters: AdapterIndex[];
  entries: string[];
  symbols: string[];
  fromDiff?: string;
  fromLog?: string;
  diffHunks?: DiffHunk[];
  logAnchors?: LogAnchor[];
}): Promise<AnchorResolution> {
  const candidates: Candidate[] = [];
  const anchorFiles = new Set<string>();
  const unresolvedSymbols: string[] = [];
  const ambiguousSymbols: AmbiguousSymbol[] = [];

  for (const entry of options.entries) {
    const filePath = normalizePath(
      isAbsolute(entry) ? entry : resolve(options.cwd, entry)
    );
    const workspace = findWorkspaceForPath(options.workspaces, filePath);
    if (!workspace) continue;
    const estimatedChars = await estimateFileChars(filePath);
    candidates.push({
      id: "",
      kind: "file",
      lang: languageFromPath(filePath),
      workspaceId: workspace.id,
      workspaceRoot: workspace.root,
      filePath,
      score: SCORE_ENTRY,
      reasons: ["entry file"],
      estimatedChars,
      anchor: true,
    });
    anchorFiles.add(filePath);
  }

  for (const symbol of options.symbols) {
    const definitions = await findSymbolDefinitions(options.adapters, symbol);
    if (definitions.length === 0) {
      unresolvedSymbols.push(symbol);
      continue;
    }
    if (definitions.length > 1) {
      ambiguousSymbols.push({
        query: symbol,
        definitions: definitions.map((def) => ({
          filePath: def.filePath,
          range: def.range,
        })),
      });
    }
    for (const def of definitions) {
      const workspace = findWorkspaceForPath(options.workspaces, def.filePath);
      if (!workspace) continue;
      candidates.push({
        id: "",
        kind: "snippet",
        lang: def.lang,
        workspaceId: workspace.id,
        workspaceRoot: workspace.root,
        filePath: def.filePath,
        range: def.range,
        score: def.kind === "context" ? SCORE_SYMBOL_REFERENCE : SCORE_SYMBOL_DEFINITION,
        reasons: [`defines-symbol ${symbol}`],
        estimatedChars: estimateSnippetChars(def.range),
        anchor: true,
      });
      anchorFiles.add(def.filePath);
      if (def.kind !== "definition") continue;
      const refs = await findSymbolReferences(options.adapters, def, anchorFiles);
      for (const ref of refs) {
        const refWorkspace = findWorkspaceForPath(options.workspaces, ref.filePath);
        if (!refWorkspace) continue;
        candidates.push({
          id: "",
          kind: "snippet",
          lang: ref.lang,
          workspaceId: refWorkspace.id,
          workspaceRoot: refWorkspace.root,
          filePath: ref.filePath,
          range: ref.range,
          score: SCORE_SYMBOL_REFERENCE,
          reasons: [`references ${symbol}`],
          estimatedChars: estimateSnippetChars(ref.range),
        });
        anchorFiles.add(ref.filePath);
      }
    }
  }

  if (options.fromDiff) {
    const hunks =
      options.diffHunks ?? (await getDiffHunks(options.repoRoot, options.fromDiff));
    const fileSet = new Set<string>();
    for (const hunk of hunks) {
      const workspace = findWorkspaceForPath(options.workspaces, hunk.filePath);
      if (!workspace) continue;
      candidates.push({
        id: "",
        kind: "snippet",
        lang: languageFromPath(hunk.filePath),
        workspaceId: workspace.id,
        workspaceRoot: workspace.root,
        filePath: hunk.filePath,
        range: hunk.range,
        score: SCORE_DIFF_HUNK,
        reasons: ["diff hunk"],
        estimatedChars: estimateSnippetChars(hunk.range),
        anchor: true,
      });
      anchorFiles.add(hunk.filePath);
      fileSet.add(hunk.filePath);
    }
    for (const filePath of fileSet) {
      const workspace = findWorkspaceForPath(options.workspaces, filePath);
      if (!workspace) continue;
      const estimatedChars = await estimateFileChars(filePath);
      candidates.push({
        id: "",
        kind: "file",
        lang: languageFromPath(filePath),
        workspaceId: workspace.id,
        workspaceRoot: workspace.root,
        filePath,
        score: SCORE_ENTRY,
        reasons: ["diff file"],
        estimatedChars,
      });
    }
  }

  if (options.fromLog) {
    const anchors =
      options.logAnchors ??
      parseLogAnchors(await readText(options.fromLog), options.repoRoot);
    for (const anchor of anchors) {
      const workspace = findWorkspaceForPath(options.workspaces, anchor.filePath);
      if (!workspace) continue;
      candidates.push({
        id: "",
        kind: "snippet",
        lang: languageFromPath(anchor.filePath),
        workspaceId: workspace.id,
        workspaceRoot: workspace.root,
        filePath: anchor.filePath,
        range: anchor.range,
        score: SCORE_DIAGNOSTIC,
        reasons: ["diagnostic"],
        estimatedChars: estimateSnippetChars(anchor.range),
        anchor: true,
      });
      anchorFiles.add(anchor.filePath);
    }
  }

  return { candidates, anchorFiles, unresolvedSymbols, ambiguousSymbols };
}

async function findSymbolDefinitions(
  adapters: AdapterIndex[],
  query: string
): Promise<SymbolLocation[]> {
  const results: SymbolLocation[] = [];
  for (const adapter of adapters) {
    const defs = await adapter.findSymbolDefinitions(query);
    results.push(...defs);
  }
  return results;
}

async function findSymbolReferences(
  adapters: AdapterIndex[],
  definition: SymbolLocation,
  anchorFiles: Set<string>
): Promise<SymbolLocation[]> {
  const adapter = adapters.find(
    (entry) =>
      entry.lang === definition.lang &&
      definition.filePath.startsWith(entry.workspace.root)
  );
  if (!adapter) return [];
  const refs = await adapter.findSymbolReferences(definition, {
    limit: 10,
    anchorFiles: Array.from(anchorFiles),
  });
  return refs;
}

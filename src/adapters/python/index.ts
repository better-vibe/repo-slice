import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import fg from "fast-glob";
import { join, relative } from "node:path";
import { readText } from "../../utils/fs.js";
import { extractSnippet } from "../../utils/snippet.js";
import { isPathInside, normalizePath, toPosixPath } from "../../utils/path.js";
import type {
  AdapterIndex,
  CallExpression,
  ImportGraph,
  PythonDefinition,
  Range,
  SymbolLocation,
} from "../types.js";
import { findPythonCallExpressions } from "./calls.js";
import type { Workspace } from "../../workspaces/types.js";
import type { IgnoreMatcher } from "../../ignore.js";

export interface PythonIndex {
  workspace: Workspace;
  files: string[];
  moduleMap: Map<string, string>;
  fileModules: Map<string, string>;
  definitions: Map<string, PythonDefinition[]>;
  fileContents: Map<string, string>;
  importGraph: ImportGraph;
}


const parser = new Parser();
parser.setLanguage(Python);

export async function buildPythonAdapter(options: {
  workspace: Workspace;
  ignoreMatcher: IgnoreMatcher;
  pythonImportRoots: string[];
  files?: string[];
  cachedModuleMap?: Map<string, string>;
  cachedDefinitions?: Map<string, PythonDefinition[]>;
  cachedImportGraph?: ImportGraph;
}): Promise<AdapterIndex | null> {
  const { workspace, ignoreMatcher, pythonImportRoots } = options;
  const files = options.files ?? (await detectPythonFiles(workspace.root, ignoreMatcher));
  if (files.length === 0) return null;

  const index = await buildPythonIndex(
    workspace,
    files,
    pythonImportRoots,
    options.cachedModuleMap,
    options.cachedDefinitions,
    options.cachedImportGraph
  );

  return {
    lang: "py",
    workspace,
    files: index.files,
    importGraph: index.importGraph,
    findSymbolDefinitions: (query) => Promise.resolve(findPythonDefinitions(index, query)),
    findSymbolReferences: (definition, refOptions) =>
      findPythonReferences(index, definition, refOptions),
    extractSnippet: (filePath, range) => extractSnippet(filePath, range),
    findCallExpressions: (callOptions) =>
      findPythonCallExpressions(
        {
          workspaceRoot: workspace.root,
          fileContents: index.fileContents,
          definitions: index.definitions,
          moduleMap: index.moduleMap,
        },
        callOptions
      ),
    metadata: {
      py: {
        moduleMap: index.moduleMap,
        definitions: index.definitions,
      },
    },
  };
}

async function detectPythonFiles(
  workspaceRoot: string,
  ignoreMatcher: IgnoreMatcher
): Promise<string[]> {
  const files = await fg(["**/*.py"], {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  return files
    .map((file) => normalizePath(file))
    .filter((file) => !ignoreMatcher.ignores(file))
    .sort();
}

async function buildPythonIndex(
  workspace: Workspace,
  files: string[],
  pythonImportRoots: string[],
  cachedModuleMap?: Map<string, string>,
  cachedDefinitions?: Map<string, PythonDefinition[]>,
  cachedImportGraph?: ImportGraph
): Promise<PythonIndex> {
  const moduleMap = cachedModuleMap ?? new Map<string, string>();
  const fileModules = new Map<string, string>();
  const definitions = cachedDefinitions ?? new Map<string, PythonDefinition[]>();
  const fileContents = new Map<string, string>();

  for (const file of files) {
    let moduleName = fileModules.get(file);
    if (!moduleName) {
      moduleName = resolveModuleName(workspace.root, file, pythonImportRoots);
      if (moduleName) {
        if (!moduleMap.has(moduleName)) {
          moduleMap.set(moduleName, file);
        }
        fileModules.set(file, moduleName);
      }
    }
    const text = await readText(file);
    fileContents.set(file, text);
    if (!definitions.has(file)) {
      const tree = parser.parse(text);
      const defs = collectDefinitions(tree.rootNode);
      definitions.set(file, defs);
    }
  }

  const importGraph =
    cachedImportGraph ??
    buildPythonImportGraph(workspace, files, fileContents, fileModules, moduleMap);

  return {
    workspace,
    files,
    moduleMap,
    fileModules,
    definitions,
    fileContents,
    importGraph,
  };
}

function resolveModuleName(
  workspaceRoot: string,
  filePath: string,
  importRoots: string[]
): string | undefined {
  const normalized = normalizePath(filePath);
  for (const root of importRoots) {
    const base = normalizePath(join(workspaceRoot, root));
    if (!isPathInside(normalized, base)) continue;
    let rel = relative(base, normalized);
    rel = rel.replace(/\.py$/, "");
    const parts = toPosixPath(rel).split("/");
    if (parts[parts.length - 1] === "__init__") {
      parts.pop();
    }
    const moduleName = parts.filter(Boolean).join(".");
    if (moduleName) return moduleName;
  }
  return undefined;
}

function collectDefinitions(root: Parser.SyntaxNode): PythonDefinition[] {
  const definitions: PythonDefinition[] = [];

  const visit = (node: Parser.SyntaxNode, currentClass?: PythonDefinition): void => {
    if (node.type === "decorated_definition") {
      const defNode = node.namedChildren.find((child) =>
        ["function_definition", "class_definition"].includes(child.type)
      );
      if (defNode) {
        const def = createDefinition(defNode, node, currentClass);
        if (def) definitions.push(def);
        if (defNode.type === "class_definition" && def) {
          const classContext: PythonDefinition = {
            name: def.name,
            kind: "class",
            range: def.range,
            className: def.name,
            classRange: def.range,
          };
          const body = defNode.childForFieldName("body");
          if (body) {
            for (const child of body.namedChildren) {
              visit(child, classContext);
            }
          }
        }
      }
      return;
    }

    if (node.type === "class_definition") {
      const def = createDefinition(node, node, currentClass);
      if (def) {
        definitions.push(def);
        const classContext: PythonDefinition = {
          name: def.name,
          kind: "class",
          range: def.range,
          className: def.name,
          classRange: def.range,
        };
        const body = node.childForFieldName("body");
        if (body) {
          for (const child of body.namedChildren) {
            visit(child, classContext);
          }
        }
      }
      return;
    }

    if (node.type === "function_definition") {
      if (node.parent?.type === "decorated_definition") return;
      const def = createDefinition(node, node, currentClass);
      if (def) definitions.push(def);
      return;
    }

    for (const child of node.namedChildren) {
      visit(child, currentClass);
    }
  };

  visit(root);
  return definitions;
}

function createDefinition(
  node: Parser.SyntaxNode,
  rangeNode: Parser.SyntaxNode,
  currentClass?: PythonDefinition
): PythonDefinition | null {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return null;
  const range = toRange(rangeNode);
  if (currentClass && node.type === "function_definition") {
    return {
      name: nameNode.text,
      kind: "method",
      range,
      className: currentClass.name,
      classRange: currentClass.range,
    };
  }
  if (node.type === "class_definition") {
    return {
      name: nameNode.text,
      kind: "class",
      range,
    };
  }
  return {
    name: nameNode.text,
    kind: "function",
    range,
  };
}

function toRange(node: Parser.SyntaxNode): Range {
  return {
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  };
}

function buildPythonImportGraph(
  workspace: Workspace,
  files: string[],
  fileContents: Map<string, string>,
  fileModules: Map<string, string>,
  moduleMap: Map<string, string>
): ImportGraph {
  const graph: ImportGraph = new Map();
  for (const file of files) {
    graph.set(file, new Set());
    const text = fileContents.get(file) ?? "";
    const tree = parser.parse(text);
    const importNodes = tree.rootNode.descendantsOfType([
      "import_statement",
      "import_from_statement",
    ]);
    const currentModule = fileModules.get(file);
    for (const node of importNodes) {
      const modules = extractImportedModules(node, currentModule);
      for (const mod of modules) {
        const resolved = resolveModuleToFile(mod, moduleMap);
        if (!resolved) continue;
        if (!isPathInside(resolved, workspace.root)) continue;
        graph.get(file)?.add(resolved);
      }
    }
  }
  return graph;
}

function extractImportedModules(
  node: Parser.SyntaxNode,
  currentModule?: string
): string[] {
  if (node.type === "import_statement") {
    return node.namedChildren
      .filter((child) => child.type === "dotted_name")
      .map((child) => child.text);
  }
  if (node.type === "import_from_statement") {
    let moduleName = "";
    let relativeLevel = 0;
    for (const child of node.namedChildren) {
      if (child.type === "dotted_name") {
        moduleName = child.text;
      }
      if (child.type === "relative_import") {
        relativeLevel = child.text.length;
      }
    }
    const baseModule = resolveRelativeModule(currentModule, relativeLevel);
    const fullModule = baseModule
      ? moduleName
        ? `${baseModule}.${moduleName}`
        : baseModule
      : moduleName;

    const importedNames = node.namedChildren
      .filter((child) => child.type === "import_list")
      .flatMap((child) =>
        child.namedChildren
          .filter((item) => item.type === "dotted_name" || item.type === "identifier")
          .map((item) => item.text)
      );

    const modules = [fullModule].filter(Boolean);
    for (const name of importedNames) {
      if (fullModule) {
        modules.push(`${fullModule}.${name}`);
      }
    }
    return modules;
  }
  return [];
}

function resolveRelativeModule(
  currentModule: string | undefined,
  level: number
): string | undefined {
  if (!currentModule || level <= 0) return currentModule;
  const parts = currentModule.split(".");
  if (parts.length < level) return undefined;
  return parts.slice(0, parts.length - level).join(".");
}

function resolveModuleToFile(
  moduleName: string,
  moduleMap: Map<string, string>
): string | undefined {
  if (moduleMap.has(moduleName)) return moduleMap.get(moduleName);
  const parts = moduleName.split(".");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join(".");
    if (moduleMap.has(candidate)) return moduleMap.get(candidate);
  }
  return undefined;
}

function parsePythonSymbolQuery(
  moduleMap: Map<string, string>,
  query: string
): {
  moduleHint?: string;
  symbolQuery: string;
  className?: string;
  memberName?: string;
} {
  let moduleHint: string | undefined;
  let symbolQuery = query;
  if (query.includes(":")) {
    const [modulePart, symbolPart] = query.split(":", 2);
    moduleHint = modulePart;
    symbolQuery = symbolPart;
  } else {
    const parts = query.split(".");
    for (let i = parts.length - 1; i >= 1; i -= 1) {
      const candidate = parts.slice(0, i).join(".");
      if (moduleMap.has(candidate)) {
        moduleHint = candidate;
        symbolQuery = parts.slice(i).join(".");
        break;
      }
    }
  }
  const symbolParts = symbolQuery.split(".");
  let className: string | undefined;
  let memberName: string | undefined;
  if (symbolParts.length >= 2) {
    className = symbolParts[0];
    memberName = symbolParts.slice(1).join(".");
  }
  return { moduleHint, symbolQuery, className, memberName };
}

function findPythonDefinitions(index: PythonIndex, query: string): SymbolLocation[] {
  const { moduleHint, symbolQuery, className, memberName } =
    parsePythonSymbolQuery(index.moduleMap, query);
  const results: SymbolLocation[] = [];
  const targetFiles = moduleHint
    ? [index.moduleMap.get(moduleHint)].filter(Boolean) as string[]
    : index.files;

  for (const file of targetFiles) {
    const defs = index.definitions.get(file) ?? [];
    for (const def of defs) {
      if (className && memberName) {
        if (def.kind === "method" && def.className === className && def.name === memberName) {
          results.push({
            filePath: file,
            range: def.range,
            kind: "definition",
            lang: "py",
            symbolName: `${className}.${memberName}`,
          });
          if (def.classRange) {
            results.push({
              filePath: file,
              range: shrinkRange(def.classRange, 3),
              kind: "context",
              lang: "py",
              symbolName: def.className,
            });
          }
        }
        continue;
      }
      if (def.name === symbolQuery) {
        results.push({
          filePath: file,
          range: def.range,
          kind: "definition",
          lang: "py",
          symbolName: def.name,
        });
      }
    }
  }

  return results;
}

function shrinkRange(range: Range, maxLines: number): Range {
  return {
    startLine: range.startLine,
    endLine: Math.min(range.endLine, range.startLine + maxLines - 1),
  };
}

async function findPythonReferences(
  index: PythonIndex,
  definition: SymbolLocation,
  options?: { limit?: number; anchorFiles?: string[] }
): Promise<SymbolLocation[]> {
  const name =
    definition.symbolName?.split(".").slice(-1)[0] ??
    definition.symbolName ??
    "";
  if (!name) return [];
  const refs: SymbolLocation[] = [];

  for (const file of index.files) {
    const text = index.fileContents.get(file) ?? "";
    const tree = parser.parse(text);
    const lines = text.split(/\r?\n/);
    const matchedLines = new Set<number>();
    const nodes = tree.rootNode.descendantsOfType(["identifier", "attribute"]);
    for (const node of nodes) {
      if (node.type === "identifier" && node.text === name) {
        matchedLines.add(node.startPosition.row + 1);
      } else if (node.type === "attribute") {
        const attr =
          node.childForFieldName("attribute") ??
          node.namedChildren[node.namedChildren.length - 1];
        if (attr?.text === name) {
          matchedLines.add(attr.startPosition.row + 1);
        }
      }
    }
    if (matchedLines.size === 0) continue;
    for (const line of matchedLines) {
      refs.push({
        filePath: file,
        range: {
          startLine: Math.max(1, line - 2),
          endLine: Math.min(lines.length, line + 2),
        },
        kind: "reference",
        lang: "py",
      });
    }
  }

  const ranked = rankReferences(refs, options?.anchorFiles ?? [], definition.filePath);
  const limit = options?.limit ?? 10;
  return ranked.slice(0, limit);
}

function rankReferences(
  refs: SymbolLocation[],
  anchorFiles: string[],
  definitionFile: string
): SymbolLocation[] {
  const anchorSet = new Set(anchorFiles.map((file) => normalizePath(file)));
  const definitionPath = normalizePath(definitionFile);
  return refs
    .map((ref) => {
      const file = normalizePath(ref.filePath);
      let score = 0;
      if (file === definitionPath) score += 60;
      if (anchorSet.has(file)) score += 30;
      return { ref, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.ref.filePath !== b.ref.filePath) {
        return a.ref.filePath.localeCompare(b.ref.filePath);
      }
      return a.ref.range.startLine - b.ref.range.startLine;
    })
    .map((entry) => entry.ref);
}

import ts from "typescript";
import { dirname, join } from "node:path";
import fg from "fast-glob";
import { fileExists } from "../../utils/fs.js";
import { extractSnippet } from "../../utils/snippet.js";
import { isPathInside, normalizePath } from "../../utils/path.js";
import type { AdapterIndex, CallExpression, ImportEdgeType, ImportGraph, Range, SymbolLocation } from "../types.js";
import { findTsCallExpressions } from "./calls.js";
import type { Workspace } from "../../workspaces/types.js";
import type { IgnoreMatcher } from "../../ignore.js";

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".d.ts"];

export async function buildTsAdapter(options: {
  workspace: Workspace;
  ignoreMatcher: IgnoreMatcher;
  files?: string[];
  cachedImportGraph?: ImportGraph;
}): Promise<AdapterIndex | null> {
  const { workspace, ignoreMatcher } = options;
  const tsFiles =
    options.files ?? (await detectTsFiles(workspace.root, ignoreMatcher));
  if (tsFiles.length === 0) return null;

  const { program, languageService, compilerOptions } = await createProgram(
    workspace.root,
    tsFiles
  );
  const importGraph =
    options.cachedImportGraph ??
    buildImportGraph(program, compilerOptions, workspace.root);

  return {
    lang: "ts",
    workspace,
    files: tsFiles,
    importGraph,
    findSymbolDefinitions: (query) =>
      Promise.resolve(findTsDefinitions(program, compilerOptions, workspace.root, query)),
    findSymbolReferences: (definition, refOptions) =>
      findTsReferences(languageService, definition, refOptions),
    extractSnippet: (filePath, range) => extractSnippet(filePath, range),
    findCallExpressions: async (callOptions) =>
      Promise.resolve(findTsCallExpressions(program, workspace.root, callOptions)),
  };
}

async function detectTsFiles(
  workspaceRoot: string,
  ignoreMatcher: IgnoreMatcher
): Promise<string[]> {
  const files = await fg(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"], {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  const normalized = files
    .map((file) => normalizePath(file))
    .filter((file) => !ignoreMatcher.ignores(file));
  return normalized.sort();
}

async function createProgram(
  workspaceRoot: string,
  files: string[]
): Promise<{
  program: ts.Program;
  languageService: ts.LanguageService;
  compilerOptions: ts.CompilerOptions;
}> {
  const tsconfigPath = (await fileExists(join(workspaceRoot, "tsconfig.json")))
    ? join(workspaceRoot, "tsconfig.json")
    : (await fileExists(join(workspaceRoot, "tsconfig.base.json")))
      ? join(workspaceRoot, "tsconfig.base.json")
      : undefined;

  let compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };
  let fileNames = files;

  if (tsconfigPath) {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(ts.formatDiagnosticsWithColorAndContext([configFile.error], {
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => "\n",
      }));
    }
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      workspaceRoot
    );
    compilerOptions = {
      ...parsed.options,
      allowJs: true,
    };
    fileNames = parsed.fileNames
      .map((file) => normalizePath(file))
      .filter((file) => isPathInside(file, workspaceRoot));
  }

  const host = ts.createCompilerHost(compilerOptions, true);
  const program = ts.createProgram(fileNames, compilerOptions, host);

  const languageServiceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => fileNames,
    getScriptVersion: () => "0",
    getScriptSnapshot: (fileName) => {
      const contents = ts.sys.readFile(fileName);
      if (contents === undefined) return undefined;
      return ts.ScriptSnapshot.fromString(contents);
    },
    getCurrentDirectory: () => workspaceRoot,
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const languageService = ts.createLanguageService(languageServiceHost);

  return { program, languageService, compilerOptions };
}

function buildImportGraph(
  program: ts.Program,
  compilerOptions: ts.CompilerOptions,
  workspaceRoot: string
): ImportGraph {
  const graph: ImportGraph = new Map();
  const host = ts.createCompilerHost(compilerOptions, true);
  const fileSet = new Set(program.getSourceFiles().map((file) => file.fileName));

  /**
   * Add an import edge, preferring "imports" (static) over "imports-dynamic" if both exist.
   */
  const addEdge = (from: string, to: string, edgeType: ImportEdgeType): void => {
    let targets = graph.get(from);
    if (!targets) {
      targets = new Map();
      graph.set(from, targets);
    }
    const existing = targets.get(to);
    // Prefer "imports" (static) over "imports-dynamic"
    if (!existing || (existing === "imports-dynamic" && edgeType === "imports")) {
      targets.set(to, edgeType);
    }
  };

  /**
   * Resolve a module specifier to an absolute file path.
   */
  const resolveModule = (moduleName: string, containingFile: string): string | undefined => {
    const resolved =
      ts.resolveModuleName(moduleName, containingFile, compilerOptions, host)
        .resolvedModule?.resolvedFileName ?? resolveModuleFallback(containingFile, moduleName);
    if (!resolved) return undefined;
    const resolvedPath = normalizePath(resolved);
    if (!isPathInside(resolvedPath, workspaceRoot)) return undefined;
    if (!fileSet.has(resolvedPath) && !fileExistsSync(resolvedPath)) return undefined;
    return resolvedPath;
  };

  /**
   * Extract a string literal from a node (supports string literals and no-substitution template literals).
   */
  const extractStringLiteral = (node: ts.Node): string | undefined => {
    if (ts.isStringLiteral(node)) {
      return node.text;
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }
    return undefined;
  };

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!isPathInside(filePath, workspaceRoot)) continue;
    if (!graph.has(filePath)) graph.set(filePath, new Map());

    const visit = (node: ts.Node): void => {
      // Static import/export declarations
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (moduleSpecifier) {
          const moduleName = extractStringLiteral(moduleSpecifier);
          if (moduleName) {
            const resolved = resolveModule(moduleName, filePath);
            if (resolved) {
              addEdge(filePath, resolved, "imports");
            }
          }
        }
      }

      // import = require("...") - ImportEqualsDeclaration
      if (ts.isImportEqualsDeclaration(node)) {
        const moduleRef = node.moduleReference;
        if (ts.isExternalModuleReference(moduleRef) && moduleRef.expression) {
          const moduleName = extractStringLiteral(moduleRef.expression);
          if (moduleName) {
            const resolved = resolveModule(moduleName, filePath);
            if (resolved) {
              addEdge(filePath, resolved, "imports-dynamic");
            }
          }
        }
      }

      // Dynamic import() calls and require() calls
      if (ts.isCallExpression(node)) {
        const expr = node.expression;

        // Dynamic import(): import("...")
        if (expr.kind === ts.SyntaxKind.ImportKeyword) {
          const arg = node.arguments[0];
          if (arg) {
            const moduleName = extractStringLiteral(arg);
            if (moduleName) {
              const resolved = resolveModule(moduleName, filePath);
              if (resolved) {
                addEdge(filePath, resolved, "imports-dynamic");
              }
            }
          }
        }

        // require("...")
        if (ts.isIdentifier(expr) && expr.text === "require") {
          const arg = node.arguments[0];
          if (arg) {
            const moduleName = extractStringLiteral(arg);
            if (moduleName) {
              const resolved = resolveModule(moduleName, filePath);
              if (resolved) {
                addEdge(filePath, resolved, "imports-dynamic");
              }
            }
          }
        }
      }

      // import("...") type references in type nodes
      if (ts.isImportTypeNode(node)) {
        const arg = node.argument;
        if (ts.isLiteralTypeNode(arg) && arg.literal) {
          const moduleName = extractStringLiteral(arg.literal);
          if (moduleName) {
            const resolved = resolveModule(moduleName, filePath);
            if (resolved) {
              // Type-only import references are treated as static imports
              addEdge(filePath, resolved, "imports");
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return graph;
}

function resolveModuleFallback(containingFile: string, moduleName: string): string | undefined {
  if (!moduleName.startsWith(".")) return undefined;
  const base = normalizePath(join(dirname(containingFile), moduleName));
  for (const ext of TS_EXTENSIONS) {
    const candidate = base.endsWith(ext) ? base : `${base}${ext}`;
    if (fileExistsSync(candidate)) return candidate;
  }
  for (const ext of TS_EXTENSIONS) {
    const candidate = join(base, `index${ext}`);
    if (fileExistsSync(candidate)) return candidate;
  }
  return undefined;
}

function fileExistsSync(path: string): boolean {
  return ts.sys.fileExists(path);
}

function findTsDefinitions(
  program: ts.Program,
  compilerOptions: ts.CompilerOptions,
  workspaceRoot: string,
  query: string
): SymbolLocation[] {
  const { fileHint, symbolQuery, className, memberName, isDefault } =
    parseTsSymbolQuery(query);
  const results: SymbolLocation[] = [];
  const targetFiles = selectTargetFiles(program, workspaceRoot, fileHint);

  for (const sourceFile of targetFiles) {
    if (className && memberName) {
      const matches = findClassMemberDefinitions(sourceFile, className, memberName);
      results.push(...matches);
      continue;
    }
    if (isDefault) {
      results.push(...findDefaultExports(sourceFile));
    }
    results.push(...findTopLevelDefinitions(sourceFile, symbolQuery));
  }

  return results;
}

function selectTargetFiles(
  program: ts.Program,
  workspaceRoot: string,
  fileHint?: string
): ts.SourceFile[] {
  const sources = program
    .getSourceFiles()
    .filter((file) => isPathInside(file.fileName, workspaceRoot));
  if (!fileHint) return sources;
  const normalized = normalizePath(join(workspaceRoot, fileHint));
  return sources.filter((file) => normalizePath(file.fileName) === normalized);
}

function parseTsSymbolQuery(query: string): {
  fileHint?: string;
  symbolQuery: string;
  className?: string;
  memberName?: string;
  isDefault: boolean;
} {
  let fileHint: string | undefined;
  let symbolQuery = query;
  if (query.includes(":")) {
    const [left, right] = query.split(":", 2);
    if (looksLikePath(left)) {
      fileHint = left;
      symbolQuery = right;
    }
  }
  const parts = symbolQuery.split(".");
  const isDefault = symbolQuery === "default";
  let className: string | undefined;
  let memberName: string | undefined;
  if (parts.length >= 2) {
    className = parts.slice(0, -1).join(".");
    memberName = parts[parts.length - 1];
  }
  return { fileHint, symbolQuery, className, memberName, isDefault };
}

function looksLikePath(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    value.endsWith(".ts") ||
    value.endsWith(".tsx") ||
    value.endsWith(".js") ||
    value.endsWith(".jsx")
  );
}

function findClassMemberDefinitions(
  sourceFile: ts.SourceFile,
  className: string,
  memberName: string
): SymbolLocation[] {
  const results: SymbolLocation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      for (const member of node.members) {
        if (
          (ts.isMethodDeclaration(member) ||
            ts.isPropertyDeclaration(member) ||
            ts.isGetAccessor(member) ||
            ts.isSetAccessor(member)) &&
          member.name &&
          ts.isIdentifier(member.name) &&
          member.name.text === memberName
        ) {
          const range = createRange(
            sourceFile,
            node.getStart(),
            member.getEnd()
          );
          results.push({
            filePath: sourceFile.fileName,
            range,
            kind: "definition",
            lang: "ts",
            symbolPosition: member.name.getStart(),
            symbolName: `${className}.${memberName}`,
          });
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return results;
}

function findDefaultExports(sourceFile: ts.SourceFile): SymbolLocation[] {
  const results: SymbolLocation[] = [];
  sourceFile.forEachChild((node) => {
    if (ts.isExportAssignment(node)) {
      results.push({
        filePath: sourceFile.fileName,
        range: createRange(sourceFile, node.getStart(), node.getEnd()),
        kind: "definition",
        lang: "ts",
        symbolPosition: node.getStart(),
        symbolName: "default",
      });
    }
    if (
      (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      results.push({
        filePath: sourceFile.fileName,
        range: createRange(sourceFile, node.getStart(), node.getEnd()),
        kind: "definition",
        lang: "ts",
        symbolPosition: node.name?.getStart(),
        symbolName: node.name?.text ?? "default",
      });
    }
  });
  return results;
}

function findTopLevelDefinitions(
  sourceFile: ts.SourceFile,
  name: string
): SymbolLocation[] {
  const results: SymbolLocation[] = [];
  sourceFile.forEachChild((node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name?.text === name
    ) {
      results.push({
        filePath: sourceFile.fileName,
        range: createRange(sourceFile, node.getStart(), node.getEnd()),
        kind: "definition",
        lang: "ts",
        symbolPosition: node.name?.getStart(),
        symbolName: name,
      });
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) {
          results.push({
            filePath: sourceFile.fileName,
            range: createRange(sourceFile, node.getStart(), node.getEnd()),
            kind: "definition",
            lang: "ts",
            symbolPosition: decl.name.getStart(),
            symbolName: name,
          });
        }
      }
    }
  });
  return results;
}

function createRange(
  sourceFile: ts.SourceFile,
  startPos: number,
  endPos: number
): Range {
  const start = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(endPos).line + 1;
  return { startLine: start, endLine: end };
}

async function findTsReferences(
  languageService: ts.LanguageService,
  definition: SymbolLocation,
  options?: { limit?: number; anchorFiles?: string[] }
): Promise<SymbolLocation[]> {
  const sourceFile = definition.filePath;
  const position = definition.symbolPosition ?? 0;
  const referencedSymbols = languageService.findReferences(sourceFile, position) ?? [];
  const refs: SymbolLocation[] = [];
  for (const entry of referencedSymbols) {
    for (const ref of entry.references) {
      if (ref.isDefinition) continue;
      const range = createSpanRange(ref.fileName, ref.textSpan);
      refs.push({
        filePath: ref.fileName,
        range,
        kind: "reference",
        lang: "ts",
      });
    }
  }

  const ranked = rankReferences(refs, options?.anchorFiles ?? []);
  const limit = options?.limit ?? 10;
  return ranked.slice(0, limit);
}

function createSpanRange(filePath: string, span: ts.TextSpan): Range {
  const source = ts.sys.readFile(filePath) ?? "";
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2020, true);
  const start = sourceFile.getLineAndCharacterOfPosition(span.start).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(span.start + span.length).line + 1;
  const padding = 2;
  return {
    startLine: Math.max(1, start - padding),
    endLine: Math.max(start, end + padding),
  };
}

function rankReferences(
  refs: SymbolLocation[],
  anchorFiles: string[]
): SymbolLocation[] {
  const anchorSet = new Set(anchorFiles.map((file) => normalizePath(file)));
  const anchorDirs = new Set(anchorFiles.map((file) => dirname(normalizePath(file))));
  return refs
    .map((ref) => {
      const file = normalizePath(ref.filePath);
      let score = 0;
      if (anchorSet.has(file)) score += 50;
      if (anchorDirs.has(dirname(file))) score += 20;
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

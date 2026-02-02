import ts from "typescript";
import { join } from "node:path";
import fg from "fast-glob";
import { fileExists } from "../../utils/fs.js";
import { extractSnippet } from "../../utils/snippet.js";
import { isPathInside, normalizePath } from "../../utils/path.js";
import type { AdapterIndex, CallExpression, ImportEdgeType, ImportGraph, Range, SymbolLocation } from "../types.js";
import { findTsCallExpressions } from "./calls.js";
import type { Workspace } from "../../workspaces/types.js";
import type { IgnoreMatcher } from "../../ignore.js";
import { createIncrementalProgram } from "./incremental.js";

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".d.ts"];

export interface BuildTsAdapterOptions {
  workspace: Workspace;
  ignoreMatcher: IgnoreMatcher;
  files?: string[];
  cachedImportGraph?: ImportGraph;
  cachedCallExpressions?: CallExpression[];
  enableIncremental?: boolean;  // NEW: Enable incremental parsing
  cacheDir?: string;  // NEW: Cache directory for incremental state
}

export async function buildTsAdapter(options: BuildTsAdapterOptions): Promise<AdapterIndex | null> {
  const { workspace, ignoreMatcher } = options;
  const tsFiles =
    options.files ?? (await detectTsFiles(workspace.root, ignoreMatcher));
  if (tsFiles.length === 0) return null;

  // OPTIMIZATION: Use incremental program creation if enabled
  let program: ts.Program;
  let languageService: ts.LanguageService;
  let compilerOptions: ts.CompilerOptions;
  let isIncremental = false;
  let incrementalStats = { totalFiles: 0, changedFiles: 0, reusedFiles: 0 };

  if (options.enableIncremental && options.cacheDir) {
    // Use incremental parsing with file change detection
    const result = await createIncrementalProgram(
      workspace.root,
      tsFiles,
      options.cacheDir
    );
    program = result.program;
    languageService = result.languageService;
    compilerOptions = result.compilerOptions;
    isIncremental = result.isIncremental;
    incrementalStats = result.stats;
  } else {
    // Fall back to full parsing
    const result = await createProgram(workspace.root, tsFiles);
    program = result.program;
    languageService = result.languageService;
    compilerOptions = result.compilerOptions;
  }

  const importGraph =
    options.cachedImportGraph ??
    buildImportGraph(program, compilerOptions, workspace.root);

  // OPTIMIZATION: Cache call expressions to avoid re-parsing
  let callExpressions: CallExpression[] | undefined = options.cachedCallExpressions;

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
    findCallExpressions: async (callOptions) => {
      // Use cached call expressions if available and no filter applied
      if (callExpressions && !callOptions) {
        return callExpressions;
      }
      // Compute on first use or when filtering
      if (!callExpressions) {
        callExpressions = findTsCallExpressions(program, workspace.root, callOptions);
      }
      return callExpressions;
    },
    metadata: {
      ts: {
        callExpressions,  // Store for caching
        isIncremental,    // Track if incremental parsing was used
        incrementalStats, // Stats for debugging
      },
    },
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

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!isPathInside(filePath, workspaceRoot)) continue;
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) continue;

    if (!graph.has(filePath)) {
      graph.set(filePath, new Map());
    }
    const targets = graph.get(filePath)!;

    // Collect all module specifiers from both static and dynamic imports
    const { staticImports, dynamicImports } = collectModuleSpecifiers(sourceFile);

    // Process static imports
    for (const moduleSpecifier of staticImports) {
      // Skip non-relative imports (node_modules)
      if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) {
        continue;
      }

      const resolved = ts.resolveModuleName(
        moduleSpecifier,
        filePath,
        compilerOptions,
        host
      );

      if (resolved.resolvedModule) {
        const resolvedPath = normalizePath(resolved.resolvedModule.resolvedFileName);
        if (isPathInside(resolvedPath, workspaceRoot)) {
          targets.set(resolvedPath, "imports");
        }
      }
    }

    // Process dynamic imports
    for (const moduleSpecifier of dynamicImports) {
      // Skip non-relative imports (node_modules)
      if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) {
        continue;
      }

      const resolved = ts.resolveModuleName(
        moduleSpecifier,
        filePath,
        compilerOptions,
        host
      );

      if (resolved.resolvedModule) {
        const resolvedPath = normalizePath(resolved.resolvedModule.resolvedFileName);
        if (isPathInside(resolvedPath, workspaceRoot)) {
          targets.set(resolvedPath, "imports-dynamic");
        }
      }
    }
  }

  return graph;
}

/**
 * Collect all module specifiers from a source file.
 * Handles:
 * - Static imports: import x from "./module"
 * - Static exports: export { x } from "./module"
 * - Dynamic imports: import("./module") or await import("./module")
 */
function collectModuleSpecifiers(sourceFile: ts.SourceFile): { staticImports: string[]; dynamicImports: string[] } {
  const staticImports: string[] = [];
  const dynamicImports: string[] = [];
  const staticSeen = new Set<string>();
  const dynamicSeen = new Set<string>();

  // Helper to add unique specifiers to static imports
  const addStaticSpecifier = (text: string) => {
    if (!staticSeen.has(text)) {
      staticSeen.add(text);
      staticImports.push(text);
    }
  };

  // Helper to add unique specifiers to dynamic imports
  const addDynamicSpecifier = (text: string) => {
    if (!dynamicSeen.has(text)) {
      dynamicSeen.add(text);
      dynamicImports.push(text);
    }
  };

  // Check top-level statements for static imports/exports
  for (const statement of sourceFile.statements) {
    let specifier: string | undefined;

    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) {
        specifier = statement.moduleSpecifier.text;
      }
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) {
        specifier = statement.moduleSpecifier.text;
      }
    }

    if (specifier) {
      addStaticSpecifier(specifier);
    }
  }

  // Recursively traverse AST for dynamic imports: import("./module")
  const visit = (node: ts.Node) => {
    // Check for dynamic import: import("./module")
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteral(arg)) {
        addDynamicSpecifier(arg.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return { staticImports, dynamicImports };
}

function findTsDefinitions(
  program: ts.Program,
  _compilerOptions: ts.CompilerOptions,
  workspaceRoot: string,
  query: string
): SymbolLocation[] {
  const results: SymbolLocation[] = [];
  const checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!isPathInside(filePath, workspaceRoot)) continue;

    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        if (node.name.text === query) {
          const range = createRange(sourceFile, node.getStart(), node.getEnd());
          results.push({
            filePath,
            range,
            kind: "definition",
            lang: "ts",
            symbolName: query,
          });
        }
      } else if (ts.isClassDeclaration(node) && node.name) {
        if (node.name.text === query) {
          const range = createRange(sourceFile, node.getStart(), node.getEnd());
          results.push({
            filePath,
            range,
            kind: "definition",
            lang: "ts",
            symbolName: query,
          });
        }
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        if (node.name.text === query) {
          const range = createRange(sourceFile, node.getStart(), node.getEnd());
          results.push({
            filePath,
            range,
            kind: "definition",
            lang: "ts",
            symbolName: query,
          });
        }
      } else if (ts.isTypeAliasDeclaration(node) && node.name) {
        if (node.name.text === query) {
          const range = createRange(sourceFile, node.getStart(), node.getEnd());
          results.push({
            filePath,
            range,
            kind: "definition",
            lang: "ts",
            symbolName: query,
          });
        }
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === query) {
            const range = createRange(sourceFile, node.getStart(), node.getEnd());
            results.push({
              filePath,
              range,
              kind: "definition",
              lang: "ts",
              symbolName: query,
            });
          }
        }
      }

      node.forEachChild(visit);
    };

    visit(sourceFile);
  }

  return results;
}

async function findTsReferences(
  languageService: ts.LanguageService,
  definition: SymbolLocation,
  options?: { limit?: number; anchorFiles?: string[] }
): Promise<SymbolLocation[]> {
  const fileName = definition.filePath;
  const position = getPositionFromLine(fileName, definition.range.startLine);
  
  const refs = languageService.getReferencesAtPosition(fileName, position);

  if (!refs) return [];

  const results: SymbolLocation[] = [];
  const anchorSet = new Set(options?.anchorFiles?.map((f) => normalizePath(f)) ?? []);

  // OPTIMIZATION: Get the program once outside the loop
  const program = languageService.getProgram();
  if (!program) return [];
  
  // Get the workspace root from the definition file path
  // This assumes all files in the workspace are under the definition's directory tree
  const workspaceRoot = fileName.substring(0, fileName.indexOf('/src/') + 1) || fileName.substring(0, fileName.lastIndexOf('/') + 1);

  for (const ref of refs) {
    const refFile = normalizePath(ref.fileName);

    // Skip the definition itself
    if (refFile === fileName && (ref as any).isDefinition) continue;

    // OPTIMIZATION: Skip references outside the workspace (e.g., node_modules)
    // This prevents trying to load files that weren't in the original program
    if (!refFile.startsWith(workspaceRoot)) continue;

    const sourceFile = program.getSourceFile(refFile);
    if (!sourceFile) continue;

    const range = createSpanRange(sourceFile, ref.textSpan);

    results.push({
      filePath: refFile,
      range,
      kind: "reference",
      lang: "ts",
    });
  }

  const limit = options?.limit ?? 10;
  return results.slice(0, limit);
}

function getPositionFromLine(fileName: string, line: number): number {
  // Approximate position - would need actual file content for exact position
  return (line - 1) * 50;  // Assume ~50 chars per line on average
}

function createRange(sourceFile: ts.SourceFile, startPos: number, endPos: number): Range {
  const start = sourceFile.getLineAndCharacterOfPosition(startPos);
  const end = sourceFile.getLineAndCharacterOfPosition(endPos);
  return {
    startLine: start.line + 1,
    endLine: end.line + 1,
  };
}

function createSpanRange(sourceFile: ts.SourceFile, span: ts.TextSpan): Range {
  const start = sourceFile.getLineAndCharacterOfPosition(span.start);
  const end = sourceFile.getLineAndCharacterOfPosition(span.start + span.length);
  return {
    startLine: start.line + 1,
    endLine: end.line + 1,
  };
}

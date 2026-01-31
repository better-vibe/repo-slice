import { parentPort, workerData } from "node:worker_threads";
import { relative } from "node:path";

const { workerId } = workerData as { workerId: number };

// Notify main thread that worker is ready
parentPort?.postMessage({ type: "ready" });

// Message handler
parentPort?.on("message", async (msg) => {
  const { type, id, input } = msg;

  try {
    let result: unknown;

    switch (type) {
      case "ts-parse":
        result = await parseTypeScriptFiles(input);
        break;
      case "py-parse":
        result = await parsePythonFiles(input);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    parentPort?.postMessage({ type: "result", id, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage({ type: "error", id, error: errorMessage });
  }
});

/**
 * Parse TypeScript files in worker
 */
async function parseTypeScriptFiles(input: {
  files: string[];
  workspaceRoot: string;
}): Promise<{
  importGraph: Record<string, Record<string, string>>;
  callExpressions: unknown[];
}> {
  // Dynamic imports to avoid loading in main thread
  const tsModule = await import("typescript");
  const ts = tsModule;
  const { normalizePath, isPathInside } = await import("../utils/path.js");

  const { files, workspaceRoot } = input;

  const compilerOptions = {
    allowJs: true,
    jsx: tsModule.JsxEmit.Preserve,
    target: tsModule.ScriptTarget.ES2020,
    module: tsModule.ModuleKind.NodeNext,
    moduleResolution: tsModule.ModuleResolutionKind.NodeNext,
  };

  const host = tsModule.createCompilerHost(compilerOptions, true);
  const program = tsModule.createProgram(files, compilerOptions, host);

  // Build import graph
  const importGraph: Record<string, Record<string, string>> = {};
  const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".d.ts"];

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!isPathInside(filePath, workspaceRoot)) continue;
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) continue;

    importGraph[filePath] = {};
    const targets = importGraph[filePath];

    // Collect module specifiers
    const specifiers = collectTsModuleSpecifiers(tsModule, sourceFile);

    for (const moduleSpecifier of specifiers) {
      if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) {
        continue;
      }

      const resolved = tsModule.resolveModuleName(moduleSpecifier, filePath, compilerOptions, host);

      if (resolved.resolvedModule) {
        const resolvedPath = normalizePath(resolved.resolvedModule.resolvedFileName);
        if (isPathInside(resolvedPath, workspaceRoot)) {
          targets[resolvedPath] = "imports";
        }
      }
    }
  }

  // Collect call expressions
  const callExpressions: unknown[] = [];
  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!isPathInside(filePath, workspaceRoot)) continue;

    // Simple call expression collection
    const visit = (node: any) => {
      if (tsModule.isCallExpression(node) || tsModule.isNewExpression(node)) {
        const callInfo = extractCallInfo(tsModule, sourceFile, node);
        if (callInfo) {
          callExpressions.push(callInfo);
        }
      }
      tsModule.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return { importGraph, callExpressions };
}

/**
 * Collect module specifiers from TypeScript source
 */
function collectTsModuleSpecifiers(ts: any, sourceFile: any): string[] {
  const specifiers: string[] = [];
  const seen = new Set<string>();

  const addSpecifier = (text: string) => {
    if (!seen.has(text)) {
      seen.add(text);
      specifiers.push(text);
    }
  };

  // Top-level imports/exports
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
      addSpecifier(specifier);
    }
  }

  // Dynamic imports
  const visit = (node: any) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteral(arg)) {
        addSpecifier(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return specifiers;
}

/**
 * Extract call expression info
 */
function extractCallInfo(
  ts: any,
  sourceFile: any,
  node: any
): unknown {
  const expression = node.expression;
  let calleeSymbol = "unknown";

  if (ts.isIdentifier(expression)) {
    calleeSymbol = expression.text;
  } else if (ts.isPropertyAccessExpression(expression)) {
    const parts: string[] = [];
    let current = expression;
    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }
    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
    }
    calleeSymbol = parts.join(".");
  }

  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return {
    callerFile: normalizePath(sourceFile.fileName),
    calleeSymbol,
    range: {
      startLine: start.line + 1,
      endLine: end.line + 1,
    },
    confidence: 0.8,
    isDynamic: false,
  };
}

/**
 * Parse Python files in worker
 */
async function parsePythonFiles(input: {
  files: string[];
  workspaceRoot: string;
  pythonImportRoots: string[];
}): Promise<{
  moduleMap: Record<string, string>;
  definitions: Record<string, unknown[]>;
  importGraph: Record<string, Record<string, string>>;
}> {
  // Dynamic imports to avoid loading in main thread
  const Parser = (await import("tree-sitter")).default;
  const Python = (await import("tree-sitter-python")).default;
  const { normalizePath, isPathInside, toPosixPath } = await import("../utils/path.js");

  const { files, workspaceRoot, pythonImportRoots } = input;

  const parser = new Parser();
  parser.setLanguage(Python);

  const moduleMap: Record<string, string> = {};
  const definitions: Record<string, unknown[]> = {};
  const importGraph: Record<string, Record<string, string>> = {};

  // Build module map and resolve imports
  for (const file of files) {
    const moduleName = resolvePythonModuleName(workspaceRoot, file, pythonImportRoots);
    if (moduleName && !moduleMap[moduleName]) {
      moduleMap[moduleName] = file;
    }
  }

  // Parse each file
  for (const file of files) {
    try {
      const content = await import("../utils/fs.js").then((m) => m.readText(file));
      const tree = parser.parse(content);

      // Collect definitions
      definitions[file] = collectPythonDefinitions(tree.rootNode);

      // Build import graph
      importGraph[file] = {};
      const targets = importGraph[file];

      const importNodes = tree.rootNode.descendantsOfType(["import_statement", "import_from_statement"]);
      for (const node of importNodes) {
        const modules = extractPythonImportedModules(node);
        for (const mod of modules) {
          const resolved = resolvePythonModuleToFile(mod, moduleMap);
          if (resolved && isPathInside(resolved, workspaceRoot)) {
            targets[resolved] = "imports";
          }
        }
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return { moduleMap, definitions, importGraph };
}

/**
 * Resolve Python module name from file path
 */
function resolvePythonModuleName(workspaceRoot: string, filePath: string, importRoots: string[]): string | undefined {
  const normalized = normalizePath(filePath);
  for (const root of importRoots) {
    const { join } = require("node:path");
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

/**
 * Resolve Python module to file
 */
function resolvePythonModuleToFile(moduleName: string, moduleMap: Record<string, string>): string | undefined {
  if (moduleMap[moduleName]) return moduleMap[moduleName];
  const parts = moduleName.split(".");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join(".");
    if (moduleMap[candidate]) return moduleMap[candidate];
  }
  return undefined;
}

/**
 * Collect Python definitions from AST
 */
function collectPythonDefinitions(root: any): unknown[] {
  const definitions: unknown[] = [];

  const visit = (node: any, currentClass?: unknown): void => {
    if (node.type === "decorated_definition") {
      const defNode = node.namedChildren.find((child: any) =>
        ["function_definition", "class_definition"].includes(child.type)
      );
      if (defNode) {
        const def = createPythonDefinition(defNode, node, currentClass);
        if (def) definitions.push(def);
        if (defNode.type === "class_definition" && def) {
          const classContext = { ...def, kind: "class" };
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
      const def = createPythonDefinition(node, node, currentClass);
      if (def) {
        definitions.push(def);
        const classContext = { ...def, kind: "class" };
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
      const def = createPythonDefinition(node, node, currentClass);
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

/**
 * Create Python definition object
 */
function createPythonDefinition(node: any, rangeNode: any, currentClass?: unknown): unknown | null {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return null;
  const range = {
    startLine: rangeNode.startPosition.row + 1,
    endLine: rangeNode.endPosition.row + 1,
  };

  if (currentClass && node.type === "function_definition") {
    return {
      name: nameNode.text,
      kind: "method",
      range,
      className: (currentClass as any).name,
    };
  }
  if (node.type === "class_definition") {
    return { name: nameNode.text, kind: "class", range };
  }
  return { name: nameNode.text, kind: "function", range };
}

/**
 * Extract imported modules from Python import node
 */
function extractPythonImportedModules(node: any): string[] {
  if (node.type === "import_statement") {
    return node.namedChildren
      .filter((child: any) => child.type === "dotted_name")
      .map((child: any) => child.text);
  }
  if (node.type === "import_from_statement") {
    let moduleName = "";
    for (const child of node.namedChildren) {
      if (child.type === "dotted_name") {
        moduleName = child.text;
      }
    }
    return moduleName ? [moduleName] : [];
  }
  return [];
}

// Helper function
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function isPathInside(child: string, parent: string): boolean {
  const c = child.replace(/\\/g, "/");
  const p = parent.replace(/\\/g, "/");
  return c.startsWith(p + "/") || c === p;
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

import ts from "typescript";
import type { CallExpression, Range } from "../types.js";
import { isPathInside, normalizePath } from "../../utils/path.js";

export interface FindCallsOptions {
  files?: string[];
  symbolFilter?: string[];
}

export function findTsCallExpressions(
  program: ts.Program,
  workspaceRoot: string,
  options?: FindCallsOptions
): CallExpression[] {
  const results: CallExpression[] = [];
  const checker = program.getTypeChecker();
  const targetFiles = options?.files
    ? new Set(options.files.map((f) => normalizePath(f)))
    : null;
  const symbolFilter = options?.symbolFilter
    ? new Set(options.symbolFilter)
    : null;

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!isPathInside(filePath, workspaceRoot)) continue;
    if (targetFiles && !targetFiles.has(filePath)) continue;

    const visit = (node: ts.Node, enclosingSymbol?: string): void => {
      const newEnclosingSymbol = getEnclosingSymbol(node, enclosingSymbol);

      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const callExpr = analyzeCallExpression(
          node,
          sourceFile,
          checker,
          filePath,
          newEnclosingSymbol
        );
        if (callExpr) {
          if (!symbolFilter || symbolFilter.has(callExpr.calleeSymbol)) {
            results.push(callExpr);
          }
        }
      }

      node.forEachChild((child) => visit(child, newEnclosingSymbol));
    };

    visit(sourceFile);
  }

  return results;
}

function getEnclosingSymbol(
  node: ts.Node,
  currentSymbol?: string
): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    const parent = node.parent;
    if (ts.isClassDeclaration(parent) && parent.name) {
      return `${parent.name.text}.${node.name.text}`;
    }
    return node.name.text;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
  }
  if (ts.isConstructorDeclaration(node)) {
    const parent = node.parent;
    if (ts.isClassDeclaration(parent) && parent.name) {
      return `${parent.name.text}.constructor`;
    }
  }
  return currentSymbol;
}

function analyzeCallExpression(
  node: ts.CallExpression | ts.NewExpression,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  filePath: string,
  callerSymbol?: string
): CallExpression | null {
  const expression = node.expression;
  let calleeSymbol: string | undefined;
  let confidence = 1.0;
  let isDynamic = false;

  if (ts.isIdentifier(expression)) {
    calleeSymbol = resolveIdentifierSymbol(expression, checker);
    if (!calleeSymbol) {
      calleeSymbol = expression.text;
      confidence = 0.8;
    }
  } else if (ts.isPropertyAccessExpression(expression)) {
    calleeSymbol = resolvePropertyAccessSymbol(expression, checker);
    if (!calleeSymbol) {
      calleeSymbol = buildPropertyAccessChain(expression);
      confidence = 0.6;
      isDynamic = true;
    }
  } else if (ts.isElementAccessExpression(expression)) {
    calleeSymbol = `[dynamic]`;
    confidence = 0.3;
    isDynamic = true;
  } else {
    return null;
  }

  if (!calleeSymbol) return null;

  const range = createRange(sourceFile, node.getStart(), node.getEnd());

  return {
    callerFile: filePath,
    callerSymbol,
    calleeSymbol,
    range,
    confidence,
    isDynamic,
  };
}

function resolveIdentifierSymbol(
  identifier: ts.Identifier,
  checker: ts.TypeChecker
): string | undefined {
  try {
    const symbol = checker.getSymbolAtLocation(identifier);
    if (!symbol) return undefined;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    const declaration = declarations[0];
    const sourceFile = declaration.getSourceFile();

    if (ts.isFunctionDeclaration(declaration) && declaration.name) {
      const relPath = getRelativePath(sourceFile.fileName);
      return `${relPath}#${declaration.name.text}`;
    }

    if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
      if (declaration.initializer &&
          (ts.isFunctionExpression(declaration.initializer) ||
           ts.isArrowFunction(declaration.initializer))) {
        const relPath = getRelativePath(sourceFile.fileName);
        return `${relPath}#${declaration.name.text}`;
      }
    }

    if (ts.isClassDeclaration(declaration) && declaration.name) {
      const relPath = getRelativePath(sourceFile.fileName);
      return `${relPath}#${declaration.name.text}`;
    }

    return identifier.text;
  } catch {
    return undefined;
  }
}

function resolvePropertyAccessSymbol(
  expression: ts.PropertyAccessExpression,
  checker: ts.TypeChecker
): string | undefined {
  try {
    const symbol = checker.getSymbolAtLocation(expression);
    if (!symbol) return undefined;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    const declaration = declarations[0];

    if (ts.isMethodDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
      const classDecl = declaration.parent;
      if (ts.isClassDeclaration(classDecl) && classDecl.name) {
        const sourceFile = declaration.getSourceFile();
        const relPath = getRelativePath(sourceFile.fileName);
        return `${relPath}#${classDecl.name.text}.${declaration.name.text}`;
      }
    }

    const objectType = checker.getTypeAtLocation(expression.expression);
    const typeName = checker.typeToString(objectType);
    const methodName = expression.name.text;

    if (typeName && typeName !== "any" && !typeName.includes("typeof")) {
      return `${typeName}.${methodName}`;
    }

    return buildPropertyAccessChain(expression);
  } catch {
    return undefined;
  }
}

function buildPropertyAccessChain(expression: ts.PropertyAccessExpression): string {
  const parts: string[] = [];
  let current: ts.Expression = expression;

  while (ts.isPropertyAccessExpression(current)) {
    parts.unshift(current.name.text);
    current = current.expression;
  }

  if (ts.isIdentifier(current)) {
    parts.unshift(current.text);
  } else {
    parts.unshift("[expr]");
  }

  return parts.join(".");
}

function getRelativePath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  const srcIndex = parts.findIndex((p) => p === "src");
  if (srcIndex >= 0) {
    return parts.slice(srcIndex).join("/");
  }
  return parts.slice(-2).join("/");
}

function createRange(
  sourceFile: ts.SourceFile,
  startPos: number,
  endPos: number
): Range {
  const start = sourceFile.getLineAndCharacterOfPosition(startPos);
  const end = sourceFile.getLineAndCharacterOfPosition(endPos);
  return {
    startLine: start.line + 1,
    endLine: end.line + 1,
  };
}

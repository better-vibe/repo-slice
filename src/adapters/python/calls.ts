import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { CallExpression, Range } from "../types.js";
import { normalizePath, toPosixPath } from "../../utils/path.js";
import { relative } from "node:path";

export interface FindPyCallsOptions {
  files?: string[];
  symbolFilter?: string[];
}

export interface PythonCallContext {
  workspaceRoot: string;
  fileContents: Map<string, string>;
  definitions: Map<string, { name: string; kind: string; className?: string }[]>;
  moduleMap: Map<string, string>;
}

export async function findPythonCallExpressions(
  context: PythonCallContext,
  options?: FindPyCallsOptions
): Promise<CallExpression[]> {
  // Initialize parser when function is called
  const parser = new Parser();
  parser.setLanguage(Python);
  
  const results: CallExpression[] = [];
  const targetFiles = options?.files
    ? new Set(options.files.map((f) => normalizePath(f)))
    : null;
  const symbolFilter = options?.symbolFilter
    ? new Set(options.symbolFilter)
    : null;

  for (const [filePath, content] of context.fileContents.entries()) {
    if (targetFiles && !targetFiles.has(filePath)) continue;

    const tree = parser.parse(content);
    const callNodes = tree.rootNode.descendantsOfType(["call"]);

    for (const callNode of callNodes) {
      const callExpr = await analyzeCallNode(
        callNode,
        filePath,
        context
      );
      if (callExpr) {
        if (!symbolFilter || symbolFilter.has(callExpr.calleeSymbol)) {
          results.push(callExpr);
        }
      }
    }
  }

  return results;
}

async function analyzeCallNode(
  node: any,
  filePath: string,
  context: PythonCallContext
): Promise<CallExpression | null> {
  const functionNode = node.childForFieldName("function");
  if (!functionNode) return null;

  let calleeSymbol: string | undefined;
  let confidence = 0.7; // Lower baseline for Python due to dynamic typing
  let isDynamic = false;

  const enclosingSymbol = findEnclosingFunction(node);

  if (functionNode.type === "identifier") {
    calleeSymbol = functionNode.text;
    const resolved = resolveIdentifier(functionNode.text, filePath, context);
    if (resolved) {
      calleeSymbol = resolved;
      confidence = 0.9;
    }
  } else if (functionNode.type === "attribute") {
    const objectNode = functionNode.childForFieldName("object");
    const attrNode = functionNode.childForFieldName("attribute");
    if (attrNode) {
      if (objectNode?.type === "identifier") {
        const resolved = resolveAttributeCall(
          objectNode.text,
          attrNode.text,
          filePath,
          context
        );
        if (resolved) {
          calleeSymbol = resolved;
          confidence = 0.8;
        } else {
          calleeSymbol = `${objectNode.text}.${attrNode.text}`;
          confidence = 0.5;
          isDynamic = true;
        }
      } else if (objectNode?.type === "call") {
        calleeSymbol = `[call].${attrNode.text}`;
        confidence = 0.3;
        isDynamic = true;
      } else if (objectNode?.type === "attribute") {
        calleeSymbol = `${buildAttributeChain(objectNode)}.${attrNode.text}`;
        confidence = 0.4;
        isDynamic = true;
      } else {
        calleeSymbol = `[expr].${attrNode.text}`;
        confidence = 0.2;
        isDynamic = true;
      }
    }
  } else if (functionNode.type === "subscript") {
    calleeSymbol = "[subscript]";
    confidence = 0.1;
    isDynamic = true;
  } else {
    return null;
  }

  if (!calleeSymbol) return null;

  const range = toRange(node);

  return {
    callerFile: filePath,
    callerSymbol: enclosingSymbol,
    calleeSymbol,
    range,
    confidence,
    isDynamic,
  };
}

function findEnclosingFunction(node: any): string | undefined {
  let current: any | null = node.parent;

  while (current) {
    if (current.type === "function_definition") {
      const nameNode = current.childForFieldName("name");
      if (nameNode) {
        const classNode = findEnclosingClass(current);
        if (classNode) {
          return `${classNode}.${nameNode.text}`;
        }
        return nameNode.text;
      }
    }
    current = current.parent;
  }

  return undefined;
}

function findEnclosingClass(node: any): string | undefined {
  let current: any | null = node.parent;

  while (current) {
    if (current.type === "class_definition") {
      const nameNode = current.childForFieldName("name");
      if (nameNode) {
        return nameNode.text;
      }
    }
    current = current.parent;
  }

  return undefined;
}

function resolveIdentifier(
  name: string,
  filePath: string,
  context: PythonCallContext
): string | undefined {
  const defs = context.definitions.get(filePath);
  if (defs) {
    const def = defs.find((d) => d.name === name);
    if (def) {
      const relPath = toPosixPath(relative(context.workspaceRoot, filePath));
      if (def.className) {
        return `${relPath}#${def.className}.${def.name}`;
      }
      return `${relPath}#${def.name}`;
    }
  }

  for (const [modName, modFile] of context.moduleMap.entries()) {
    const modDefs = context.definitions.get(modFile);
    if (modDefs) {
      const def = modDefs.find((d) => d.name === name);
      if (def) {
        const relPath = toPosixPath(relative(context.workspaceRoot, modFile));
        return `${relPath}#${def.name}`;
      }
    }
  }

  return undefined;
}

function resolveAttributeCall(
  objectName: string,
  attrName: string,
  filePath: string,
  context: PythonCallContext
): string | undefined {
  if (objectName === "self" || objectName === "cls") {
    const classNode = findClassContext(filePath, context);
    if (classNode) {
      const relPath = toPosixPath(relative(context.workspaceRoot, filePath));
      return `${relPath}#${classNode}.${attrName}`;
    }
  }

  const defs = context.definitions.get(filePath);
  if (defs) {
    const classDef = defs.find((d) => d.kind === "class" && d.name === objectName);
    if (classDef) {
      const relPath = toPosixPath(relative(context.workspaceRoot, filePath));
      return `${relPath}#${objectName}.${attrName}`;
    }
  }

  for (const [, modFile] of context.moduleMap.entries()) {
    const modDefs = context.definitions.get(modFile);
    if (modDefs) {
      const classDef = modDefs.find(
        (d) => d.kind === "class" && d.name === objectName
      );
      if (classDef) {
        const relPath = toPosixPath(relative(context.workspaceRoot, modFile));
        return `${relPath}#${objectName}.${attrName}`;
      }
    }
  }

  return undefined;
}

function findClassContext(
  filePath: string,
  context: PythonCallContext
): string | undefined {
  return undefined;
}

function buildAttributeChain(node: any): string {
  const parts: string[] = [];
  let current: any | null = node;

  while (current) {
    if (current.type === "attribute") {
      const attrNode = current.childForFieldName("attribute");
      if (attrNode) {
        parts.unshift(attrNode.text);
      }
      current = current.childForFieldName("object");
    } else if (current.type === "identifier") {
      parts.unshift(current.text);
      break;
    } else {
      parts.unshift("[expr]");
      break;
    }
  }

  return parts.join(".");
}

function toRange(node: any): Range {
  return {
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  };
}
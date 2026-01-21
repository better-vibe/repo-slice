import { join, isAbsolute } from "node:path";
import type { Range } from "../adapters/types.js";
import { normalizePath } from "../utils/path.js";

export interface LogAnchor {
  filePath: string;
  range: Range;
}

// TypeScript/JavaScript generic: src/foo.ts:12:5 or src/foo.tsx:12
// Note: tsx/jsx must come before ts/js in alternation to match longer extensions first
const TS_JS_REGEX =
  /([A-Za-z0-9_\-./\\]+?\.(tsx|ts|jsx|js)):(\d+)(?::(\d+))?/;

// Python generic: src/foo.py:12:5 or src/foo.py:12
const PY_REGEX = /([A-Za-z0-9_\-./\\]+?\.py):(\d+)(?::(\d+))?/;

// pytest: File "src/foo.py", line 12
const PYTEST_REGEX = /File "([^"]+\.py)", line (\d+)/;

// Jest/Vitest stack trace: at Object.<anonymous> (src/foo.test.ts:12:5)
const JEST_STACK_REGEX = /at .+? \(([^)]+?\.(tsx|ts|jsx|js)):(\d+):(\d+)\)/;

// Jest/Vitest test file header: FAIL src/foo.test.ts or ❯ src/foo.test.ts:12:5
const JEST_VITEST_FILE_REGEX =
  /(?:FAIL|PASS|❯|›)\s+([A-Za-z0-9_\-./\\]+?\.(tsx|ts|jsx|js))(?::(\d+))?/;

// mypy: src/foo.py:12: error: ...
const MYPY_REGEX = /([A-Za-z0-9_\-./\\]+?\.py):(\d+):\s*(?:error|warning|note):/;

// pyright: src/foo.py:12:5 - error: ... or /path/to/foo.py:12:5 - error
const PYRIGHT_REGEX =
  /([A-Za-z0-9_\-./\\]+?\.py):(\d+):(\d+)\s*-\s*(?:error|warning|information):/;

export function parseLogAnchors(logText: string, repoRoot: string): LogAnchor[] {
  const anchors: LogAnchor[] = [];
  const seen = new Set<string>();

  const addAnchor = (rawPath: string, lineNumber: number): void => {
    const filePath = resolveLogPath(rawPath, repoRoot);
    const key = `${filePath}:${lineNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      anchors.push({
        filePath,
        range: {
          startLine: Math.max(1, lineNumber - 3),
          endLine: lineNumber + 3,
        },
      });
    }
  };

  for (const line of logText.split(/\r?\n/)) {
    // Try Jest/Vitest stack trace first (most specific)
    const jestStackMatch = line.match(JEST_STACK_REGEX);
    if (jestStackMatch) {
      addAnchor(jestStackMatch[1], Number(jestStackMatch[3]));
      continue;
    }

    // Try Jest/Vitest file header
    const jestVitestFileMatch = line.match(JEST_VITEST_FILE_REGEX);
    if (jestVitestFileMatch) {
      const lineNumber = jestVitestFileMatch[3] ? Number(jestVitestFileMatch[3]) : 1;
      addAnchor(jestVitestFileMatch[1], lineNumber);
      continue;
    }

    // Try mypy format
    const mypyMatch = line.match(MYPY_REGEX);
    if (mypyMatch) {
      addAnchor(mypyMatch[1], Number(mypyMatch[2]));
      continue;
    }

    // Try pyright format
    const pyrightMatch = line.match(PYRIGHT_REGEX);
    if (pyrightMatch) {
      addAnchor(pyrightMatch[1], Number(pyrightMatch[2]));
      continue;
    }

    // Try pytest format
    const pytestMatch = line.match(PYTEST_REGEX);
    if (pytestMatch) {
      addAnchor(pytestMatch[1], Number(pytestMatch[2]));
      continue;
    }

    // Try generic TypeScript/JavaScript format (tsc, etc.)
    const tsJsMatch = line.match(TS_JS_REGEX);
    if (tsJsMatch) {
      addAnchor(tsJsMatch[1], Number(tsJsMatch[3]));
      continue;
    }

    // Try generic Python format
    const pyMatch = line.match(PY_REGEX);
    if (pyMatch) {
      addAnchor(pyMatch[1], Number(pyMatch[2]));
    }
  }

  return anchors;
}

function resolveLogPath(path: string, repoRoot: string): string {
  if (isAbsolute(path)) return normalizePath(path);
  return normalizePath(join(repoRoot, path));
}

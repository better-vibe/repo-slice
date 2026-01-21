import { test, expect } from "bun:test";
import { parseLogAnchors } from "../src/anchors/log.js";

test("parses tsc-style log anchors", () => {
  const log = "src/app.ts:10:5 - error TS2345: nope";
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(1);
  expect(anchors[0].filePath).toBe("/repo/src/app.ts");
  expect(anchors[0].range.startLine).toBe(7);
  expect(anchors[0].range.endLine).toBe(13);
});

test("parses pytest-style log anchors", () => {
  const log = 'File "tests/test_app.py", line 42';
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(1);
  expect(anchors[0].filePath).toBe("/repo/tests/test_app.py");
  expect(anchors[0].range.startLine).toBe(39);
  expect(anchors[0].range.endLine).toBe(45);
});

test("parses jest stack trace anchors", () => {
  const log = `  at Object.<anonymous> (src/utils/helper.test.ts:25:10)
    at Object.<anonymous> (src/utils/helper.ts:12:5)`;
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(2);
  expect(anchors[0].filePath).toBe("/repo/src/utils/helper.test.ts");
  expect(anchors[0].range.startLine).toBe(22);
  expect(anchors[0].range.endLine).toBe(28);
  expect(anchors[1].filePath).toBe("/repo/src/utils/helper.ts");
});

test("parses jest/vitest FAIL header", () => {
  const log = `FAIL src/components/Button.test.tsx
  ● Button › renders correctly`;
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(1);
  expect(anchors[0].filePath).toBe("/repo/src/components/Button.test.tsx");
  expect(anchors[0].range.startLine).toBe(1);
});

test("parses vitest pointer format", () => {
  const log = ` ❯ src/lib/utils.test.ts:15:3`;
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(1);
  expect(anchors[0].filePath).toBe("/repo/src/lib/utils.test.ts");
  expect(anchors[0].range.startLine).toBe(12);
  expect(anchors[0].range.endLine).toBe(18);
});

test("parses mypy-style anchors", () => {
  const log = `src/models/user.py:45: error: Incompatible types
src/models/user.py:52: warning: Missing return type`;
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(2);
  expect(anchors[0].filePath).toBe("/repo/src/models/user.py");
  expect(anchors[0].range.startLine).toBe(42);
  expect(anchors[1].filePath).toBe("/repo/src/models/user.py");
  expect(anchors[1].range.startLine).toBe(49);
});

test("parses pyright-style anchors", () => {
  const log = `src/api/handler.py:30:12 - error: Type "str" is not assignable to type "int"
src/api/handler.py:45:8 - warning: Expression value is unused`;
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(2);
  expect(anchors[0].filePath).toBe("/repo/src/api/handler.py");
  expect(anchors[0].range.startLine).toBe(27);
  expect(anchors[1].filePath).toBe("/repo/src/api/handler.py");
  expect(anchors[1].range.startLine).toBe(42);
});

test("deduplicates anchors from same location", () => {
  const log = `src/app.ts:10:5 - error TS2345: problem 1
src/app.ts:10:8 - error TS2345: problem 2`;
  const anchors = parseLogAnchors(log, "/repo");
  expect(anchors.length).toBe(1);
});

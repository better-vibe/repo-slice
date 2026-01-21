import { test, expect } from "bun:test";
import { parseDiff } from "../src/anchors/diff.js";

test("parses diff hunks", () => {
  const diff = `
diff --git a/src/app.ts b/src/app.ts
index 111..222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 export const a = 1;
 export const b = 2;
+export const c = 3;
`;
  const hunks = parseDiff(diff, "/repo");
  expect(hunks.length).toBe(1);
  expect(hunks[0].filePath).toBe("/repo/src/app.ts");
  expect(hunks[0].range.startLine).toBe(1);
  expect(hunks[0].range.endLine).toBe(3);
});

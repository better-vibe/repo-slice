---
"@better-vibe/repo-slice": patch
---

**Fix: Dynamic Import Detection**

Fixed TypeScript adapter to properly detect and follow dynamic imports:

- **Issue**: Dynamic imports like `await import("./module")` were not being detected
- **Solution**: Added AST traversal to find `import()` call expressions
- **Result**: All command files with dynamic imports now properly included in pack output

**Files modified**:
- `src/adapters/ts/index.ts` - Added `collectModuleSpecifiers()` function with dynamic import detection

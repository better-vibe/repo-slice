---
"@better-vibe/repo-slice": minor
---

**Documentation and Tests for Folder Packing**

Added comprehensive documentation and test coverage for the new folder packing feature:

**Documentation Updates:**
- Updated `README.md` with folder packing options table and examples
- Updated `docs/06-cli/commands.md` with folder packing section
- Updated `docs/06-cli/options.md` with folder-specific options
- Help text includes all folder options

**Test Coverage:**
- Created `test/folder-packing.test.ts` with comprehensive test suite
- Tests for basic folder packing, size limits, hidden files
- Tests for empty directories, binary files, CLI validation
- Tests for output format and mixing with other anchors

**Bug Fixes:**
- Fixed `--folder-max-size 0` handling (nullish coalescing vs logical OR)
- Fixed empty directory handling in budget selection
- Exported `runCli` from e2e.test.ts for test reuse

**Test Results:**
- 121 tests passing
- 2 pre-existing failures (unrelated to folder packing)
- All folder packing functionality working correctly

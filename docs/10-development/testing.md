# Testing

**Directory:** `test/`

## Purpose

This guide covers running and writing tests for repo-slice.

## Current Tests

| Test Suite | Description |
|------------|-------------|
| Workspace detection | Tests for Node and Python workspace detection |
| Log and diff parsers | Tests for anchor input parsing |
| Budget selection | Tests for candidate selection within limits |
| Markdown renderer | Golden test for output format |

## Fixtures

Fixtures live under `fixtures/` and include:

| Fixture | Description |
|---------|-------------|
| `monorepo/` | Simple monorepo with Node + Python workspaces |
| `golden/bundle.md` | Golden Markdown output snapshot |

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test test/workspaces.test.ts

# Run with watch mode
bun test --watch
```

## Writing Tests

Tests use bun's built-in test runner. Example:

```typescript
import { describe, test, expect } from "bun:test";

describe("MyFeature", () => {
  test("should work correctly", () => {
    expect(myFunction()).toBe(expected);
  });
});
```

## Planned

- End-to-end CLI tests against fixtures
- JSON output snapshots

## Related

- [Getting Started](./getting-started.md)
- [Project Structure](../02-architecture/project-structure.md)

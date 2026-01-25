# Python Adapter

**File:** `src/adapters/python/index.ts`

## Purpose

The Python adapter provides indexing and symbol resolution for Python files using tree-sitter for parsing and AST traversal.

## Features (Current)

- Uses tree-sitter for parsing and AST traversal
- Builds a module map from `pythonImportRoots` (default: `src`, `.`)

### Import Graph Detection

The adapter detects both static and dynamic imports:

| Import Form | Edge Type | Example |
|-------------|-----------|---------|
| `import module` | `imports` | Static import |
| `from module import x` | `imports` | Static from-import |
| `importlib.import_module("...")` | `imports-dynamic` | Dynamic importlib import |
| `__import__("...")` | `imports-dynamic` | Built-in dynamic import |

Dynamic imports are only detected when the module name is a string literal. Variable module names (e.g., `importlib.import_module(name)`) are not tracked.

## Symbol Query Formats

| Format | Example | Description |
|--------|---------|-------------|
| Simple name | `create_user` | Find any symbol with this name |
| Qualified name | `UserService.create` | Find method on class |
| Module-scoped | `billing.invoice:Invoice.total` | Find symbol in specific module |
| Module inference | `billing.invoice.Invoice.total` | Infer module from dotted path |

## Reference Resolution

References are best-effort using name-based identifier and attribute matches. This approach may include false positives in some cases.

## Configuration

The `pythonImportRoots` setting controls where the adapter looks for Python modules:

```json
{
  "workspaces": {
    "pythonImportRoots": ["src", "."]
  }
}
```

## Planned

- Smarter reference resolution using semantic analysis

## Related

- [TypeScript Adapter](./typescript.md)
- [Analyzers Overview](./overview.md)
- [Configuration](../07-configuration/overview.md)

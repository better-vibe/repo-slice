# TypeScript Adapter

**File:** `src/adapters/ts/index.ts`

## Purpose

The TypeScript adapter provides indexing and symbol resolution for TypeScript and JavaScript files using the TypeScript Compiler API and language service.

## Features (Current)

- Uses the TypeScript compiler API and language service
- Loads `tsconfig.json` (or `tsconfig.base.json`) when present
- Builds an import graph from `import`/`export` declarations

## Symbol Query Formats

| Format | Example | Description |
|--------|---------|-------------|
| Simple name | `createUser` | Find any symbol with this name |
| Qualified name | `UserService.create` | Find method on class/object |
| Default export | `default` | Find default export |
| File-scoped | `path/to/file.ts:Symbol` | Find symbol in specific file |

## Reference Resolution

References are found via the language service `findReferences` API and ranked by proximity to anchor files.

## Planned

- Improved symbol disambiguation and re-export tracking

## Related

- [Python Adapter](./python.md)
- [Analyzers Overview](./overview.md)

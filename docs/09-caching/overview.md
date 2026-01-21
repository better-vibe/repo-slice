# Caching

**File:** `src/cache/`

## Purpose

Caching keeps `--all-workspaces` and large repos usable by avoiding repeated indexing when files and config haven't changed.

## Location

```
.repo-slice/cache/
```

## Cache Keying (Current)

Each workspace cache is keyed by a hash of:

| Component | Description |
|-----------|-------------|
| Workspace root path | Absolute path to workspace |
| Config hash | Hash of ignore patterns + Python import roots |
| repo-slice version | CLI version string |

## Cache Contents (Current)

| Content | Description |
|---------|-------------|
| File stats | mtime + size for change detection |
| TS import graph | TypeScript module dependency graph |
| Python module map | Python module to file mappings |
| Python definitions | Symbol definitions index |
| Python import graph | Python module dependency graph |

## Invalidation

Cache is invalidated when:

- File stats change (mtime or size differs)
- Config hash changes
- repo-slice version changes

## Planned

- Partial invalidation by file diff
- Cache compaction and size limits

## Related

- [Configuration](../07-configuration/overview.md)
- [Analyzers](../04-analyzers/overview.md)

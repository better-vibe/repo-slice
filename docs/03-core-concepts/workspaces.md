# Workspaces

**File:** `src/workspaces/`

## Purpose

`repo-slice` detects and scopes workspaces to keep searches fast and relevant in monorepo environments.

## Detection (Current)

### Node Workspaces

- `pnpm-workspace.yaml`
- `package.json#workspaces` (npm/yarn style globs)

### Python Workspaces

- `pyproject.toml` or `requirements.txt`
- Heuristics under `apps/*`, `packages/*`, `services/*`

Node and Python workspaces at the same root are merged as `mixed`.

## Scope Resolution

### Default Scope (`--workspace auto`)

- Select the nearest workspace (deepest ancestor of `cwd`)
- Fallback to the first detected workspace if none contain `cwd`

### Explicit Scope

- `--workspace <name>` - Matches package name
- `--workspace <path>` - Directory inside workspace

### All Workspaces

- `--all-workspaces` - Search across every detected workspace
- `--fallback-all` - Retry across all if symbols not found in initial scope

## Cross-Workspace Anchors

If anchors reference files in multiple workspaces (entry/diff/log), those workspaces are included in the bundle even when scope is "nearest".

## Planned

- Optional strict mode for workspace selection errors

## Related

- [CLI Options](../06-cli/options.md)
- [Glossary](./glossary.md)

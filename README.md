# repo-slice

A deterministic CLI that extracts high-signal context bundles from repositories for AI-assisted coding workflows.

## Overview

`repo-slice` analyzes your codebase and produces focused, relevant context bundles optimized for LLMs. It follows import graphs, finds symbol references, and intelligently selects the most relevant code within configurable budgets.

**Key Features:**
- **Multiple anchor types** - Entry files, symbols, git diffs, or error logs
- **Import graph traversal** - Automatically includes dependencies up to N levels deep
- **Budget-aware selection** - Stay within character/token limits with smart ranking
- **Deterministic output** - Same inputs always produce the same bundle
- **Monorepo support** - Workspace detection and scoped queries

## Installation

### From npm (recommended)

```bash
npm install -g repo-slice
bun install -g repo-slice
# or
npx repo-slice pack --entry src/index.ts
bunx repo-slice pack --entry src/index.ts
```

### From source

```bash
# Clone and install
git clone https://github.com/your-org/repo-slice.git
cd repo-slice
bun install

# Build
bun run build

# Run directly with bun (development)
bun run src/cli.ts
```

**Requirements:**
- Node.js >= 18 (Node.js 20 LTS recommended)
- Bun (for development)

## Quick Start

```bash
# Bundle context starting from an entry file
repo-slice pack --entry src/index.ts

# Find all code related to a symbol
repo-slice pack --symbol handleRequest

# Bundle files changed in a git diff
repo-slice pack --from-diff HEAD~3..HEAD

# Parse error logs and bundle relevant code
repo-slice pack --from-log build-errors.txt

# Output as Markdown instead of JSON (default)
repo-slice pack --entry src/app.ts --format md

# Save to file
repo-slice pack --entry src/api.ts --out context.json
```

## Commands

### `repo-slice pack [options]`

Extract a context bundle from the repository.

#### Anchor Options (at least one required)

| Option | Description |
|--------|-------------|
| `--entry <path>` | Add entry file as anchor (repeatable) |
| `--symbol <query>` | Add symbol query as anchor (repeatable) |
| `--from-diff <revRange>` | Use git diff hunks as anchors (e.g., `HEAD~3..HEAD`) |
| `--from-log <path>` | Parse error log file for file:line anchors |

#### Symbol Options

| Option | Description |
|--------|-------------|
| `--symbol-strict` | Fail if any symbol resolves to multiple definitions |

**Symbol query formats:**
- `functionName` - Find by name across all files
- `ClassName.methodName` - Find class method
- `path/to/file.ts:symbolName` - File-hint syntax for disambiguation
- `module.name:SymbolName` - Python module-qualified lookup

#### Workspace Options

| Option | Description |
|--------|-------------|
| `--workspace <name\|path>` | Scope to specific workspace |
| `--all-workspaces` | Include all workspaces |
| `--fallback-all` | Retry across all workspaces if symbol not found |

#### Budget & Depth Options

| Option | Description | Default |
|--------|-------------|---------|
| `--depth <n>` | Import graph traversal depth | `2` |
| `--budget-chars <n>` | Maximum characters in output | `28000` |
| `--budget-tokens <n>` | Maximum tokens (estimated) | - |
| `--include-tests <auto\|true\|false>` | Include test files | `auto` |

#### Output Options

| Option | Description |
|--------|-------------|
| `--format <json\|md>` | Output format (default: json) |
| `--out <path>` | Write to file instead of stdout |
| `--reason` | Include selection reasons in output |
| `--redact` | Redact secrets (API keys, etc.) |
| `--no-timestamp` | Omit timestamp for reproducible output |
| `--debug` | Enable debug logging |
| `--debug-cache` | Use JSON cache format for debugging |

#### Folder Packing Options

Pack entire directories without import parsing:

| Option | Description | Default |
|--------|-------------|---------|
| `--folder <path>` | Pack all files in directory (repeatable) | - |
| `--folder-max-size <mb>` | Max file size in MB | `5` |
| `--folder-include-hidden` | Include hidden files (.*) | skip |
| `--folder-follow-symlinks` | Follow symbolic links | skip |

**Folder Packing Behavior:**
- All files are included as-is (no import graph traversal)
- Binary files include metadata only (path, size, MIME type)
- Files exceeding `--folder-max-size` are listed in omitted section with reason
- Respects `.gitignore` patterns
- Empty directories are explicitly tracked in output

**Example:**
```bash
# Pack documentation folder
repo-slice pack --folder docs/

# Pack assets with 10MB limit and include hidden files
repo-slice pack --folder assets/ --folder-max-size 10 --folder-include-hidden

# Mix entry file with folder
repo-slice pack --entry src/app.ts --folder public/
```

### `repo-slice workspaces [options]`

List detected workspaces in the repository.

```bash
$ repo-slice workspaces
[
  {
    "name": "packages/web",
    "kind": "node",
    "root": "/path/to/repo/packages/web"
  },
  {
    "name": "packages/api",
    "kind": "node",
    "root": "/path/to/repo/packages/api"
  }
]
```

| Option | Description |
|--------|-------------|
| `--format <json\|text>` | Output format (default: json) |

### `repo-slice version`

Print the version number.

## Examples

### Basic Entry File Bundle

```bash
repo-slice pack --entry src/server.ts
```

Produces a bundle containing `src/server.ts` and its imports (up to depth 2).

### Symbol Search with References

```bash
repo-slice pack --symbol handleAuth --reason
```

Finds all definitions of `handleAuth`, their references, and includes reasoning for each file's inclusion.

### Debugging Build Errors

```bash
# Save TypeScript errors to a file
tsc --noEmit 2>&1 | tee errors.txt

# Bundle the relevant code
repo-slice pack --from-log errors.txt --out context.md
```

Supported log formats:
- **TypeScript/tsc**: `src/file.ts:10:5 - error TS2345: ...`
- **Jest/Vitest**: `FAIL src/file.test.ts` or stack traces
- **pytest**: `File "src/file.py", line 10`
- **mypy**: `src/file.py:10: error: ...`
- **pyright**: `src/file.py:10:5 - error: ...`

### Code Review Context

```bash
# Get context for a PR
repo-slice pack --from-diff origin/main..HEAD --reason
```

### Strict Symbol Resolution

```bash
repo-slice pack --symbol Config --symbol-strict
```

If `Config` is defined in multiple files, this will fail with a helpful message:

```
Ambiguous symbol(s) found (--symbol-strict enabled):
  Config:
    - src/config/app.ts:15
    - src/config/db.ts:8
Use file-hint syntax (e.g., path/to/file.ts:SymbolName) to disambiguate.
```

Then disambiguate:

```bash
repo-slice pack --symbol "src/config/app.ts:Config"
```

### JSON Output for Tooling (default)

```bash
repo-slice pack --entry src/api.ts | jq '.items[].filePath'
```

### Monorepo Usage

```bash
# List workspaces
repo-slice workspaces

# Bundle from specific workspace
repo-slice pack --entry packages/web/src/index.ts --workspace packages/web

# Search symbol across all workspaces
repo-slice pack --symbol sharedUtil --all-workspaces
```

## Configuration

Create `.repo-slicerc.json` at your repository root or workspace root:

```json
{
  "budgetChars": 28000,
  "depth": 2,
  "includeTests": "auto",
  "ignore": [
    "**/dist/**",
    "**/build/**",
    "**/*.min.js",
    "**/node_modules/**"
  ],
  "workspaces": {
    "mode": "auto",
    "pythonImportRoots": ["src", "."]
  },
  "redact": {
    "enabled": false,
    "patterns": [
      "(?i)(api[_-]?key|apikey)\\s*[:=]\\s*['\"][^'\"]+['\"]",
      "(?i)(secret|password|token)\\s*[:=]\\s*['\"][^'\"]+['\"]",
      "AKIA[0-9A-Z]{16}",
      "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
    ]
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `budgetChars` | number | `28000` | Default character budget |
| `depth` | number | `2` | Default import traversal depth |
| `includeTests` | string | `"auto"` | Test file inclusion: `auto`, `true`, `false` |
| `ignore` | string[] | See below | Glob patterns to ignore |
| `workspaces.mode` | string | `"auto"` | Workspace detection: `auto`, `all`, or workspace name |
| `workspaces.pythonImportRoots` | string[] | `["src", "."]` | Python import resolution roots |
| `redact.enabled` | boolean | `false` | Enable secret redaction |
| `redact.patterns` | string[] | See above | Regex patterns for redaction |

**Default ignore patterns:**
```json
["**/dist/**", "**/build/**", "**/.next/**", "**/__snapshots__/**"]
```

## Output Formats

### Markdown

```markdown
# repo-slice bundle

- command: repo-slice pack --entry src/index.ts
- scope: nearest (packages/web)
- budget: 15234/28000 chars

## Index
- file src/index.ts (reasons: entry file)
- file src/utils/helpers.ts (reasons: imported by src/index.ts)

## Content
### file src/index.ts (full file)
workspace: packages/web
reasons: entry file

\`\`\`ts
import { helper } from './utils/helpers';
// ... file content
\`\`\`
```

### JSON

```json
{
  "meta": {
    "command": "repo-slice pack --entry src/index.ts",
    "scope": { "mode": "nearest", "workspaces": ["packages/web"] },
    "budget": { "chars": 28000, "usedChars": 15234 }
  },
  "items": [
    {
      "kind": "file",
      "filePath": "src/index.ts",
      "content": "import { helper } from './utils/helpers';...",
      "reasons": ["entry file"]
    }
  ],
  "omitted": []
}
```

## Supported Languages

| Language | Parser | Features |
|----------|--------|----------|
| TypeScript | TypeScript Compiler API | Full import resolution, symbol lookup, references |
| JavaScript | TypeScript Compiler API | Full import resolution, symbol lookup, references |
| Python | tree-sitter | Import resolution, function/class definitions, references |

## How It Works

1. **Anchor Resolution** - Entry files, symbols, diff hunks, or log entries become starting points
2. **Import Graph Traversal** - Follow imports up to `--depth` levels
3. **Candidate Scoring** - Each file/snippet gets a relevance score based on:
   - Anchor type (symbols: 1000, diagnostics: 950, diffs: 850, entries: 800)
   - Distance from anchors (closer = higher score)
   - File size penalty (larger files score lower)
4. **Budget Selection** - Top-ranked candidates selected within budget
5. **Output Generation** - Markdown or JSON bundle with optional reasoning

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime error |
| 2 | Anchor resolution failure (symbol not found, ambiguous symbol in strict mode) |
| 3 | Invalid CLI usage |

## Caching

`repo-slice` caches import graphs and symbol indices in `.repo-slice/cache/` for faster subsequent runs. The cache is automatically invalidated when:
- Files are modified (mtime/size change)
- Configuration changes
- Package version changes

## Limitations

- **Python references**: Uses name-based matching, may include false positives
- **Token budgeting**: Uses `chars / 4` estimate, not a real tokenizer
- **Log parsing**: Limited to TypeScript, Jest, Vitest, pytest, mypy, pyright formats

## Development

```bash
# Run tests
bun test

# Run in development
bun run src/cli.ts pack --entry src/cli.ts

# Build for distribution
bun run build
```

## License

MIT

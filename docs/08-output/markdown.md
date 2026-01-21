# Markdown Format

**File:** `src/output/markdown.ts`

## Purpose

Markdown output is optimized for copy/paste into AI coding assistants and human readability.

## Structure (Current)

The Markdown bundle contains four sections:

1. **Header** - Command, scope, budget, optional note + timestamp
2. **Index** - Table of contents listing included items
3. **Content Blocks** - The actual code snippets and files
4. **Omitted Items** - Items that didn't fit in budget (only with `--reason`)

## Snippet Blocks

Each snippet block includes:

- File path
- Workspace root
- Optional reasons (with `--reason`)
- Fenced code block with language tag

### Example Output

```markdown
## src/services/user.ts

**Workspace:** packages/core
**Reasons:** symbol definition, import distance 1

\`\`\`typescript
export class UserService {
  async create(data: CreateUserInput): Promise<User> {
    // ...
  }
}
\`\`\`
```

## Deterministic Output

Use `--no-timestamp` to omit the `generatedAt` timestamp for byte-for-byte reproducible output:

```bash
repo-slice pack --entry src/index.ts --no-timestamp
```

## Related

- [Output Overview](./overview.md)
- [JSON Format](./json.md)

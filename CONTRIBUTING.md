# Contributing to repo-slice

Thank you for your interest in contributing to repo-slice!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/repo-slice.git
   cd repo-slice
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run tests**
   ```bash
   bun test
   ```

4. **Run in development mode**
   ```bash
   bun run dev pack --entry src/cli.ts
   ```

## Making Changes

### 1. Create a branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-fix
```

### 2. Make your changes

- Write tests for new functionality
- Ensure all tests pass: `bun test`
- Follow the existing code style

### 3. Add a changeset

If your change should trigger a release (new feature, bug fix, etc.):

```bash
bunx changeset
```

This will prompt you to:
1. Select the type of change (patch, minor, major)
2. Write a summary of your changes

The changeset file will be created in `.changeset/`.

**When to add a changeset:**
- Bug fixes (patch)
- New features (minor)
- Breaking changes (major)

**When NOT to add a changeset:**
- Documentation-only changes
- Internal refactoring with no user-facing changes
- Test-only changes

### 4. Submit a Pull Request

1. Push your branch to GitHub
2. Open a Pull Request against `main`
3. Fill out the PR template
4. Wait for CI checks to pass
5. Request review

## Release Process

Releases are automated using [Changesets](https://github.com/changesets/changesets):

1. When PRs with changesets are merged to `main`, a "Version Packages" PR is automatically created/updated
2. This PR accumulates all pending changesets and updates the version
3. When the "Version Packages" PR is merged:
   - The package is published to npm
   - A GitHub Release is created
   - Release notes are auto-generated

## Code Style

- Use TypeScript
- Prefer `async/await` over raw promises
- Keep functions small and focused
- Write descriptive variable and function names
- Add JSDoc comments for public APIs

## Testing

- **Unit tests**: Test individual functions in isolation
- **E2E tests**: Test the CLI as a whole

Run specific test files:
```bash
bun test test/budget.test.ts
bun test test/e2e.test.ts
```

## Project Structure

```
src/
├── cli.ts              # Entry point
├── commands/           # CLI commands
├── adapters/           # Language-specific analyzers
│   ├── ts/            # TypeScript adapter
│   └── python/        # Python adapter
├── anchors/           # Anchor resolution (entry, symbol, diff, log)
├── engine/            # Core selection algorithm
├── output/            # Output formatters
├── workspaces/        # Workspace detection
├── cache/             # Build caching
└── utils/             # Shared utilities

test/
├── *.test.ts          # Unit tests
└── e2e.test.ts        # End-to-end tests
```

## Questions?

Open an issue on GitHub if you have questions or run into problems.

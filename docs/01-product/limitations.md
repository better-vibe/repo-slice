# Limitations

## Purpose

This document describes current limitations of repo-slice and planned improvements.

## Current Limitations

| Area | Limitation |
|------|------------|
| Python references | Name-based matching, may include false positives |
| Token budgeting | Estimate only (`chars / 4`), not a real tokenizer |
| Log parsing | Limited to TypeScript-style and pytest-style formats |
| Symbol ambiguity | Resolved by top match, no strict mode yet |
| Redaction | Pattern-based, does not preserve exact line lengths |

## Planned Improvements

- Semantic Python reference resolution
- Real token counting with a tokenizer
- Additional log format parsers (jest, vitest, mypy, pyright)
- Strict symbol matching and better disambiguation

## Related

- [Roadmap](./roadmap.md) - Full list of planned features
- [Overview](./overview.md) - What repo-slice does

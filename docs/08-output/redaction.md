# Redaction

**File:** `src/redact.ts`

## Purpose

Redaction replaces sensitive values in output content with `[REDACTED]` to prevent accidental exposure of secrets.

## Current Behavior

- Enabled via `--redact` flag or config `redact.enabled`
- Applies regex patterns from config `redact.patterns`
- If a pattern is not a valid regex, it falls back to a literal match
- Redaction is applied after selection, before rendering

## Default Patterns

| Pattern | Matches |
|---------|---------|
| `BEGIN PRIVATE KEY` | PEM private keys |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `API_KEY=` | Generic API keys |
| `SECRET_KEY=` | Generic secrets |

## Configuration

```json
{
  "redact": {
    "enabled": true,
    "patterns": [
      "BEGIN PRIVATE KEY",
      "password\\s*=\\s*[\"'][^\"']+[\"']"
    ]
  }
}
```

## Planned

- Preserve line lengths when possible
- Expand default pattern set for common secrets

## Related

- [Output Overview](./overview.md)
- [Configuration](../07-configuration/overview.md)
- [CLI Options](../06-cli/options.md)

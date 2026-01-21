export function redactContent(text: string, patterns: string[]): string {
  let result = text;
  for (const pattern of patterns) {
    const regex = toRegex(pattern);
    result = result.replace(regex, "[REDACTED]");
  }
  return result;
}

function toRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "g");
  } catch {
    return new RegExp(escapeRegExp(pattern), "g");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

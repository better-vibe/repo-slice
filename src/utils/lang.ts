import type { Language } from "../adapters/types.js";

export function languageFromPath(path: string): Language {
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "py";
  return "ts";
}

import { readText } from "./fs.js";

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function extractSnippetFromText(
  text: string,
  range: { startLine: number; endLine: number }
): string {
  const lines = splitLines(text);
  const start = Math.max(1, range.startLine);
  const end = Math.min(lines.length, range.endLine);
  return lines.slice(start - 1, end).join("\n");
}

export async function extractSnippet(
  filePath: string,
  range: { startLine: number; endLine: number }
): Promise<string> {
  const text = await readText(filePath);
  return extractSnippetFromText(text, range);
}

import type { BundleItem, BundleMeta, OmittedItem } from "../engine/types.js";
import { toPosixPath } from "../utils/path.js";
import { relative } from "node:path";

export function renderMarkdownBundle(options: {
  meta: BundleMeta;
  items: BundleItem[];
  omitted: OmittedItem[];
  includeReasons: boolean;
}): string {
  const { meta, items, omitted, includeReasons } = options;
  const lines: string[] = [];

  lines.push("# repo-slice bundle");
  lines.push("");
  lines.push(`- command: ${meta.command}`);
  lines.push(`- scope: ${meta.scope.mode} (${meta.scope.workspaces.join(", ")})`);
  lines.push(`- budget: ${meta.budget.usedChars}/${meta.budget.chars} chars`);
  if (meta.budget.tokens !== undefined && meta.budget.usedTokens !== undefined) {
    lines.push(`- tokens: ${meta.budget.usedTokens}/${meta.budget.tokens}`);
  }
  if (meta.note) {
    lines.push(`- note: ${meta.note}`);
  }
  if (meta.generatedAt) {
    lines.push(`- generatedAt: ${meta.generatedAt}`);
  }
  lines.push("");

  lines.push("## Index");
  if (items.length === 0) {
    lines.push("- (empty)");
  } else {
    for (const item of items) {
      const path = formatPath(meta.repoRoot, item.filePath);
      const range =
        item.kind === "snippet" && item.range
          ? `:${item.range.startLine}-${item.range.endLine}`
          : "";
      const reasonText =
        includeReasons && item.reasons.length
          ? ` (reasons: ${item.reasons.join(", ")})`
          : "";
      lines.push(`- ${item.kind} ${path}${range}${reasonText}`);
    }
  }
  lines.push("");

  lines.push("## Content");
  for (const item of items) {
    const path = formatPath(meta.repoRoot, item.filePath);
    const range =
      item.kind === "snippet" && item.range
        ? `lines ${item.range.startLine}-${item.range.endLine}`
        : "full file";
    lines.push(`### ${item.kind} ${path} (${range})`);
    lines.push(`workspace: ${formatPath(meta.repoRoot, item.workspaceRoot)}`);
    if (includeReasons && item.reasons.length) {
      lines.push(`reasons: ${item.reasons.join(", ")}`);
    }
    lines.push("");
    lines.push(`\`\`\`${languageTag(item.filePath)}`);
    lines.push(item.content);
    lines.push("```");
    lines.push("");
  }

  if (includeReasons && omitted.length > 0) {
    lines.push("## Omitted (budget)");
    for (const item of omitted) {
      const path = formatPath(meta.repoRoot, item.filePath);
      const range =
        item.kind === "snippet" && item.range
          ? `:${item.range.startLine}-${item.range.endLine}`
          : "";
      lines.push(
        `- ${item.kind} ${path}${range} (score ${item.score}, est ${item.estimatedChars} chars) - ${item.reason}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatPath(repoRoot: string, filePath: string): string {
  return toPosixPath(relative(repoRoot, filePath)) || ".";
}

function languageTag(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".ts")) return "ts";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".js")) return "js";
  if (lower.endsWith(".py")) return "py";
  return "text";
}

import { extractSnippet } from "../utils/snippet.js";
import { readText } from "../utils/fs.js";
import type { BundleItem, Candidate, OmittedItem } from "./types.js";

export interface BudgetSelectionResult {
  items: BundleItem[];
  omitted: OmittedItem[];
  usedChars: number;
  usedTokens?: number;
}

export async function selectCandidatesWithBudget(options: {
  candidates: Candidate[];
  budgetChars: number;
  budgetTokens?: number;
}): Promise<BudgetSelectionResult> {
  const { candidates, budgetChars, budgetTokens } = options;
  const items: BundleItem[] = [];
  const omitted: OmittedItem[] = [];
  let usedChars = 0;
  let usedTokens = 0;

  for (const candidate of candidates) {
    let content = "";
    try {
      content =
        candidate.kind === "file"
          ? await readText(candidate.filePath)
          : candidate.range
            ? await extractSnippet(candidate.filePath, candidate.range)
            : "";
    } catch {
      omitted.push({
        id: candidate.id,
        filePath: candidate.filePath,
        kind: candidate.kind,
        range: candidate.range,
        reason: `${candidate.reasons.join("; ")}; failed to read file`,
        score: candidate.score,
        estimatedChars: candidate.estimatedChars,
      });
      continue;
    }
    const length = content.length;
    const tokenEstimate = Math.ceil(length / 4);
    const exceedsChars = usedChars + length > budgetChars;
    const exceedsTokens =
      budgetTokens !== undefined && usedTokens + tokenEstimate > budgetTokens;
    if (exceedsChars || exceedsTokens) {
      omitted.push({
        id: candidate.id,
        filePath: candidate.filePath,
        kind: candidate.kind,
        range: candidate.range,
        reason: candidate.reasons.join("; "),
        score: candidate.score,
        estimatedChars: candidate.estimatedChars,
      });
      continue;
    }

    items.push({
      kind: candidate.kind,
      lang: candidate.lang,
      workspaceRoot: candidate.workspaceRoot,
      filePath: candidate.filePath,
      range: candidate.range,
      reasons: candidate.reasons,
      content,
    });
    usedChars += length;
    usedTokens += tokenEstimate;
  }

  return {
    items,
    omitted,
    usedChars,
    usedTokens: budgetTokens !== undefined ? usedTokens : undefined,
  };
}

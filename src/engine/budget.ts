import { extractSnippet, extractSnippetFromText } from "../utils/snippet.js";
import { readText } from "../utils/fs.js";
import type { BundleItem, Candidate, OmittedItem } from "./types.js";

export interface BudgetSelectionResult {
  items: BundleItem[];
  omitted: OmittedItem[];
  usedChars: number;
  usedTokens?: number;
}

// OPTIMIZATION: Maximum concurrent file reads to prevent memory pressure
const MAX_CONCURRENT_READS = 10;

// Helper to process items in batches with limited concurrency
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => processor(item))
    );
    results.push(...batchResults);
  }
  return results;
}

// Result type for content reading
type ContentResult =
  | { success: true; content: string; length: number; tokenEstimate: number }
  | { success: false; error: string };

async function readCandidateContent(candidate: Candidate): Promise<ContentResult> {
  try {
    let content = "";
    if (candidate.kind === "file") {
      content = await readText(candidate.filePath);
    } else if (candidate.range) {
      content = await extractSnippet(candidate.filePath, candidate.range);
    }
    const length = content.length;
    const tokenEstimate = Math.ceil(length / 4);
    return { success: true, content, length, tokenEstimate };
  } catch {
    return { success: false, error: "failed to read file" };
  }
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

  // OPTIMIZATION: First pass - read all file contents in parallel batches
  // This is the main bottleneck - file I/O is slow and was sequential
  const contentResults = await processInBatches(
    candidates,
    MAX_CONCURRENT_READS,
    readCandidateContent
  );

  // Second pass - process budget constraints (must be sequential for budget tracking)
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const result = contentResults[i];

    if (!result.success) {
      omitted.push({
        id: candidate.id,
        filePath: candidate.filePath,
        kind: candidate.kind,
        range: candidate.range,
        reason: `${candidate.reasons.join("; ")}; ${result.error}`,
        score: candidate.score,
        estimatedChars: candidate.estimatedChars,
      });
      continue;
    }

    const { content, length, tokenEstimate } = result;
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

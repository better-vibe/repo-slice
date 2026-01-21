import { stat } from "node:fs/promises";
import type { Candidate } from "./types.js";

export async function estimateFileChars(filePath: string): Promise<number> {
  try {
    const info = await stat(filePath);
    return info.size;
  } catch {
    return 0;
  }
}

export function estimateSnippetChars(range: { startLine: number; endLine: number }): number {
  const lines = Math.max(1, range.endLine - range.startLine + 1);
  return lines * 80;
}

export function candidateId(candidate: Candidate): string {
  if (candidate.kind === "snippet" && candidate.range) {
    return `${candidate.filePath}:${candidate.range.startLine}-${candidate.range.endLine}`;
  }
  return `${candidate.filePath}:file`;
}

export function addCandidate(
  map: Map<string, Candidate>,
  candidate: Candidate
): void {
  const id = candidateId(candidate);
  const existing = map.get(id);
  if (!existing) {
    map.set(id, { ...candidate, id });
    return;
  }
  existing.score = Math.max(existing.score, candidate.score);
  existing.reasons = Array.from(new Set([...existing.reasons, ...candidate.reasons]));
  existing.anchor = existing.anchor || candidate.anchor;
}

export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.kind !== b.kind) return a.kind === "snippet" ? -1 : 1;
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
    if (a.range && b.range) return a.range.startLine - b.range.startLine;
    if (a.range) return -1;
    if (b.range) return 1;
    return 0;
  });
}

export function applySizePenalty(candidate: Candidate): Candidate {
  const penalty = Math.min(200, Math.floor(candidate.estimatedChars / 1000) * 10);
  return {
    ...candidate,
    score: candidate.score - penalty,
  };
}

import type { Language, Range } from "../adapters/types.js";

export type CandidateKind = "file" | "snippet";

export interface Candidate {
  id: string;
  kind: CandidateKind;
  lang: Language;
  workspaceId: string;
  workspaceRoot: string;
  filePath: string;
  range?: Range;
  score: number;
  reasons: string[];
  estimatedChars: number;
  anchor?: boolean;
}

export interface BundleItem {
  kind: CandidateKind;
  lang: Language;
  workspaceRoot: string;
  filePath: string;
  range?: Range;
  reasons: string[];
  content: string;
}

export interface OmittedItem {
  id: string;
  filePath: string;
  kind: CandidateKind;
  range?: Range;
  reason: string;
  score: number;
  estimatedChars: number;
}

export interface BundleMeta {
  repoRoot: string;
  generatedAt?: string;
  command: string;
  scope: { mode: string; workspaces: string[] };
  budget: { chars: number; usedChars: number; tokens?: number; usedTokens?: number };
  note?: string;
}

export interface BundleResult {
  meta: BundleMeta;
  items: BundleItem[];
  omitted: OmittedItem[];
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import type { Range } from "../adapters/types.js";
import { normalizePath } from "../utils/path.js";

const execFileAsync = promisify(execFile);

export interface DiffHunk {
  filePath: string;
  range: Range;
}

export async function getDiffHunks(
  repoRoot: string,
  revRange: string
): Promise<DiffHunk[]> {
  const { stdout } = await execFileAsync("git", ["diff", revRange, "-U3", "--no-color"], {
    cwd: repoRoot,
  });
  return parseDiff(stdout, repoRoot);
}

export function parseDiff(diffText: string, repoRoot: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentFile: string | null = null;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("+++ ")) {
      const path = line.replace("+++ ", "").trim();
      if (path === "/dev/null") {
        currentFile = null;
        continue;
      }
      const cleaned = path.startsWith("b/") ? path.slice(2) : path;
      currentFile = normalizePath(join(repoRoot, cleaned));
      continue;
    }
    if (line.startsWith("@@") && currentFile) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (!match) continue;
      const start = Number(match[1]);
      const length = match[2] ? Number(match[2]) : 1;
      const end = length === 0 ? start : start + length - 1;
      hunks.push({
        filePath: currentFile,
        range: { startLine: start, endLine: end },
      });
    }
  }
  return hunks;
}

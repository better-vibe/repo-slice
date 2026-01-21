import { dirname, join } from "node:path";
import { fileExists } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";

export async function detectRepoRoot(cwd: string): Promise<string> {
  let current = normalizePath(cwd);
  while (true) {
    if (await fileExists(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return normalizePath(cwd);
    }
    current = parent;
  }
}

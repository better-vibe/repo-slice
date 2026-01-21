import { basename, join } from "node:path";
import fg from "fast-glob";
import { fileExists } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";
import type { Workspace } from "./types.js";

const MARKERS = ["pyproject.toml", "requirements.txt"];
const DEFAULT_PATTERNS = ["apps/*", "packages/*", "services/*"];

export async function detectPythonWorkspaces(
  repoRoot: string,
  patterns: string[] = DEFAULT_PATTERNS
): Promise<Workspace[]> {
  const root = normalizePath(repoRoot);
  const workspaces = new Map<string, Workspace>();

  for (const marker of MARKERS) {
    if (await fileExists(join(root, marker))) {
      workspaces.set(root, {
        id: ".",
        name: basename(root),
        root,
        kind: "python",
      });
      break;
    }
  }

  const matches = await fg(patterns, {
    cwd: root,
    onlyDirectories: true,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });

  for (const dir of matches.sort()) {
    for (const marker of MARKERS) {
      if (await fileExists(join(dir, marker))) {
        const normalized = normalizePath(dir);
        workspaces.set(normalized, {
          id: ".",
          name: basename(dir),
          root: normalized,
          kind: "python",
        });
        break;
      }
    }
  }

  return Array.from(workspaces.values());
}

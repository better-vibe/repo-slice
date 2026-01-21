import { join, relative } from "node:path";
import ignore from "ignore";
import { fileExists, readText } from "./utils/fs.js";
import { toPosixPath } from "./utils/path.js";

export interface IgnoreMatcher {
  ignores: (absolutePath: string) => boolean;
}

export async function createIgnoreMatcher(options: {
  repoRoot: string;
  workspaceRoot?: string;
  extraIgnorePatterns?: string[];
}): Promise<IgnoreMatcher> {
  const ig = ignore();
  ig.add("node_modules/");
  if (options.extraIgnorePatterns?.length) {
    ig.add(options.extraIgnorePatterns);
  }

  await addIgnoreFile(ig, join(options.repoRoot, ".gitignore"));
  await addIgnoreFile(ig, join(options.repoRoot, ".repo-sliceignore"));
  if (options.workspaceRoot && options.workspaceRoot !== options.repoRoot) {
    await addIgnoreFile(ig, join(options.workspaceRoot, ".gitignore"));
    await addIgnoreFile(ig, join(options.workspaceRoot, ".repo-sliceignore"));
  }

  return {
    ignores: (absolutePath: string) => {
      const rel = toPosixPath(relative(options.repoRoot, absolutePath));
      return ig.ignores(rel);
    },
  };
}

async function addIgnoreFile(ig: ignore.Ignore, path: string): Promise<void> {
  if (!(await fileExists(path))) return;
  const contents = await readText(path);
  ig.add(contents.split(/\r?\n/));
}

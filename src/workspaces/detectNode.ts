import { basename, join } from "node:path";
import fg from "fast-glob";
import YAML from "yaml";
import { readFile } from "node:fs/promises";
import { fileExists, readJson } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";
import type { Workspace } from "./types.js";

interface PnpmWorkspace {
  packages?: string[];
}

interface RootPackageJson {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
}

export async function detectNodeWorkspaces(repoRoot: string): Promise<Workspace[]> {
  const root = normalizePath(repoRoot);
  const workspaces = new Map<string, Workspace>();
  const rootPkgPath = join(root, "package.json");
  const patterns: string[] = [];
  let rootPkg: RootPackageJson | undefined;

  if (await fileExists(rootPkgPath)) {
    rootPkg = await readJson<RootPackageJson>(rootPkgPath);
    if (rootPkg.workspaces) {
      if (Array.isArray(rootPkg.workspaces)) {
        patterns.push(...rootPkg.workspaces);
      } else if (Array.isArray(rootPkg.workspaces.packages)) {
        patterns.push(...rootPkg.workspaces.packages);
      }
    }
    workspaces.set(root, {
      id: ".",
      name: rootPkg.name ?? basename(root),
      root,
      kind: "node",
    });
  }

  const pnpmPath = join(root, "pnpm-workspace.yaml");
  if (await fileExists(pnpmPath)) {
    const raw = await readFile(pnpmPath, "utf8");
    const doc = YAML.parse(raw) as PnpmWorkspace;
    if (Array.isArray(doc?.packages)) {
      patterns.push(...doc.packages);
    }
  }

  if (patterns.length === 0) {
    return Array.from(workspaces.values());
  }

  const matches = await fg(patterns, {
    cwd: root,
    onlyDirectories: true,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });

  for (const dir of matches.sort()) {
    const pkgPath = join(dir, "package.json");
    if (!(await fileExists(pkgPath))) continue;
    const pkg = await readJson<RootPackageJson>(pkgPath);
    const workspace: Workspace = {
      id: ".",
      name: pkg.name ?? basename(dir),
      root: normalizePath(dir),
      kind: "node",
    };
    workspaces.set(workspace.root, workspace);
  }

  return Array.from(workspaces.values());
}

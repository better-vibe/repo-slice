import { basename, resolve } from "node:path";
import type { Workspace } from "./types.js";
import { isPathInside, normalizePath } from "../utils/path.js";
import { fileExists } from "../utils/fs.js";

export interface WorkspaceScope {
  mode: "nearest" | "all" | "explicit";
  workspaces: Workspace[];
  note?: string;
}

export async function resolveWorkspaceScope(options: {
  workspaces: Workspace[];
  cwd: string;
  workspaceFlag?: string;
  allWorkspaces?: boolean;
}): Promise<WorkspaceScope> {
  const { workspaces, cwd, workspaceFlag, allWorkspaces } = options;
  if (allWorkspaces) {
    return { mode: "all", workspaces };
  }

  if (!workspaceFlag || workspaceFlag === "auto") {
    const nearest = findNearestWorkspace(workspaces, cwd);
    if (nearest) {
      return { mode: "nearest", workspaces: [nearest] };
    }
    const fallback = workspaces[0];
    if (fallback) {
      return {
        mode: "nearest",
        workspaces: [fallback],
        note: "No workspace contains cwd; falling back to first workspace",
      };
    }
    return { mode: "nearest", workspaces: [] };
  }

  const byName = workspaces.find((ws) => ws.name === workspaceFlag);
  if (byName) {
    return { mode: "explicit", workspaces: [byName] };
  }

  const resolved = normalizePath(resolve(cwd, workspaceFlag));
  if (await fileExists(resolved)) {
    const match = findWorkspaceForPath(workspaces, resolved);
    if (match) {
      return { mode: "explicit", workspaces: [match] };
    }
  }

  throw new Error(`Workspace not found: ${workspaceFlag}`);
}

export function findNearestWorkspace(
  workspaces: Workspace[],
  cwd: string
): Workspace | undefined {
  const normalized = normalizePath(cwd);
  let best: Workspace | undefined;
  for (const ws of workspaces) {
    if (isPathInside(normalized, ws.root)) {
      if (!best || ws.root.length > best.root.length) {
        best = ws;
      }
    }
  }
  return best;
}

export function findWorkspaceForPath(
  workspaces: Workspace[],
  path: string
): Workspace | undefined {
  const normalized = normalizePath(path);
  let best: Workspace | undefined;
  for (const ws of workspaces) {
    if (isPathInside(normalized, ws.root)) {
      if (!best || ws.root.length > best.root.length) {
        best = ws;
      }
    }
  }
  return best;
}

export function workspaceDisplayName(workspace: Workspace): string {
  return workspace.name || basename(workspace.root);
}

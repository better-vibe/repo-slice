import { basename, relative } from "node:path";
import { detectNodeWorkspaces } from "./detectNode.js";
import { detectPythonWorkspaces } from "./detectPython.js";
import type { Workspace, WorkspaceKind } from "./types.js";
import { normalizePath, toPosixPath } from "../utils/path.js";

export async function detectWorkspaces(repoRoot: string): Promise<Workspace[]> {
  const root = normalizePath(repoRoot);
  const nodeWorkspaces = await detectNodeWorkspaces(root);
  const pythonWorkspaces = await detectPythonWorkspaces(root);
  const merged = new Map<string, Workspace>();

  const upsert = (workspace: Workspace, kind: WorkspaceKind): void => {
    const existing = merged.get(workspace.root);
    if (!existing) {
      merged.set(workspace.root, {
        ...workspace,
        kind,
      });
      return;
    }
    if (existing.kind !== kind) {
      existing.kind = "mixed";
    }
  };

  for (const ws of nodeWorkspaces) {
    upsert(ws, "node");
  }
  for (const ws of pythonWorkspaces) {
    upsert(ws, "python");
  }

  const list = Array.from(merged.values()).map((ws) => {
    const rel = relative(root, ws.root);
    const id = rel === "" ? "." : toPosixPath(rel);
    return {
      ...ws,
      id,
      name: ws.name || basename(ws.root),
    };
  });

  return list.sort((a, b) => a.root.localeCompare(b.root));
}

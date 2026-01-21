import { detectRepoRoot } from "../workspaces/repoRoot.js";
import { detectWorkspaces } from "../workspaces/detectWorkspaces.js";

export async function workspacesCommand(_args: string[]): Promise<void> {
  const repoRoot = await detectRepoRoot(process.cwd());
  const workspaces = await detectWorkspaces(repoRoot);
  const lines = workspaces
    .slice()
    .sort((a, b) => a.root.localeCompare(b.root))
    .map((ws) => `${ws.name}\t${ws.kind}\t${ws.root}`);
  process.stdout.write(lines.join("\n") + (lines.length ? "\n" : ""));
}

export type WorkspaceKind = "node" | "python" | "mixed";

export interface Workspace {
  id: string;
  name: string;
  root: string;
  kind: WorkspaceKind;
}

import { relative, resolve, sep } from "node:path";

export function normalizePath(input: string): string {
  return resolve(input);
}

export function toPosixPath(input: string): string {
  return input.split(sep).join("/");
}

export function isPathInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("../") && !rel.startsWith("..\\"));
}

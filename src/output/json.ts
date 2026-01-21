import type { BundleItem, BundleMeta, OmittedItem } from "../engine/types.js";
import { toPosixPath } from "../utils/path.js";
import { relative } from "node:path";

export function renderJsonBundle(options: {
  meta: BundleMeta;
  items: BundleItem[];
  omitted: OmittedItem[];
}): string {
  const { meta, items, omitted } = options;
  const payload = {
    meta: {
      ...meta,
      scope: {
        ...meta.scope,
        workspaces: meta.scope.workspaces.map((ws) => ws),
      },
    },
    items: items.map((item) => ({
      kind: item.kind,
      lang: item.lang,
      workspaceRoot: formatPath(meta.repoRoot, item.workspaceRoot),
      filePath: formatPath(meta.repoRoot, item.filePath),
      range: item.range,
      reasons: item.reasons,
      content: item.content,
    })),
    omitted: omitted.map((item) => ({
      filePath: formatPath(meta.repoRoot, item.filePath),
      kind: item.kind,
      range: item.range,
      reason: item.reason,
      score: item.score,
      estimatedChars: item.estimatedChars,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

function formatPath(repoRoot: string, filePath: string): string {
  return toPosixPath(relative(repoRoot, filePath)) || ".";
}

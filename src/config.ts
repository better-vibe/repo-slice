import { join } from "node:path";
import { fileExists, readJson } from "./utils/fs.js";

export type IncludeTestsMode = "auto" | "true" | "false";

export interface RepoSliceConfig {
  budgetChars: number;
  depth: number;
  includeTests: IncludeTestsMode;
  ignore: string[];
  workspaces: {
    mode: "auto" | "all";
    pythonImportRoots: string[];
  };
  redact: {
    enabled: boolean;
    patterns: string[];
  };
}

export const defaultConfig: RepoSliceConfig = {
  budgetChars: 28000,
  depth: 2,
  includeTests: "auto",
  ignore: ["**/dist/**", "**/.next/**", "**/build/**", "**/*.snap"],
  workspaces: {
    mode: "auto",
    pythonImportRoots: ["src", "."],
  },
  redact: {
    enabled: false,
    patterns: [
      "BEGIN PRIVATE KEY",
      "AWS_SECRET_ACCESS_KEY",
      "API_KEY=",
      "SECRET_KEY=",
    ],
  },
};

export interface ConfigSources {
  repoConfigPath?: string;
  workspaceConfigPath?: string;
}

export async function loadConfig(
  repoRoot: string,
  workspaceRoot?: string
): Promise<{ config: RepoSliceConfig; sources: ConfigSources }> {
  const repoConfigPath = join(repoRoot, ".repo-slicerc.json");
  const workspaceConfigPath = workspaceRoot
    ? join(workspaceRoot, ".repo-slicerc.json")
    : undefined;

  const repoConfig = (await readConfigFile(repoConfigPath)) ?? {};
  const workspaceConfig =
    workspaceConfigPath && workspaceConfigPath !== repoConfigPath
      ? (await readConfigFile(workspaceConfigPath)) ?? {}
      : {};

  const merged = mergeConfig(mergeConfig(defaultConfig, repoConfig), workspaceConfig);
  return {
    config: merged,
    sources: {
      repoConfigPath: (await fileExists(repoConfigPath)) ? repoConfigPath : undefined,
      workspaceConfigPath:
        workspaceConfigPath && (await fileExists(workspaceConfigPath))
          ? workspaceConfigPath
          : undefined,
    },
  };
}

function mergeConfig(
  base: RepoSliceConfig,
  override: Partial<RepoSliceConfig>
): RepoSliceConfig {
  return {
    ...base,
    ...override,
    ignore: override.ignore ?? base.ignore,
    includeTests: override.includeTests ?? base.includeTests,
    workspaces: {
      ...base.workspaces,
      ...override.workspaces,
      pythonImportRoots:
        override.workspaces?.pythonImportRoots ?? base.workspaces.pythonImportRoots,
    },
    redact: {
      ...base.redact,
      ...override.redact,
      patterns: override.redact?.patterns ?? base.redact.patterns,
    },
  };
}

async function readConfigFile(
  path: string
): Promise<Partial<RepoSliceConfig> | undefined> {
  if (!(await fileExists(path))) {
    return undefined;
  }
  try {
    return await readJson<Partial<RepoSliceConfig>>(path);
  } catch (error) {
    throw new Error(`Failed to parse config: ${path}`);
  }
}

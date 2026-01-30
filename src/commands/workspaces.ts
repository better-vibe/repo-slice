import { detectRepoRoot } from "../workspaces/repoRoot.js";
import { detectWorkspaces } from "../workspaces/detectWorkspaces.js";

export type WorkspacesOutputFormat = "json" | "text";

export interface WorkspacesCliArgs {
  format?: WorkspacesOutputFormat;
}

export async function workspacesCommand(argv: string[]): Promise<void> {
  const args = parseWorkspacesArgs(argv);
  const format = args.format ?? "json";

  const repoRoot = await detectRepoRoot(process.cwd());
  const workspaces = await detectWorkspaces(repoRoot);

  if (format === "json") {
    const output = workspaces
      .slice()
      .sort((a, b) => a.root.localeCompare(b.root))
      .map((ws) => ({
        name: ws.name,
        kind: ws.kind,
        root: ws.root,
      }));
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    const lines = workspaces
      .slice()
      .sort((a, b) => a.root.localeCompare(b.root))
      .map((ws) => `${ws.name}\t${ws.kind}\t${ws.root}`);
    process.stdout.write(lines.join("\n") + (lines.length ? "\n" : ""));
  }
}

function parseWorkspacesArgs(argv: string[]): WorkspacesCliArgs {
  const args: WorkspacesCliArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === "--help" || current === "-h") {
      process.stdout.write(renderWorkspacesHelp());
      process.exit(0);
    }

    if (!current.startsWith("--")) {
      throw new Error(`Unexpected argument: ${current}`);
    }

    const [flag, inlineValue] = current.split("=", 2);

    switch (flag) {
      case "--format": {
        const format = (inlineValue ?? argv[i + 1]) as WorkspacesOutputFormat;
        if (!inlineValue) i += 1;
        if (!["json", "text"].includes(format)) {
          throw new Error(`Invalid format: ${format}`);
        }
        args.format = format;
        break;
      }
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return args;
}

function renderWorkspacesHelp(): string {
  return `repo-slice workspaces - list detected workspaces

Usage:
  repo-slice workspaces [options]

Options:
  --format <json|text>    Output format (default: json)
  --help, -h              Show this help message

Exit codes:
  0 success
  1 runtime error
  3 invalid CLI usage
`;
}

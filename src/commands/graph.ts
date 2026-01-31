import { runGraph } from "../graph/runGraph.js";
import type {
  GraphCliArgs,
  GraphType,
  CollapseMode,
  GraphOutputFormat,
  IncludeTestsMode,
} from "../graph/types.js";

export async function graphCommand(argv: string[]): Promise<void> {
  let parsed: ParsedGraphArgs;
  try {
    parsed = parseGraphArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.stderr.write(renderGraphHelp() + "\n");
    process.exit(3);
    return;
  }
  if (parsed.help) {
    process.stdout.write(renderGraphHelp() + "\n");
    process.exit(0);
  }

  const { args } = parsed;
  if (
    args.entries.length === 0 &&
    args.symbols.length === 0 &&
    !args.fromDiff &&
    !args.fromLog
  ) {
    process.stderr.write("Error: No anchors specified.\n");
    process.stderr.write("Use --entry, --symbol, --from-diff, or --from-log to specify what to include.\n\n");
    process.stderr.write(renderGraphHelp() + "\n");
    process.exit(3);
    return;
  }

  await runGraph(args);
}

interface ParsedGraphArgs {
  help: boolean;
  args: GraphCliArgs;
}

function parseGraphArgs(argv: string[]): ParsedGraphArgs {
  const args: GraphCliArgs = {
    entries: [],
    symbols: [],
    graphType: "imports",
    depth: 2,
    maxNodes: 500,
    maxEdges: 2000,
    collapse: "external",
    format: "json",
  };
  let help = false;

  const takeValue = (index: number, flag: string): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--help" || current === "-h") {
      help = true;
      continue;
    }
    if (!current.startsWith("--")) {
      throw new Error(`Unexpected argument: ${current}`);
    }
    const [flag, inlineValue] = current.split("=", 2);
    switch (flag) {
      case "--entry":
        args.entries.push(inlineValue ?? takeValue(i, flag));
        if (!inlineValue) i += 1;
        break;
      case "--symbol":
        args.symbols.push(inlineValue ?? takeValue(i, flag));
        if (!inlineValue) i += 1;
        break;
      case "--symbol-strict":
        args.symbolStrict = true;
        break;
      case "--from-diff":
        args.fromDiff = inlineValue ?? takeValue(i, flag);
        if (!inlineValue) i += 1;
        break;
      case "--from-log":
        args.fromLog = inlineValue ?? takeValue(i, flag);
        if (!inlineValue) i += 1;
        break;
      case "--workspace":
        args.workspace = inlineValue ?? takeValue(i, flag);
        if (!inlineValue) i += 1;
        break;
      case "--all-workspaces":
        args.allWorkspaces = true;
        break;
      case "--fallback-all":
        args.fallbackAll = true;
        break;
      case "--graph-type": {
        const graphType = (inlineValue ?? takeValue(i, flag)) as GraphType;
        if (!inlineValue) i += 1;
        if (!["imports", "calls", "combined"].includes(graphType)) {
          throw new Error(`Invalid graph-type: ${graphType}`);
        }
        args.graphType = graphType;
        break;
      }
      case "--depth":
        args.depth = parseNumber(inlineValue ?? takeValue(i, flag), flag);
        if (!inlineValue) i += 1;
        break;
      case "--scope": {
        const scope = (inlineValue ?? takeValue(i, flag)) as "symbol" | "file" | "workspace";
        if (!inlineValue) i += 1;
        if (!["symbol", "file", "workspace"].includes(scope)) {
          throw new Error(`Invalid scope: ${scope}`);
        }
        args.scope = scope;
        break;
      }
      case "--include-tests": {
        const mode = (inlineValue ?? takeValue(i, flag)) as IncludeTestsMode;
        if (!inlineValue) i += 1;
        if (!["auto", "true", "false"].includes(mode)) {
          throw new Error(`Invalid include-tests value: ${mode}`);
        }
        args.includeTests = mode;
        break;
      }
      case "--include-external":
        args.includeExternal = true;
        break;
      case "--max-nodes":
        args.maxNodes = parseNumber(inlineValue ?? takeValue(i, flag), flag);
        if (!inlineValue) i += 1;
        break;
      case "--max-edges":
        args.maxEdges = parseNumber(inlineValue ?? takeValue(i, flag), flag);
        if (!inlineValue) i += 1;
        break;
      case "--collapse": {
        const collapse = (inlineValue ?? takeValue(i, flag)) as CollapseMode;
        if (!inlineValue) i += 1;
        if (!["none", "external", "file", "class"].includes(collapse)) {
          throw new Error(`Invalid collapse mode: ${collapse}`);
        }
        args.collapse = collapse;
        break;
      }
      case "--python-engine": {
        const engine = (inlineValue ?? takeValue(i, flag)) as "treesitter" | "pyright";
        if (!inlineValue) i += 1;
        if (!["treesitter", "pyright"].includes(engine)) {
          throw new Error(`Invalid python-engine: ${engine}`);
        }
        args.pythonEngine = engine;
        break;
      }
      case "--format": {
        const format = (inlineValue ?? takeValue(i, flag)) as GraphOutputFormat;
        if (!inlineValue) i += 1;
        if (!["json", "dot"].includes(format)) {
          throw new Error(`Invalid format: ${format}`);
        }
        args.format = format;
        break;
      }
      case "--out":
        args.out = inlineValue ?? takeValue(i, flag);
        if (!inlineValue) i += 1;
        break;
      case "--debug":
        args.debug = true;
        break;
      case "--no-timestamp":
        args.noTimestamp = true;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  if (args.allWorkspaces && args.workspace) {
    throw new Error("Cannot combine --all-workspaces with --workspace");
  }

  return { help, args };
}

function parseNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${flag}: ${value}`);
  }
  return parsed;
}

export function renderGraphHelp(): string {
  return `repo-slice graph - generate dependency graphs from anchors

Usage:
  repo-slice graph [options]

Anchors (same as pack):
  --entry <path>              Add entry file anchor (repeatable)
  --symbol <query>            Add symbol query anchor (repeatable)
  --symbol-strict             Fail if any symbol resolves to multiple definitions
  --from-diff <revRange>      Add changed files as anchors
  --from-log <path>           Parse logs into file/line anchors

Workspace:
  --workspace <auto|name|path>  Scope to workspace (default: auto)
  --all-workspaces              Include all workspaces
  --fallback-all                Retry across all workspaces if symbol not found

Graph controls:
  --graph-type <imports|calls|combined>  (default: imports)
  --depth <n>                            (default: 2)
  --scope <symbol|file|workspace>        (default: auto-detect)
  --include-tests <auto|true|false>      (default: auto)
  --include-external                     Include external dependencies
  --max-nodes <n>                        (default: 500)
  --max-edges <n>                        (default: 2000)
  --collapse <none|external|file|class>  (default: external)
  --python-engine <treesitter|pyright>   (default: treesitter)

Output:
  --format <json|dot>         (default: json)
  --out <path>                Write to file
  --no-timestamp              Omit timestamp for reproducibility
  --debug                     Enable debug output

Exit codes:
  0 success
  1 runtime error
  2 anchor resolution failure
  3 invalid CLI usage
`;
}

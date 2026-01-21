import { renderHelp } from "./help.js";
import { runPack } from "../pack/runPack.js";

export type IncludeTestsMode = "auto" | "true" | "false";
export type OutputFormat = "md" | "json";

export interface PackCliArgs {
  entries: string[];
  symbols: string[];
  symbolStrict?: boolean;
  fromDiff?: string;
  fromLog?: string;
  workspace?: string;
  allWorkspaces?: boolean;
  fallbackAll?: boolean;
  depth?: number;
  budgetChars?: number;
  budgetTokens?: number;
  includeTests?: IncludeTestsMode;
  format?: OutputFormat;
  out?: string;
  reason?: boolean;
  redact?: boolean;
  debug?: boolean;
  noTimestamp?: boolean;
}

export async function packCommand(argv: string[]): Promise<void> {
  let parsed: ParsedPackArgs;
  try {
    parsed = parsePackArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.stderr.write(renderHelp());
    process.exit(3);
    return;
  }
  if (parsed.help) {
    process.stdout.write(renderHelp());
    process.exit(0);
  }
  await runPack(parsed.args);
}

interface ParsedPackArgs {
  help: boolean;
  args: PackCliArgs;
}

function parsePackArgs(argv: string[]): ParsedPackArgs {
  const args: PackCliArgs = {
    entries: [],
    symbols: [],
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
    // Don't eagerly consume next arg - let each case handle it
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
      case "--depth":
        args.depth = parseNumber(inlineValue ?? takeValue(i, flag), flag);
        if (!inlineValue) i += 1;
        break;
      case "--budget-chars":
        args.budgetChars = parseNumber(inlineValue ?? takeValue(i, flag), flag);
        if (!inlineValue) i += 1;
        break;
      case "--budget-tokens":
        args.budgetTokens = parseNumber(inlineValue ?? takeValue(i, flag), flag);
        if (!inlineValue) i += 1;
        break;
      case "--include-tests": {
        const mode = (inlineValue ?? takeValue(i, flag)) as IncludeTestsMode;
        if (!inlineValue) i += 1;
        if (!["auto", "true", "false"].includes(mode)) {
          throw new Error(`Invalid include-tests value: ${mode}`);
        }
        args.includeTests = mode;
        break;
      }
      case "--format": {
        const format = (inlineValue ?? takeValue(i, flag)) as OutputFormat;
        if (!inlineValue) i += 1;
        if (!["md", "json"].includes(format)) {
          throw new Error(`Invalid format: ${format}`);
        }
        args.format = format;
        break;
      }
      case "--out":
        args.out = inlineValue ?? takeValue(i, flag);
        if (!inlineValue) i += 1;
        break;
      case "--reason":
        args.reason = true;
        break;
      case "--redact":
        args.redact = true;
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

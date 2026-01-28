#!/usr/bin/env node
import { renderHelp } from "./commands/help.js";

const args = process.argv.slice(2);

const command = args[0];
const rest = args.slice(1);

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(renderHelp());
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    await (await import("./commands/version.js")).versionCommand();
    return;
  }

  switch (command) {
    case "pack":
      await (await import("./commands/pack.js")).packCommand(rest);
      return;
    case "graph":
      await (await import("./commands/graph.js")).graphCommand(rest);
      return;
    case "workspaces":
      await (await import("./commands/workspaces.js")).workspacesCommand(rest);
      return;
    case "version":
      await (await import("./commands/version.js")).versionCommand();
      return;
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.stderr.write(renderHelp());
      process.exit(3);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

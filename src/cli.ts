#!/usr/bin/env node
import { packCommand } from "./commands/pack.js";
import { graphCommand } from "./commands/graph.js";
import { workspacesCommand } from "./commands/workspaces.js";
import { versionCommand } from "./commands/version.js";
import { renderHelp } from "./commands/help.js";

const args = process.argv.slice(2);

const command = args[0];
const rest = args.slice(1);

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(renderHelp());
    process.exit(0);
  }

  switch (command) {
    case "pack":
      await packCommand(rest);
      return;
    case "graph":
      await graphCommand(rest);
      return;
    case "workspaces":
      await workspacesCommand(rest);
      return;
    case "version":
      await versionCommand();
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

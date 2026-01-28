import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export async function versionCommand(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Try both possible paths: dist/cli.js (one level up) and src/commands/version.js (two levels up)
  let pkgPath = join(__dirname, "..", "package.json");
  try {
    await access(pkgPath);
  } catch {
    // If not found, try going up one more level (for dev environment)
    pkgPath = join(__dirname, "..", "..", "package.json");
  }

  const raw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  process.stdout.write(`${pkg.version ?? "0.0.0"}\n`);
}

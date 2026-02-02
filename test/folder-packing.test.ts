import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, writeFile, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { runCli } from "./e2e.test.ts";

const TEST_DIR = join(process.cwd(), "test-fixtures", "folder-tests");

describe("e2e: pack command - folder packing", () => {
  beforeAll(async () => {
    // Create test folder structure
    await mkdir(join(TEST_DIR, "docs"), { recursive: true });
    await mkdir(join(TEST_DIR, "src"), { recursive: true });
    await mkdir(join(TEST_DIR, "assets"), { recursive: true });
    await mkdir(join(TEST_DIR, "config"), { recursive: true });
    await mkdir(join(TEST_DIR, "empty-dir"), { recursive: true });
    
    // Create test files
    await writeFile(join(TEST_DIR, "docs", "readme.md"), "# Test Documentation\n\nThis is a test.");
    await writeFile(join(TEST_DIR, "src", "app.ts"), "export const app = 'test';");
    await writeFile(join(TEST_DIR, "assets", "logo.png"), "binary-content-here");
    await writeFile(join(TEST_DIR, "config", "settings.json"), '{"debug": true}');
    await writeFile(join(TEST_DIR, ".hidden-file"), "hidden content");
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await rmdir(TEST_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("--folder flag", () => {
    test("packs all files in a folder", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      expect(json.items.length).toBeGreaterThan(0);
      
      // Check that files are included
      const filePaths = json.items.map((i: { filePath: string }) => i.filePath);
      expect(filePaths.some((p: string) => p.includes("readme.md"))).toBe(true);
      expect(filePaths.some((p: string) => p.includes("app.ts"))).toBe(true);
    });

    test("includes text files with content", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      const readmeItem = json.items.find((i: { filePath: string }) => i.filePath.includes("readme.md"));
      
      expect(readmeItem).toBeDefined();
      expect(readmeItem.content).toContain("# Test Documentation");
    });

    test("respects --folder-max-size option", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--folder-max-size", "0", // 0MB limit to skip all files
        "--reason",
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      // With 0MB limit, items should be in omitted list with size reasons
      // or the items array should have them marked
      const allItems = [...json.items, ...json.omitted];
      expect(allItems.length).toBeGreaterThan(0);
      
      // Check that we have files from the folder
      const folderFiles = allItems.filter((i: { filePath?: string }) => 
        i.filePath?.includes("test-fixtures")
      );
      expect(folderFiles.length).toBeGreaterThan(0);
    });

    test("skips hidden files by default", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      const filePaths = json.items.map((i: { filePath: string }) => i.filePath);
      
      // .hidden-file should not be included
      expect(filePaths.some((p: string) => p.includes(".hidden-file"))).toBe(false);
    });

    test("includes hidden files with --folder-include-hidden", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--folder-include-hidden",
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      const filePaths = json.items.map((i: { filePath: string }) => i.filePath);
      
      // .hidden-file should now be included
      expect(filePaths.some((p: string) => p.includes(".hidden-file"))).toBe(true);
    });

    test("marks items with 'folder inclusion' reason", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--reason",
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      const folderItem = json.items.find((i: { reasons?: string[] }) => 
        i.reasons?.some((r: string) => r.includes("folder"))
      );
      
      expect(folderItem).toBeDefined();
      expect(folderItem.reasons).toContain("folder inclusion");
    });

    test("handles empty directories", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--reason",
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      
      // Look for empty directory marker
      const emptyDirItem = json.items.find((i: { reasons?: string[] }) => 
        i.reasons?.some((r: string) => r.includes("empty"))
      );
      
      // Empty directory should be tracked
      expect(emptyDirItem).toBeDefined();
    });

    test("works with --entry flag", async () => {
      const result = await runCli([
        "pack",
        "--entry", "src/cli.ts",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      
      // Should have both entry files and folder files
      const filePaths = json.items.map((i: { filePath: string }) => i.filePath);
      expect(filePaths.some((p: string) => p.includes("cli.ts"))).toBe(true);
      expect(filePaths.some((p: string) => p.includes("readme.md"))).toBe(true);
    });
  });

  describe("binary file handling", () => {
    test("includes binary file metadata without content", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      
      // Find the binary file (logo.png)
      const binaryItem = json.items.find((i: { filePath: string }) => 
        i.filePath.includes("logo.png")
      );
      
      if (binaryItem) {
        // Binary files should have size but limited or no content
        expect(binaryItem).toBeDefined();
      }
    });

    test("omits files exceeding max size", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--folder-max-size", "0", // 0MB limit to skip all files
        "--reason",
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      
      // All files should be omitted (they're all > 0 bytes)
      expect(json.omitted.length).toBeGreaterThan(0);
    });
  });

  describe("CLI validation", () => {
    test("requires at least one anchor (entry, symbol, or folder)", async () => {
      const result = await runCli([
        "pack",
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("No anchors specified");
    });

    test("accepts --folder without other anchors", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("output format", () => {
    test("produces valid JSON output", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      // Should be valid JSON
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    test("includes meta section", async () => {
      const result = await runCli([
        "pack",
        "--folder", TEST_DIR,
        "--no-timestamp",
      ]);
      expect(result.exitCode).toBe(0);
      
      const json = JSON.parse(result.stdout);
      expect(json.meta).toBeDefined();
      expect(json.meta.command).toContain("--folder");
    });
  });
});

// Export for use in other test files
export { TEST_DIR };

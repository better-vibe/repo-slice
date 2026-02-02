import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { isAbsolute } from "node:path";
import { fileExists } from "../utils/fs.js";
import { normalizePath } from "../utils/path.js";
import type { IgnoreMatcher } from "../ignore.js";

export interface FolderFile {
  path: string;
  kind: "text" | "binary" | "directory";
  size: number;
  content?: string;
  mimeType?: string;
  isEmpty?: boolean; // For directories
}

export interface SkippedFile {
  path: string;
  reason: "too-large" | "binary-metadata-only" | "symlink-skipped";
  size: number;
  maxSize?: number;
  folder: string;
}

export interface DiscoverFolderOptions {
  folderPath: string;
  cwd: string;
  maxSizeBytes: number;
  ignoreMatcher: IgnoreMatcher;
  includeHidden: boolean;
  followSymlinks: boolean;
}

export interface DiscoverFolderResult {
  included: FolderFile[];
  skipped: SkippedFile[];
  emptyDirs: string[];
}

/**
 * Discover all files in a folder recursively
 */
export async function discoverFolderFiles(
  options: DiscoverFolderOptions
): Promise<DiscoverFolderResult> {
  const {
    folderPath,
    cwd,
    maxSizeBytes,
    ignoreMatcher,
    includeHidden,
    followSymlinks,
  } = options;

  const resolvedPath = normalizePath(
    isAbsolute(folderPath) ? folderPath : resolve(cwd, folderPath)
  );

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`Folder not found: ${folderPath}`);
  }

  const included: FolderFile[] = [];
  const skipped: SkippedFile[] = [];
  const emptyDirs: string[] = [];

  async function walk(currentPath: string, relativePath: string): Promise<void> {
    // Check if path should be ignored
    if (ignoreMatcher.ignores(currentPath)) {
      return;
    }

    const stats = await stat(currentPath);

    // Handle symlinks
    if (stats.isSymbolicLink()) {
      if (!followSymlinks) {
        skipped.push({
          path: currentPath,
          reason: "symlink-skipped",
          size: 0,
          folder: resolvedPath,
        });
        return;
      }
      // If following symlinks, we would resolve and continue
      // For now, skip to avoid circular references
      return;
    }

    // Handle directories
    if (stats.isDirectory()) {
      const entries = await readdir(currentPath);

      // Track empty directories
      if (entries.length === 0) {
        emptyDirs.push(currentPath);
        included.push({
          path: currentPath,
          kind: "directory",
          size: 0,
          isEmpty: true,
        });
        return;
      }

      // Add non-empty directory marker
      included.push({
        path: currentPath,
        kind: "directory",
        size: 0,
        isEmpty: false,
      });

      // Recurse into subdirectories
      for (const entry of entries) {
        // Skip hidden files/directories unless configured
        if (!includeHidden && entry.startsWith(".")) {
          continue;
        }

        const fullPath = join(currentPath, entry);
        await walk(fullPath, join(relativePath, entry));
      }
      return;
    }

    // Handle files
    if (stats.isFile()) {
      const fileSize = stats.size;

      // Check size limit
      if (fileSize > maxSizeBytes) {
        skipped.push({
          path: currentPath,
          reason: "too-large",
          size: fileSize,
          maxSize: maxSizeBytes,
          folder: resolvedPath,
        });
        return;
      }

      // Detect if binary
      const isBinary = await isBinaryFile(currentPath);

      if (isBinary) {
        // Binary files: metadata only
        const mimeType = getMimeType(currentPath);
        skipped.push({
          path: currentPath,
          reason: "binary-metadata-only",
          size: fileSize,
          folder: resolvedPath,
        });
        // Still include metadata
        included.push({
          path: currentPath,
          kind: "binary",
          size: fileSize,
          mimeType,
        });
      } else {
        // Text files: include content
        const content = await readFile(currentPath, "utf-8");
        included.push({
          path: currentPath,
          kind: "text",
          size: fileSize,
          content,
        });
      }
    }
  }

  await walk(resolvedPath, "");

  return { included, skipped, emptyDirs };
}

/**
 * Detect if a file is binary by checking magic bytes and content
 */
async function isBinaryFile(filePath: string): Promise<boolean> {
  // Check extension first (fast path)
  const ext = filePath.toLowerCase().split(".").pop() || "";
  const binaryExtensions = new Set([
    // Images
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "raw",
    // Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
    // Archives
    "zip", "tar", "gz", "bz2", "7z", "rar", "xz",
    // Executables
    "exe", "dll", "so", "dylib", "bin", "app",
    // Media
    "mp3", "mp4", "avi", "mov", "mkv", "flv", "wmv", "webm", "wav", "flac", "aac",
    // Fonts
    "ttf", "otf", "woff", "woff2", "eot",
    // Other
    "swf", "fla", "psd", "ai", "sketch", "fig",
  ]);

  if (binaryExtensions.has(ext)) {
    return true;
  }

  // Check for null bytes in first 4KB (binary indicator)
  try {
    const buffer = await readFile(filePath);
    const firstChunk = buffer.slice(0, 4096);
    return firstChunk.includes(0);
  } catch {
    return false;
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop() || "";
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Archives
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
    // Media
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    // Default
  };
  return mimeTypes[ext] || "application/octet-stream";
}

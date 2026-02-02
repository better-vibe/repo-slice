---
"@better-vibe/repo-slice": minor
---

**Feature: Folder/Directory Packing**

Added support for packing entire directories with the new `--folder` flag:

- **Pack any directory**: `repo-slice pack --folder docs/` packs all files in the docs directory
- **Multiple folders**: Support for `--folder dir1/ --folder dir2/`
- **Respects .gitignore**: Automatically skips ignored files
- **Size limits**: Configurable max file size with `--folder-max-size` (default: 5MB)
- **Binary handling**: Binary files include metadata only (path, size, MIME type)
- **Hidden files**: Configurable with `--folder-include-hidden` (default: skip)
- **Symlinks**: Configurable with `--folder-follow-symlinks` (default: skip)
- **Empty directories**: Explicitly tracked in output

**New CLI Options**:
```
--folder <path>                Pack all files in directory (repeatable)
--folder-max-size <mb>         Max file size in MB (default: 5)
--folder-include-hidden        Include hidden files (default: skip)
--folder-follow-symlinks       Follow symlinks (default: skip)
```

**Example Usage**:
```bash
# Pack documentation folder
repo-slice pack --folder docs/

# Pack with 10MB size limit
repo-slice pack --folder assets/ --folder-max-size 10

# Include hidden files
repo-slice pack --folder config/ --folder-include-hidden

# Mix folders and entry files
repo-slice pack --entry src/main.ts --folder public/
```

**Files created**:
- `src/folders/discover.ts` - Folder discovery and file classification

**Files modified**:
- `src/commands/pack.ts` - Added folder CLI flags
- `src/pack/runPack.ts` - Integrated folder processing into pack flow

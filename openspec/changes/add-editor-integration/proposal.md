# Proposal: Add Editor Integration

## Why

The plugin currently runs OpenCode in an integrated terminal, but lacks bidirectional communication with the editor. When OpenCode references a file (e.g., "Editing src/main.ts line 45"), users must manually locate and open that file. Meanwhile, the `EditorServer` class exists but is non-functional — it crashes on startup because `ws` cannot be resolved in Electron's renderer process.

Supporting editor integration would provide:

- **Clickable file references** — OpenCode mentions a file, user clicks and jumps directly to it
- **Active files tracking** — A panel showing which files OpenCode is currently working with
- **Cursor positioning** — Jump not just to the file, but to the exact line OpenCode mentions

This mirrors the editor integration already used by VS Code and Neovim users with Claude.

## What Changes

1. **Run EditorServer in the main process** via IPC, not the renderer, to avoid `ws` module resolution issues
2. **Implement `at_mentioned` handling** — when OpenCode sends this notification, open the file and scroll to the mentioned line
3. **Add ActiveFilesView** — a panel listing all files mentioned during the current session, clickable to navigate
4. **Create lock file** at `~/.claude/ide/{port}.lock` so OpenCode can discover the editor transport

## Impact

- **Added**: `src/ui/ActiveFilesView.ts` — new ItemView for tracking active files
- **Modified**: `src/main.ts` — register IPC handlers and manage EditorServer lifecycle in main process
- **Modified**: `src/ui/OpencodeTerminalView.ts` — connect to EditorServer via IPC, handle navigation events
- **Modified**: `src/server/EditorServer.ts` — refactor to run in main process, implement full protocol handling
- **Modified**: `esbuild.config.mjs` — ensure `ws` is handled correctly (external for main process)

## Out of Scope

- Live collaborative editing (editor ↔ OpenCode bidirectional sync)
- Handling files outside the vault
- Persisting active file list across sessions
- Windows ConPTY support (separate change)

## Success Criteria

- [ ] Opening a terminal no longer throws "Cannot find module 'ws'"
- [ ] Lock file is created at `~/.claude/ide/{port}.lock` when terminal opens
- [ ] Lock file is deleted when terminal closes
- [ ] When OpenCode sends `at_mentioned`, the file opens in Obsidian and cursor scrolls to the mentioned line
- [ ] ActiveFilesView shows files mentioned during the session
- [ ] Clicking a file in ActiveFilesView navigates to it with scroll
- [ ] `bun run build` completes without errors

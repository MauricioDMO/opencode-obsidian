# Proposal: Add Windows Terminal Support

## Why

The plugin's integrated terminal currently works only on Unix/macOS due to a PTY implementation that relies on a Python script using `os.forkpty`. Windows users see a "not yet implemented" message and cannot use the terminal feature.

Windows support is a stated roadmap goal (v0.2) and unblocks a significant portion of potential users.

## What Changes

Replace the Unix-only Python PTY script with `node-pty`, a cross-platform PTY library that supports Windows via ConPTY (Windows 10+) and Unix via `forkpty`. This enables the full integrated terminal experience on Windows.

## Impact

- **Modified**: `src/ui/OpencodeTerminalView.ts` — replace PTY spawn logic
- **Modified**: `esbuild.config.mjs` — declare `node-pty` as external
- **Added**: `package.json` — new `node-pty` dependency

## Success Criteria

- [ ] `bun run build` completes without errors on Windows and Unix
- [ ] Terminal launches OpenCode correctly on Windows 10+
- [ ] Terminal resize is reflected in the PTY
- [ ] Drag-and-drop file paths write to stdin on Windows
- [ ] Keybindings work correctly on Windows
- [ ] Session start, continue, and restore work on Windows
- [ ] No regression in Unix/macOS terminal behavior

# Tasks: Add Windows Terminal Support

## 1. Dependencies

- [ ] 1.1 Run `bun add node-pty @types/node-pty`
- [ ] 1.2 Verify `node_modules/node-pty/` contains platform-specific `.node` binaries

## 2. Build Configuration

- [ ] 2.1 Add `"node-pty"` to the `external` array in `esbuild.config.mjs`
- [ ] 2.2 Verify `bun run build` completes without errors after external declaration

## 3. OpencodeTerminalView Refactor

- [ ] 3.1 Add `import * as nodePty from "node-pty";` at top of `OpencodeTerminalView.ts`
- [ ] 3.2 Change `ptyProcess` field type from `ChildProcess | null` to `nodePty.IPty | null`
- [ ] 3.3 Replace `spawnPty()` Windows early-return block with `nodePty.spawn()` for both platforms
- [ ] 3.4 Replace `child_process` stdout/stderr/event handlers with `IPty.onData`, `onExit`, `onError`
- [ ] 3.5 Remove `UNIX_PSEUDOTERMINAL_PY` constant (no longer needed)
- [ ] 3.6 Update `sendResize()` to use `ptyProcess.resize(cols, rows)` instead of cmdio pipe write
- [ ] 3.7 Update `onClose()` — `ptyProcess.kill()` works as before, verify no `ChildProcess` API remnants
- [ ] 3.8 Update `restartPty()` — `ptyProcess.kill()` works as before, verify no `ChildProcess` API remnants
- [ ] 3.9 Update `handleTerminalKeyEvent()` — replace `ptyProcess.stdin?.write()` with `ptyProcess?.write()`
- [ ] 3.10 Update `TerminalDrop.ts` registration in `spawnPty()` — `ptyWrite` callback uses `ptyProcess?.write()` instead of `ptyProcess?.stdin?.write()`

## 4. Import Cleanup

- [ ] 4.1 Verify `ChildProcess` and `spawn` from `child_process` are still needed elsewhere in the file
- [ ] 4.2 If no longer needed, remove the `child_process` import
- [ ] 4.3 Remove `UNIX_PSEUDOTERMINAL_PY` constant after confirming `node-pty` works

## 5. Testing — Windows

- [ ] 5.1 Build on Windows: `bun run build`
- [ ] 5.2 Open Obsidian on Windows, activate terminal view
- [ ] 5.3 Verify OpenCode starts in terminal with correct cwd and env
- [ ] 5.4 Verify terminal output (colors, prompts, ANSI) displays correctly
- [ ] 5.5 Verify resize (drag Obsidian sidebar) updates PTY size
- [ ] 5.6 Verify keybindings (ctrl+v paste, ctrl+backspace word delete, ctrl+c interrupt)
- [ ] 5.7 Verify drag-and-drop file paths write to stdin
- [ ] 5.8 Verify "New OpenCode Session" command opens fresh session
- [ ] 5.9 Verify "Continue Last OpenCode Session" command with `-c` flag works
- [ ] 5.10 Verify closing terminal cleanly kills the PTY process
- [ ] 5.11 Verify error message if OpenCode executable not found

## 6. Testing — Unix/macOS Regression

- [ ] 6.1 Verify `bun run build` completes without errors
- [ ] 6.2 Open terminal view on macOS/Linux
- [ ] 6.3 Verify all features from section 5 (same test checklist)
- [ ] 6.4 Verify no regression in PTY behavior compared to before refactor

## 7. Documentation

- [ ] 7.1 Update README.md if Windows version requirements differ from current
- [ ] 7.2 Update `openspec/specs/001-mvp-opencode-embed/spec.md` to remove the implicit Windows gap implication
- [ ] 7.3 Add note to `openspec/project.md` "Important Constraints / Desktop Only" that Windows PTY is now supported

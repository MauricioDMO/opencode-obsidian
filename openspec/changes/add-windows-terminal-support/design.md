# Design: Add Windows Terminal Support

## Context

### Current Implementation

`OpencodeTerminalView.spawnPty()` uses an embedded Python script (`UNIX_PSEUDOTERMINAL_PY`) that calls `os.forkpty` to allocate a pseudo-terminal, then forwards stdin/stdout and a resize command pipe. On Windows, the code currently returns early with a "not yet implemented" notice.

The current PTY approach:
- Spawns `python3 -c <script>` with 4 pipes: stdin, stdout, stderr, cmdio (for resize)
- The Python script uses `pty.fork()` and `selectors` to multiplex I/O
- Resize is sent as `rowsxcols\n` over the cmdio pipe and applied via `ioctl`

### New Requirements

1. Cross-platform PTY that works on Windows 10+ (ConPTY) and Unix/macOS
2. Preserve all current terminal features: ANSI colors, resize, keybindings, drag-and-drop
3. Minimal code complexity — avoid platform-specific scripts

## Decisions

### Decision 1: Use `node-pty` instead of custom PTY script

**What:** Replace the embedded Python PTY script with `node-pty.spawn()`, a mature library with prebuilt binaries for Electron/Node.js that supports both ConPTY (Windows) and `forkpty` (Unix).

**Why:**
- ConPTY support on Windows 10+ is native and well-tested
- No need to maintain a Python script for PTY multiplexing
- `node-pty` is already widely used in Electron apps (VS Code, Hyper, etc.)
- Prebuilt binaries avoid native compilation for plugin users

**Alternatives considered:**
- Keep Python script + add PowerShell ConPTY wrapper: rejected — fragile, encoding issues, distribution complexity
- `node-pty` + fallback to pipe-based spawn: rejected — pipe-based loses TTY features that OpenCode needs
- Write custom native module: rejected — compilation barrier for plugin users

**Implementation:**

```typescript
// Before (Unix-only, Python PTY script):
if (process.platform === "win32") {
  terminal.writeln("\r\nWindows PTY support not yet implemented.\r\n");
  new Notice("OpenCode terminal not supported on Windows yet.");
  return;
}
this.ptyProcess = spawn("python3", ["-c", UNIX_PSEUDOTERMINAL_PY, opencodePath, ...args], {
  cwd,
  env: getOpencodeEnv(),
  stdio: ["pipe", "pipe", "pipe", "pipe"],
});

// After (node-pty, cross-platform):
const pty = nodePty.spawn(opencodePath, args, {
  cwd,
  env: getOpencodeEnv(),
  cols: terminal.cols,
  rows: terminal.rows,
});
```

### Decision 2: Keep `node-pty` as external in esbuild

**What:** Declare `node-pty` as an `external` in `esbuild.config.mjs` so it is not bundled, and ship the `node_modules/node-pty/` directory alongside `main.js`.

**Why:**
- `node-pty` includes native `.node` binaries compiled for specific Electron/Node versions
- Bundling it would break those binaries
- Obsidian loads plugins from the vault; external modules can be resolved from `node_modules/`

**Alternatives considered:**
- Bundle with a polyfill: rejected — native binaries cannot be polyfilled
- Require users to install `node-pty` globally: rejected — friction and version mismatch

**Implementation:**

```js
// esbuild.config.mjs
external: [
  // ... existing externals ...
  "node-pty",
],
```

Plugin distribution requires shipping `node_modules/node-pty/` next to `main.js`. A postinstall or build script can copy it, or users can run `bun install` in the plugin directory.

### Decision 3: Remove the Python PTY script

**What:** Delete `UNIX_PSEUDOTERMINAL_PY` from `OpencodeTerminalView.ts` after switching to `node-pty`.

**Why:**
- `node-pty` handles PTY allocation natively on both platforms
- The Python script is ~65 lines of code that becomes dead weight
- Reduces bundle size and removes the `python3` dependency

**Alternatives considered:**
- Keep Python script as Unix fallback: rejected — `node-pty` works on Unix too; no need for dual implementation
- Keep Python script as optional fallback: rejected — complexity for minimal gain

### Decision 4: Change `ptyProcess` field type

**What:** Change the stored process from `ChildProcess | null` to `nodePty.IPty | null`.

**Why:**
- `node-pty` returns `IPty`, not `ChildProcess`
- `IPty` has compatible methods (`kill()`, `write()`, `resize()`) but different event signatures
- The existing `ptyProcess` field is used in `onClose`, `restartPty`, `handleTerminalKeyEvent`, and `sendResize`

**Implementation:**

```typescript
// Before:
private ptyProcess: ChildProcess | null = null;

// After:
private ptyProcess: nodePty.IPty | null = null;
```

Event handlers change from `child_process` patterns to `nodePty.IPty` patterns:

```typescript
// Before (ChildProcess):
this.ptyProcess.stdout?.on("data", (chunk) => terminal.write(chunk));
this.ptyProcess.stderr?.on("data", (chunk) => console.error("PTY stderr:", chunk.toString()));
this.ptyProcess.on("exit", (code, signal) => { ... });
this.ptyProcess.on("error", (err) => { ... });

// After (IPty):
pty.onData((data: string) => terminal.write(data));
pty.onExit(({ exitCode, signal }) => { ... });
pty.onError((err: Error) => { ... });
```

### Decision 5: Simplify `sendResize` to use `IPty.resize()`

**What:** Replace the cmdio pipe write (`${rows}x${cols}\n`) with a direct `ptyProcess.resize(cols, rows)` call.

**Why:**
- `node-pty` exposes a `resize(cols, rows)` method
- The cmdio pipe mechanism was a workaround for the Python script; `node-pty` handles this internally
- Reduces code complexity

**Implementation:**

```typescript
// Before:
private sendResize(): void {
  const cmdio = this.ptyProcess.stdio?.[3];
  if (cmdio && typeof (cmdio as any).write === "function") {
    (cmdio as any).write(`${this.terminal.rows}x${this.terminal.cols}\n`);
  }
}

// After:
private sendResize(): void {
  if (this.ptyProcess && this.terminal) {
    this.ptyProcess.resize(this.terminal.cols, this.terminal.rows);
  }
}
```

### Decision 6: Update `handleTerminalKeyEvent` for IPty API

**What:** Change `this.ptyProcess.stdin?.write(data)` to `this.ptyProcess?.write(data)`.

**Why:**
- `IPty` has a `write(data: string)` method instead of a `stdin` stream
- Drop handler in `TerminalDrop.ts` uses the same pattern and must be updated

**Implementation:**

```typescript
// Before:
this.ptyProcess?.stdin?.write(data);

// After:
this.ptyProcess?.write(data);
```

## Architecture

```
┌──────────────────────────────────────────────┐
│ OpencodeTerminalView                         │
│                                              │
│  spawnPty()                                  │
│    │                                         │
│    ├─ Unix: nodePty.spawn("python3", [...])  │
│    │                  └─ Python PTY script   │
│    │                                     │
│    └─ Win: nodePty.spawn(opencodePath, args) │
│                  └─ ConPTY (Windows)        │
│                                              │
│  Events: onData → terminal.write()           │
│          onExit → display exit message       │
│          onError → Notice + display error    │
│                                              │
│  sendResize() → ptyProcess.resize(cols, rows) │
│  handleTerminalKeyEvent() → ptyProcess.write()│
└──────────────────────────────────────────────┘
```

## Data Flow

1. User opens terminal view → `onOpen()` → `spawnPty()`
2. `spawnPty()` calls `nodePty.spawn()` with opencode executable, args, cwd, env
3. PTY I/O events flow:
   - `onData(data)` → `terminal.write(data)` (output to xterm)
   - `terminal.onData(data)` → `ptyProcess.write(data)` (input from xterm)
4. Terminal resize → `FitAddon.fit()` → `sendResize()` → `ptyProcess.resize()`
5. Drop event → `handleTerminalDrop()` → `ptyProcess.write("@filepath ")` (inject path)
6. Session end → `onExit()` → display message, clear `ptyProcess` reference

## Risks / Trade-offs

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `node-pty` prebuilt binaries incompatible with Obsidian's Electron version | Low | High | Use `@electron/rebuild` or match Electron version; test on Obsidian beta |
| ConPTY not available on Windows 7/8 or old Windows 10 builds | Low | Low | Display clear error message; ConPTY is standard on Windows 10 1809+ |
| `node-pty` native binaries cause crashes on specific Node/Electron versions | Low | Medium | Pin to known-compatible version; provide fallback to message |
| `node-pty` causes increased memory usage | Very Low | Low | Marginal increase; acceptable for terminal feature |

## Migration Plan

1. Add `node-pty` and `@types/node-pty` to `package.json`
2. Add `"node-pty"` to `external` array in `esbuild.config.mjs`
3. Replace PTY spawn logic and event handlers in `OpencodeTerminalView.ts`
4. Update `TerminalDrop.ts` to use `IPty.write()` instead of `stdin.write()`
5. Remove `UNIX_PSEUDOTERMINAL_PY` constant
6. Test on Windows 10+ and Unix/macOS
7. Document Windows version requirements in README

## Open Questions

1. **Should the plugin copy `node-pty` to the output directory automatically?**
   - Current esbuild setup does not copy `node_modules/`. Plugin users need to run `bun install` in the plugin directory.
   - Could add a postbuild script to copy, but adds build complexity.
   - Decision: Document `bun install` requirement; do not auto-copy.

2. **Should there be a fallback for environments where `node-pty` fails to load?**
   - Could show a degraded "pipe-only" terminal experience.
   - Decision: No fallback — `node-pty` is required for terminal to function. Show clear error if it fails.

3. **Should the `UNIX_PSEUDOTERMINAL_PY` be kept as a comment or removed?**
   - Decision: Remove. It was a temporary implementation detail, not part of the stable API.

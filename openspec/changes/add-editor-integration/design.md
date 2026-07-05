# Design: Add Editor Integration

## Context

### Current State

`EditorServer.ts` attempts to create a WebSocket server using `require("ws")` in the renderer process. This fails because:

1. esbuild with `platform: "node"` and `...builtins` external treats `ws` as a Node.js-only module
2. Even though `ws` is in `dependencies`, it is not bundled into `main.js`
3. Electron's renderer process cannot resolve `ws` from `node_modules`

The class is called from `OpencodeTerminalView.onOpen()` but the error is caught and logged — the terminal still works, but the editor server never starts.

### Requirements

1. Editor server must survive as long as the terminal view is open
2. OpenCode must be able to discover the editor via lock file (`~/.claude/ide/{port}.lock`)
3. `at_mentioned` notifications must open files and scroll to the mentioned line
4. A panel must show all files mentioned during the session
5. All of this must work within Obsidian's Electron-based architecture

## Decisions

### Decision 1: Run EditorServer in the main process

**What:** Move the WebSocket server from the renderer process to the main process, communicate via Obsidian's IPC mechanism (`app.plugins.plugins['opencode-obsidian'].executeCode()` or similar).

**Why:**
- `ws` is a Node.js module that requires `node_modules` resolution — the main process has proper module resolution
- Electron best practice: Node.js/network code belongs in main process, UI in renderer
- Obsidian plugins communicate between main and renderer via method calls on the plugin instance

**Alternatives considered:**
- Bundle `ws` into renderer bundle: rejected — `ws` uses Node.js internals that don't work when bundled for browser-like environments
- Use browser WebSocket API: rejected — lacks features `ws` provides; protocol compatibility uncertain

**Implementation:**

The main process module (`src/server/EditorServer.ts`) stays essentially the same — it just runs in main instead of renderer. The plugin registers it in `onload()`:

```typescript
// src/main.ts
this.editorServer = new EditorServer();
this.editorServer.on('at-mentioned', (filePath: string, lineStart: number, lineEnd: number) => {
  // Send to renderer via window event or direct view callback
  const view = this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0]?.view;
  if (view instanceof OpencodeTerminalView) {
    view.onFileMentioned(filePath, lineStart, lineEnd);
  }
});
```

### Decision 2: Use EventEmitter pattern for EditorServer

**What:** `EditorServer` emits events (`at-mentioned`, `connected`, `disconnected`) instead of having the renderer call methods directly.

**Why:**
- Decouples the server from UI concerns
- Makes testing easier
- Aligns with Node.js idioms

**Implementation:**

```typescript
// src/server/EditorServer.ts
import { EventEmitter } from 'events';

export class EditorServer extends EventEmitter {
  // ... WebSocket server code ...

  private handleMessage(ws: any, rawData: string): void {
    try {
      const msg = JSON.parse(rawData);
      if (msg.method === 'at_mentioned' && msg.params) {
        this.emit('at-mentioned', msg.params.filePath, msg.params.lineStart ?? 1, msg.params.lineEnd ?? 1);
      }
      // ... existing initialize handling ...
    } catch {
      // Ignore malformed messages
    }
  }
}
```

### Decision 3: Navigation — open file + scroll to line

**What:** When `at_mentioned` arrives, open the file in Obsidian and position the cursor at the mentioned line.

**Why:**
- Simple and actionable — users see exactly what OpenCode is referencing
- Mirrors VS Code/Cursor behavior which users already know
- Full collaborative editing (where both editor and OpenCode see each other's changes live) is out of scope

**Implementation:**

```typescript
// In OpencodeTerminalView or a dedicated navigation helper
async onFileMentioned(filePath: string, lineStart: number, lineEnd: number): Promise<void> {
  const normalizedPath = this.normalizeFilePath(filePath);
  if (!normalizedPath) {
    console.warn('[OpenCode] File not in vault, ignoring:', filePath);
    return;
  }

  // Open the file
  const file = this.app.metadataCache.getFirstLinkpathDest(normalizedPath, '');
  if (!file) {
    console.warn('[OpenCode] Could not resolve file:', normalizedPath);
    return;
  }

  const leaf = this.app.workspace.getLeaf('tab');
  await leaf.openFile(file);

  // Wait for editor to be ready, then scroll
  this.app.workspace.on('layout-change', () => {
    const view = leaf.view;
    if (view && 'editor' in view) {
      const editor = view.editor;
      const targetLine = Math.max(0, lineStart - 1); // 0-indexed
      editor.setCursor({ line: targetLine, ch: 0 });
      editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, { center: true });
    }
  });
}

private normalizeFilePath(filePath: string): string | null {
  // If filePath is absolute and inside vault, extract relative path
  // If already relative, use as-is
  // Return null if outside vault
}
```

### Decision 4: ActiveFilesView as a bottom drawer in the terminal

**What:** Show the active files panel as a collapsible drawer at the bottom of the terminal view, not as a separate tab.

**Why:**
- Keeps all OpenCode-related UI in one place
- Less cognitive overhead than switching between tabs
- Drawer can be collapsed when not needed

**Alternatives considered:**
- Separate ItemView tab: rejected — adds clutter to sidebar; user must switch views
- Floating panel: rejected — blocks terminal content

**Implementation:**

```typescript
// In OpencodeTerminalView
// Add a drawer below the terminal:
// ┌──────────────────────────────────────┐
// │ OpenCode Terminal              [─]  │
// ├──────────────────────────────────────┤
// │ $ opencode                          │
// │ ...                                 │
// ├──────────────────────────────────────┤
// │ 📄 src/main.ts:45  📄 tests/a.ts   │ [Clear]
// └──────────────────────────────────────┘

// When at_mentioned fires, add to activeFiles Set and render the drawer
// When drawer "Clear" is clicked, clear the Set
// When terminal restarts, clear the Set
```

### Decision 5: Lock file lifecycle

**What:** Lock file is created when the terminal view opens and deleted when it closes. The port is chosen dynamically (WebSocket server on port 0 = OS assigns random available port).

**Format:**
```json
{
  "transport": "ws",
  "workspaceFolders": ["/absolute/path/to/vault"]
}
```

**Why:**
- Matches the established Claude IDE lock file format
- `workspaceFolders` tells OpenCode which directories to consider as the project
- Transient lock file (lives only during terminal session) is simpler than persistent

### Decision 6: Handle files outside the vault

**What:** If `at_mentioned` references a file outside the vault, log a warning and skip navigation.

**Why:**
- Obsidian only manages files within the vault
- Opening external files would require the OS default app, which is out of scope

**Implementation:**
```typescript
private isFileInVault(filePath: string): boolean {
  const vaultPath = this.plugin.vaultRoot;
  return path.isAbsolute(filePath) && filePath.startsWith(vaultPath);
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Main Process                                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ EditorServer (src/server/EditorServer.ts)            │   │
│  │  - WebSocket server (ws) on random port              │   │
│  │  - Creates ~/.claude/ide/{port}.lock                 │   │
│  │  - Parses at_mentioned messages                       │   │
│  │  - EventEmitter: 'at-mentioned', 'connected'         │   │
│  └────────────────────────┬────────────────────────────┘   │
│                            │ plugin.on('at-mentioned', ...) │
└────────────────────────────┼────────────────────────────────┘
                             │ (via app.plugins.plugins reference)
┌────────────────────────────┼────────────────────────────────┐
│ Renderer                    │                                │
│                              │                                │
│  OpencodeTerminalView        │                                │
│  - onOpen() → starts server  │ via IPC / method call         │
│  - onFileMentioned()         │ ← receives at-mentioned events │
│  - Opens file + scrolls      │                                │
│  - Updates activeFiles list  │                                │
│  - Drawer UI at bottom       │                                │
│  - onClose() → stops server  │                                │
│                              │                                │
└──────────────────────────────┴────────────────────────────────┘
```

## Data Flow

### Terminal opens
1. `OpencodeTerminalView.onOpen()` is called
2. Plugin calls `editorServer.start(vaultPath)` in main process
3. `EditorServer` creates WebSocket on random port
4. Lock file written to `~/.claude/ide/{port}.lock`
5. EditorServer emits `connected` event

### OpenCode sends at_mentioned
1. OpenCode connects to WebSocket and sends JSON-RPC message
2. `EditorServer.handleMessage()` parses the message
3. `EditorServer` emits `at-mentioned` event with `filePath, lineStart, lineEnd`
4. Plugin receives event, finds the terminal view
5. `OpencodeTerminalView.onFileMentioned()` is called
6. File is opened, cursor is set, line is scrolled to center
7. File is added to `activeFiles` Set
8. Drawer UI updates to show the new file

### Terminal closes
1. `OpencodeTerminalView.onClose()` is called
2. Plugin calls `editorServer.stop()`
3. Lock file is deleted
4. All WebSocket clients are terminated

## Files

### src/server/EditorServer.ts

Refactor to:
- Extend `EventEmitter`
- Add `'at-mentioned'` and `'connected'`/`'disconnected'` events
- Improve `handleMessage()` to handle `at_mentioned` (currently only handles `initialize`)

### src/main.ts

Add:
- `editorServer: EditorServer` field
- Instantiate and register event handlers in `onload()`
- Stop server in `onunload()`
- Manage event forwarding to terminal view

### src/ui/OpencodeTerminalView.ts

Add:
- `private activeFiles = new Set<string>()` — track mentioned files
- `private activeFilesDrawerEl: HTMLElement | null` — drawer DOM element
- `onFileMentioned(filePath, lineStart, lineEnd)` method — navigation logic
- `renderActiveFilesDrawer()` — update drawer UI
- Collapsed/expanded state for drawer
- "Clear" button handler

### src/ui/NavigationUtils.ts (new)

Extract navigation logic to a utility:
- `normalizeFilePath(filePath, vaultRoot)` — resolve to vault-relative path or null
- `openFileAndScroll(app, file, lineStart)` — open + scroll with proper timing

### esbuild.config.mjs

No changes needed if EditorServer runs in main process. `ws` is already in dependencies and will be resolved from the system's Node.js when the main process runs.

## Risks / Trade-offs

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Obsidian API for scrolling to line is imprecise | Low | Medium | Test with various file sizes; use `scrollIntoView` with `center: true` |
| Race condition when opening file before editor is ready | Medium | Low | Use `layout-change` event or setTimeout retry |
| OpenCode lock file format changes | Low | High | Log warning if lock file format is unrecognized |
| Port conflict if another editor integration is running | Low | Low | Use port 0 (OS assigns); lock file contains actual port |

## Open Questions Resolved

1. **Panel location**: Bottom drawer in terminal view — keeps context together
2. **Files outside vault**: Ignore + log warning — Obsidian can't manage external files
3. **Lock file persistence**: Transient (session-only) — simpler, matches terminal lifecycle

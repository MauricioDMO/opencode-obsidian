# Tasks: Add Editor Integration

## Phases

### Phase 1: Infrastructure (EditorServer in main process)

- [ ] **1.1** Refactor `EditorServer` to extend `EventEmitter` and emit `'at-mentioned'` events
- [ ] **1.2** Move `EditorServer` lifecycle to main process in `main.ts` (`onload`/`onunload`)
- [ ] **1.3** Wire up `at-mentioned` event to forward to `OpencodeTerminalView.onFileMentioned()`
- [ ] **1.4** Verify `bun run build` succeeds — no more "Cannot find module 'ws'" error
- [ ] **1.5** Verify lock file is created at `~/.claude/ide/{port}.lock` when terminal opens
- [ ] **1.6** Verify lock file is deleted when terminal closes

### Phase 2: Navigation (open file + scroll)

- [ ] **2.1** Create `src/utils/NavigationUtils.ts` with `normalizeFilePath()` and `openFileAndScroll()`
- [ ] **2.2** Implement `normalizeFilePath()` to resolve absolute paths relative to vault root
- [ ] **2.3** Implement `openFileAndScroll()` using `app.workspace.openFile()` + CodeMirror cursor/scroll
- [ ] **2.4** Handle `files outside vault` case — log warning, skip navigation
- [ ] **2.5** Add `onFileMentioned(filePath, lineStart, lineEnd)` to `OpencodeTerminalView`
- [ ] **2.6** Wire up the event forwarding from main process to `onFileMentioned()`
- [ ] **2.7** Test: start terminal, simulate `at_mentioned` message, verify file opens at correct line

### Phase 3: ActiveFilesView (panel UI)

- [ ] **3.1** Add `activeFiles: Set<string>` to `OpencodeTerminalView` state
- [ ] **3.2** Create `renderActiveFilesDrawer()` method to build drawer DOM
- [ ] **3.3** Implement drawer toggle (collapse/expand) with `[−]` / `[+]` button
- [ ] **3.4** When `onFileMentioned()` is called, add file to `activeFiles` and re-render drawer
- [ ] **3.5** Implement "Clear" button — clears `activeFiles`, re-renders drawer
- [ ] **3.6** Implement clickable file chips — call `onFileMentioned()` on click (reuse existing navigation)
- [ ] **3.7** When `restartPty()` is called (new session), clear `activeFiles` and drawer
- [ ] **3.8** Test: open terminal, trigger multiple `at_mentioned`, verify files appear in drawer
- [ ] **3.9** Test: click file chip, verify navigation works
- [ ] **3.10** Test: click Clear, verify list is empty

### Phase 4: Polish

- [ ] **4.1** Clean up drawer styling to match Obsidian theme (use CSS classes from Obsidian)
- [ ] **4.2** Handle the case where file path in `at_mentioned` doesn't resolve to any vault file
- [ ] **4.3** Add `connected`/`disconnected` indicator in terminal UI (optional — green dot in drawer header)
- [ ] **4.4** Run full `bun run build` and verify no TypeScript errors
- [ ] **4.5** Test the full flow: open terminal → run opencode → verify lock file → use opencode to reference a file → verify it opens

## Task Details

### 1.1 Refactor EditorServer to EventEmitter

**File:** `src/server/EditorServer.ts`

```typescript
import { EventEmitter } from 'events';

export class EditorServer extends EventEmitter {
  // Change wss and clients to use events
  // Add emit('at-mentioned', filePath, lineStart, lineEnd) in handleMessage
  // Add emit('connected') when WebSocket server starts
  // Add emit('disconnected') when client disconnects
}
```

### 1.2 Move lifecycle to main process

**File:** `src/main.ts`

```typescript
// Add to OpenCodePlugin class:
editorServer: EditorServer | null = null;

async onload() {
  // ... existing setup ...
  
  this.editorServer = new EditorServer();
  this.editorServer.on('at-mentioned', (filePath, lineStart, lineEnd) => {
    const leaf = this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0];
    const view = leaf?.view as any;
    if (view?.onFileMentioned) {
      view.onFileMentioned(filePath, lineStart, lineEnd);
    }
  });
}

onunload() {
  this.editorServer?.stop();
  this.editorServer = null;
}
```

### 2.1 NavigationUtils

**File:** `src/utils/NavigationUtils.ts` (new)

```typescript
export function isFileInVault(filePath: string, vaultRoot: string): boolean {
  return path.isAbsolute(filePath) && filePath.startsWith(vaultRoot);
}

export function normalizeFilePath(filePath: string, vaultRoot: string): string | null {
  if (!isFileInVault(filePath, vaultRoot)) return null;
  return filePath.slice(vaultRoot.length + 1); // Remove leading /
}

export async function openFileAndScroll(
  app: App,
  file: TFile,
  lineStart: number
): Promise<void> {
  const leaf = app.workspace.getLeaf('tab');
  await leaf.openFile(file);
  
  // Wait for editor to be ready
  const waitForEditor = (resolve: () => void) => {
    const view = leaf.view as any;
    if (view?.editor) {
      const editor = view.editor;
      const targetLine = Math.max(0, lineStart - 1);
      editor.setCursor({ line: targetLine, ch: 0 });
      editor.scrollIntoView(
        { from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } },
        { center: true }
      );
      resolve();
    } else {
      setTimeout(() => waitForEditor(resolve), 50);
    }
  };
  
  return new Promise(waitForEditor);
}
```

## Verification Commands

```bash
# Build
bun run build

# Check lock file created
ls ~/.claude/ide/*.lock

# Watch console for errors
# (open Obsidian with developer tools enabled)
```

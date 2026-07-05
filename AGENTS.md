# AGENTS.md - Obsidian OpenCode Plugin

Guidelines for AI coding agents working on the obsidian-opencode plugin.

## Project Overview

Obsidian plugin that runs OpenCode inside an integrated Obsidian terminal. The terminal view starts a PTY-backed child process that executes the configured `opencode` executable with configured CLI arguments and cwd.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, Node.js child processes, xterm.js

## Build Commands

```bash
bun install          # Install dependencies
bun run build        # Production (type-check + bundle)
```

Output: `main.js` (CommonJS bundle)

## Project Structure

```
src/
├── main.ts                            # Plugin entry, commands, terminal/session activation
├── types.ts                           # Active settings and terminal keybinding types
├── ui/OpencodeTerminalView.ts         # Integrated terminal view and PTY launch
├── ui/OpencodeConversationView.ts     # Session browser/export/restore view
├── settings/OpencodeTerminalSettingTab.ts # Visible settings UI
└── server/OpencodeEnv.ts              # Environment preparation for OpenCode process
```

## Coding guidelines

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `OpenCodePlugin`, `OpencodeTerminalView` |
| Interfaces/Types | PascalCase | `OpenCodeSettings`, `ProcessState` |
| Constants | UPPER_CASE or camelCase | `DEFAULT_SETTINGS`, `OPENCODE_TERMINAL_VIEW_TYPE` |
| Variables/functions | camelCase | `getVaultPath`, `startServer` |
| Private members | camelCase (no prefix) | `private processManager` |
| Files | PascalCase (classes), lowercase (entry) | `ProcessManager.ts`, `main.ts` |

### TypeScript Patterns
- `strictNullChecks` enabled - handle null/undefined
- Union types for state: `"stopped" | "starting" | "running" | "error"`
- `async/await` over Promises
- Explicit return types on public methods

```typescript
getProcessState(): ProcessState {
  return this.processManager?.getState() ?? "stopped";
}
```

### Obsidian API Patterns
- Extend `Plugin` with `onload()`/`onunload()` lifecycle
- Extend `ItemView` for views: `getViewType()`, `onOpen()`, `onClose()`
- Extend `PluginSettingTab` for settings: `display()`
- DOM helpers: `createEl()`, `createDiv()`, `setIcon()`
- Register in `onload()`, clean up in `onunload()`

```typescript
this.registerView(OPENCODE_TERMINAL_VIEW_TYPE, (leaf) => new OpencodeTerminalView(leaf, this));
this.addCommand({ id: "open-opencode-terminal", name: "Open OpenCode Terminal", callback: () => this.activateTerminalView() });
```

### DOM Creation
```typescript
const container = this.contentEl.createDiv({ cls: "opencode-container" });
container.createEl("h3", { text: "Title" });
container.createEl("button", { text: "Click", cls: "mod-cta" });
```

### State Management
- Callback-based subscriptions
- Centralized terminal/session state in `OpenCodePlugin` and view classes
- Immediate notification on state change

## Config Summary

**tsconfig.json:** ES6 target, ESNext modules, strictNullChecks, noImplicitAny

**esbuild:** CJS format, es2018 target, node platform. Externals: obsidian, electron, CodeMirror, Node builtins

## Desktop-Only

Uses Node.js APIs unavailable on mobile:
- `child_process.spawn()` for PTY/OpenCode processes
- File system via vault adapter

Check for desktop environment before adding mobile-incompatible features.

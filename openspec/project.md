# Project Context

## Purpose
Obsidian plugin that runs the OpenCode AI assistant inside an integrated Obsidian terminal. The plugin starts a PTY-backed child process that executes the configured `opencode` executable with configured arguments and working directory, enabling AI-assisted coding and note-taking within Obsidian.

## Tech Stack
- **TypeScript** - Primary language with strict null checks
- **Obsidian Plugin API** - For UI integration, views, settings, and commands
- **esbuild** - Bundler (ES2018 target, CommonJS output)
- **Node.js child_process** - For spawning the PTY helper and OpenCode process
- **xterm.js** - Integrated terminal rendering and terminal addons
- **Bun** - Package manager and runtime

## Project Conventions

### Code Style

**Imports:**
- ES modules with named imports
- Order: Obsidian API → Node.js builtins → local modules
- Use `type` keyword for type-only imports
- Relative paths with `./` prefix

```typescript
import { Plugin, WorkspaceLeaf } from "obsidian";
import type OpenCodePlugin from "./main";
import { OpenCodeSettings, DEFAULT_SETTINGS } from "./types";
```

**Naming Conventions:**
| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `OpenCodePlugin`, `OpencodeTerminalView` |
| Interfaces/Types | PascalCase | `OpenCodeSettings`, `ProcessState` |
| Constants | UPPER_CASE or camelCase | `DEFAULT_SETTINGS`, `OPENCODE_TERMINAL_VIEW_TYPE` |
| Variables/functions | camelCase | `getVaultPath`, `startServer` |
| Private members | camelCase (no prefix) | `private processManager` |
| Files | PascalCase for classes | `OpencodeTerminalView.ts`, `OpencodeConversationView.ts` |

**TypeScript Patterns:**
- `strictNullChecks` enabled - always handle null/undefined
- Union types for state: `"stopped" | "starting" | "running" | "error"`
- `async/await` over raw Promises
- Explicit return types on public methods

### Architecture Patterns

**Project Structure:**
```
src/
├── main.ts                            # Plugin entry, commands, terminal/session activation
├── types.ts                           # Active settings and terminal keybinding types
├── ui/OpencodeTerminalView.ts         # Integrated terminal view and PTY launch
├── ui/OpencodeConversationView.ts     # Session browser/export/restore view
├── ui/TerminalDrop.ts                 # Drag/drop text handling for terminal input
├── settings/OpencodeTerminalSettingTab.ts # Visible settings UI
├── server/OpencodeEnv.ts              # Environment preparation for OpenCode
└── server/EditorServer.ts             # Editor transport lock/server for OpenCode integration
```

**Obsidian Patterns:**
- Extend `Plugin` with `onload()`/`onunload()` lifecycle
- Extend `ItemView` for views: `getViewType()`, `onOpen()`, `onClose()`
- Extend `PluginSettingTab` for settings: `display()`
- DOM helpers: `createEl()`, `createDiv()`, `setIcon()`
- Register in `onload()`, clean up in `onunload()`

**State Management:**
- Callback-based subscriptions for state changes
- Terminal/session launch state is kept in `OpenCodePlugin` (`pendingPrompt`, `sessionArgs`, `sessionCwd`) and consumed by `OpencodeTerminalView`
- Immediate notification on state change via callbacks

**Error Handling:**
- try/catch for async operations
- `console.error()` for debugging
- `new Notice()` for user-facing errors
- Boolean returns for success/failure
- Silent catch for non-critical ops (health checks)

### Testing Strategy
- Use Bun's test runner for tests under `tests/`
- `bun run build` performs TypeScript checking and bundling

### Git Workflow
Standard feature branch workflow. Commit messages should be concise and describe the change.

## Domain Context

**OpenCode Terminal:**
- OpenCode is an AI assistant CLI run directly in an integrated terminal
- `OpencodeTerminalView` starts a PTY helper and executes `opencode` with configured args
- `OpenCode path` controls the executable, defaulting to `opencode`
- `Default working directory` controls cwd, falling back to the vault root when empty
- `New session arguments` are appended for normal new sessions
- `Continue Last OpenCode Session` starts the terminal with `-c`
- Restoring a conversation starts the terminal with `-s <sessionId>` and the session cwd
- `getOpencodeEnv()` augments PATH and default PNPM/FNM variables before spawning

**Obsidian Integration:**
- Terminal view is registered with `OPENCODE_TERMINAL_VIEW_TYPE`
- Conversation browser is registered with `OPENCODE_CONVERSATION_VIEW_TYPE`
- Views open in the right sidebar
- `startServer()` is a compatibility shim that activates the terminal view; it does not start `opencode serve`

**Legacy Server/Iframe Code:**
- Older versions used `opencode serve` and an iframe, with settings such as `port`, `hostname`, `autoStart`, `defaultViewLocation`, `injectWorkspaceContext`, `customCommand`, and `useCustomCommand`
- Those settings are not active in the current terminal workflow and should not be documented as visible/current options

## Important Constraints

**Desktop Only:**
- Uses Node.js APIs (`child_process.spawn()`) unavailable on mobile
- The current PTY implementation is Unix-oriented; Windows is not implemented in `OpencodeTerminalView`
- File system access via vault adapter requires desktop
- Check for desktop environment before adding mobile-incompatible features

**Build Output:**
- Must produce `dist/main.js` (CommonJS format), `dist/manifest.json`, and `dist/styles.css`
- External: `obsidian`, `electron`, CodeMirror modules, Node.js builtins

**TypeScript Config:**
- Target: ES6
- Module: ESNext (bundled to CJS)
- Strict null checks enabled
- No implicit any

## External Dependencies

**Runtime:**
- OpenCode CLI must be installed on user's system (configurable path)
- No OpenCode server port/hostname is required for the current workflow

**Development:**
- `obsidian` - Obsidian API types and runtime
- `@types/node` - Node.js type definitions
- `esbuild` - Build bundler
- `typescript` - Type checking

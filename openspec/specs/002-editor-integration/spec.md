## Editor Integration Requirements

### Requirement: EditorServer Lifecycle in Main Process
The plugin SHALL run the EditorServer WebSocket transport in the main process, not the renderer, to ensure the `ws` module can be resolved correctly.

#### Scenario: EditorServer starts with terminal
- **WHEN** the terminal view opens (`onOpen()`)
- **THEN** the plugin starts `EditorServer` in the main process
- **AND** the server binds to a random available port
- **AND** a lock file is written to `~/.claude/ide/{port}.lock` with content:
  ```json
  { "transport": "ws", "workspaceFolders": ["/absolute/path/to/vault"] }
  ```

#### Scenario: EditorServer stops with terminal
- **WHEN** the terminal view closes (`onClose()`)
- **THEN** the plugin stops `EditorServer`
- **AND** the lock file is deleted
- **AND** all WebSocket clients are terminated

#### Scenario: at_mentioned navigation
- **WHEN** OpenCode sends a JSON-RPC message with `method: "at_mentioned"` and params `{ filePath, lineStart, lineEnd }`
- **THEN** the plugin receives the `at-mentioned` event from EditorServer
- **AND** if the file is inside the vault, the file is opened in a new tab
- **AND** the cursor is positioned at `lineStart` (1-indexed, converted to 0-indexed)
- **AND** the editor scrolls to center that line
- **AND** the file is added to the active files list

#### Scenario: File outside vault
- **WHEN** OpenCode sends `at_mentioned` for a file outside the vault
- **THEN** the plugin logs a warning
- **AND** does not attempt to open the file

### Requirement: Active Files Panel
The plugin SHALL display a panel showing all files mentioned by OpenCode during the current terminal session.

#### Scenario: Panel shows mentioned files
- **WHEN** OpenCode sends `at_mentioned` for a file inside the vault
- **THEN** the file is added to the active files list
- **AND** the panel (drawer at bottom of terminal) updates to show the file chip

#### Scenario: Panel file chip navigation
- **WHEN** the user clicks a file chip in the active files panel
- **THEN** the plugin navigates to that file and scrolls to `lineStart`
- **AND** the cursor is positioned correctly

#### Scenario: Panel clear
- **WHEN** the user clicks "Clear" in the active files panel
- **THEN** the active files list is emptied
- **AND** the drawer updates to show an empty state

#### Scenario: Panel clears on new session
- **WHEN** the user starts a new terminal session (via `New OpenCode Session` or `restartPty`)
- **THEN** the active files list is cleared
- **AND** the drawer resets to empty

#### Scenario: Panel collapsible drawer
- **WHEN** the user clicks the collapse `[−]` button on the active files drawer
- **THEN** the drawer collapses to a minimal header
- **AND** clicking expand `[+]` restores the full drawer

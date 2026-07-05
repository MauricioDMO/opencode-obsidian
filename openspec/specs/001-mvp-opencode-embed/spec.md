## ADDED Requirements

### Requirement: Integrated Terminal Launch
The plugin SHALL run OpenCode inside an integrated Obsidian terminal rather than requiring `opencode serve` or an iframe.

#### Scenario: Terminal view activation
- **WHEN** the user clicks the terminal ribbon icon or runs `Open OpenCode Terminal`
- **THEN** the plugin opens or reveals the `opencode-terminal` ItemView in the right sidebar
- **AND** the view renders an xterm.js terminal

#### Scenario: PTY process spawn
- **WHEN** the terminal view opens
- **THEN** the plugin starts a PTY-backed child process
- **AND** executes the configured `OpenCode path` value, defaulting to `opencode`
- **AND** passes configured new-session arguments for a normal launch
- **AND** uses the configured default working directory, or the vault root if the setting is empty

#### Scenario: Environment preparation
- **WHEN** the OpenCode process is spawned
- **THEN** the plugin prepares the environment with `getOpencodeEnv()`
- **AND** augments `PATH` with common user-level OpenCode, pnpm, bun, cargo, system, and fnm Node directories
- **AND** sets default `PNPM_HOME` and `FNM_DIR` values when they are missing

### Requirement: Session Commands
The plugin SHALL provide commands for starting fresh sessions, continuing the last session, and restoring known sessions.

#### Scenario: New session command
- **WHEN** the user runs `New OpenCode Session`
- **THEN** the plugin opens or restarts the terminal
- **AND** launches OpenCode without forced session flags

#### Scenario: Continue last session command
- **WHEN** the user runs `Continue Last OpenCode Session`
- **THEN** the plugin opens or restarts the terminal
- **AND** launches OpenCode with `-c`

#### Scenario: Restore conversation in terminal
- **WHEN** the user opens the conversations view and clicks `Restore in Terminal`
- **THEN** the plugin opens or restarts the terminal
- **AND** launches OpenCode with `-s <sessionId>`
- **AND** uses the restored session's recorded working directory

### Requirement: Conversation Browser
The plugin SHALL provide an Obsidian view for listing, inspecting, exporting, restoring, and deleting OpenCode sessions.

#### Scenario: Conversation view activation
- **WHEN** the user clicks the conversations ribbon icon or runs `Open OpenCode Conversations`
- **THEN** the plugin opens or reveals the `opencode-conversations` ItemView in the right sidebar
- **AND** lists sessions from the OpenCode CLI using the configured executable and cwd

#### Scenario: Export session to note
- **WHEN** the user selects a session and clicks `Export to Note`
- **THEN** the plugin exports the session content through the OpenCode CLI
- **AND** writes or updates a Markdown note under `OpenCode/`

### Requirement: Visible Settings
The plugin SHALL expose settings that are active in the integrated terminal workflow.

#### Scenario: OpenCode path setting
- **WHEN** the user configures `OpenCode path`
- **THEN** the value is used as the executable for terminal sessions and conversation CLI operations

#### Scenario: Default working directory setting
- **WHEN** the user configures `Default working directory`
- **THEN** the value is used as the cwd for new terminal sessions and conversation CLI operations
- **AND** an empty value falls back to the vault root

#### Scenario: New session arguments setting
- **WHEN** the user configures `New session arguments`
- **THEN** the whitespace-separated arguments are added when starting a normal terminal session

#### Scenario: Terminal presentation settings
- **WHEN** the user configures terminal font size, font family, or keybindings
- **THEN** the integrated terminal uses those values on the next render or key event

### Requirement: Legacy Server Flow Is Not Current
The current plugin SHALL NOT document `opencode serve`, iframe embedding, server port/hostname, CORS, auto-start server, custom command mode, or workspace context injection as active primary behavior.

#### Scenario: Server compatibility shim
- **WHEN** legacy code calls `startServer()` on the plugin
- **THEN** the method activates the integrated terminal view
- **AND** does not spawn `opencode serve`
- **AND** does not use port, hostname, or CORS settings

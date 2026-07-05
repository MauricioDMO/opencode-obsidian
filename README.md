# OpenCode plugin for Obsidian

Run [OpenCode](https://opencode.ai) inside Obsidian using an integrated terminal.

<img src="./assets/opencode_in_obsidian.png" alt="OpenCode in Obsidian" />

**Use cases:**
- Summarize and distill long-form content
- Draft, edit, and refine your writing
- Query and explore your knowledge base
- Generate outlines and structured notes

The plugin starts the OpenCode CLI in an Obsidian sidebar terminal. It does not require `opencode serve`, an iframe, a local web server port, or `--cors app://obsidian.md` for its main workflow.

_Note: plugin author is not affiliated with OpenCode or Obsidian - this is 3rd party software._

This repository is maintained by MauricioDMO as a fork of the upstream [mtymek/opencode-obsidian](https://github.com/mtymek/opencode-obsidian) project.

## Requirements

- Desktop only (uses Node.js child processes and a PTY)
- macOS or Linux for the integrated PTY terminal
- [OpenCode CLI](https://opencode.ai) installed
- [Bun](https://bun.sh) installed for development

## Installation

### For Users (BRAT - Recommended for Beta Testing)

The easiest way to install this plugin during beta is via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewer's Auto-update Tool):

1. Install the BRAT plugin from Obsidian Community Plugins
2. Open BRAT settings and click "Add Beta plugin"
3. Enter: `MauricioDMO/opencode-obsidian`
4. Click "Add Plugin" - BRAT will install the latest release automatically
5. Enable the OpenCode plugin in Obsidian Settings > Community Plugins

BRAT will automatically check for updates and notify you when new versions are available.

### For Developers

If you want to contribute or develop the plugin:

1. Clone to `.obsidian/plugins/obsidian-opencode` under your vault root:
   ```bash
   git clone https://github.com/MauricioDMO/opencode-obsidian.git .obsidian/plugins/obsidian-opencode
   ```
2. Install dependencies and build:
   ```bash
   bun install && bun run build
   ```
3. Enable in Obsidian Settings > Community Plugins
4. Add `AGENTS.md` to your workspace root to guide the AI assistant if desired

## Usage

- Click the terminal ribbon icon to open the OpenCode terminal.
- Run the `Open OpenCode Terminal` command to open the terminal view.
- Run the `Toggle OpenCode Terminal in Sidebar` command to reveal the right sidebar and open/reveal the terminal there.
- Run `New OpenCode Session` to restart the terminal with a fresh OpenCode session.
- Run `Continue Last OpenCode Session` to restart the terminal with `opencode -c`.
- Click the conversations ribbon icon or run `Open OpenCode Conversations` to browse previous OpenCode sessions.

When the terminal view opens, `src/ui/OpencodeTerminalView.ts` starts a PTY-backed process. The process runs the configured OpenCode executable with the configured arguments and working directory.

Opening a previous conversation with **Restore in Terminal** restarts the terminal with `opencode -s <sessionId>` and uses that session's recorded working directory.

## Settings

The visible settings are defined in `src/settings/OpencodeTerminalSettingTab.ts`.

- **OpenCode path**: executable to run. Leave as `opencode` to resolve it from `PATH`, or set an absolute path if Obsidian cannot find it.
- **Default working directory**: cwd for new OpenCode terminal sessions. Leave empty to use the vault root.
- **Terminal font size**: font size for the integrated terminal.
- **Terminal font family**: font family for the integrated terminal.
- **Terminal keybindings**: configurable terminal shortcut handling, such as paste and word deletion.
- **New session arguments**: extra CLI arguments added when the terminal starts a normal new session, for example `--model provider/model`.

The plugin prepares the spawned process environment with `getOpencodeEnv()` from `src/server/OpencodeEnv.ts`. That helper augments `PATH` and default `PNPM_HOME`/`FNM_DIR` values so OpenCode and Node-based runtimes installed through common user-level package managers can be found from Obsidian's Electron process.

## Legacy Settings

Older versions used an `opencode serve` + iframe workflow. Settings such as `port`, `hostname`, `autoStart`, `defaultViewLocation`, `projectDirectory`, `injectWorkspaceContext`, `customCommand`, and `useCustomCommand` belonged to that legacy path and are not part of the current visible terminal settings.

Do not configure `opencode serve --cors app://obsidian.md` for the current workflow.

## Windows Status

The current integrated PTY terminal is not implemented on Windows. The plugin will show an unsupported notice instead of starting OpenCode there.

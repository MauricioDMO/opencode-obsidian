import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, FileSystemAdapter, MarkdownView, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, OpenCodeSettings } from "./types";
import { OpencodeTerminalSettingTab } from "./settings/OpencodeTerminalSettingTab";
import { OpencodeTerminalView, OPENCODE_TERMINAL_VIEW_TYPE } from "./ui/OpencodeTerminalView";
import { OpencodeConversationView, OPENCODE_CONVERSATION_VIEW_TYPE } from "./ui/OpencodeConversationView";

interface OpencodeSuggestion {
  label: string;
  description: string;
}

class OpencodeEditorSuggest extends EditorSuggest<OpencodeSuggestion> {
  constructor(private plugin: OpenCodePlugin) {
    super(plugin.app);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: any): EditorSuggestContext | null {
    const line = editor.getLine(cursor.line);
    const textBeforeCursor = line.substring(0, cursor.ch);
    const match = textBeforeCursor.match(/@opencode\s(.*)$/);

    if (!match) {
      return null;
    }

    return {
      start: { line: cursor.line, ch: cursor.ch - match[0].length },
      end: cursor,
      query: match[1],
      editor,
      file,
    };
  }

  getSuggestions(context: EditorSuggestContext): OpencodeSuggestion[] {
    return [{ label: "Send to OpenCode", description: context.query || "Type your prompt..." }];
  }

  renderSuggestion(suggestion: OpencodeSuggestion, el: HTMLElement): void {
    el.createEl("div", { cls: "opencode-suggest-title", text: suggestion.label });
    if (suggestion.description) {
      el.createEl("small", { cls: "opencode-suggest-desc", text: suggestion.description });
    }
  }

  selectSuggestion(): void {
    const context = this.context;
    if (!context) {
      return;
    }

    const { editor, start, end } = context;
    const fullLine = editor.getLine(start.line);
    const beforeTrigger = fullLine.substring(0, start.ch);
    const afterTrigger = fullLine.substring(end.ch);
    const promptText = fullLine.substring(start.ch, end.ch).replace(/^@opencode\s*/, "").trim();
    editor.replaceRange(beforeTrigger.trimEnd() + afterTrigger, { line: start.line, ch: 0 }, { line: start.line, ch: fullLine.length });

    if (promptText) {
      this.plugin.pendingPrompt = promptText;
      void this.plugin.newSession();
    }

    this.close();
  }
}

export default class OpenCodePlugin extends Plugin {
  settings: OpenCodeSettings = DEFAULT_SETTINGS;
  vaultRoot = "";
  vaultConfigDir = "";
  pendingPrompt: string | null = null;
  sessionArgs: string[] | null = null;
  sessionCwd: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    if (this.app.vault.adapter instanceof FileSystemAdapter) {
      this.vaultRoot = this.app.vault.adapter.getBasePath();
    } else {
      this.vaultRoot = "/";
    }
    this.vaultConfigDir = this.app.vault.configDir;

    this.registerView(OPENCODE_TERMINAL_VIEW_TYPE, (leaf) => new OpencodeTerminalView(leaf, this));
    this.registerView(OPENCODE_CONVERSATION_VIEW_TYPE, (leaf) => new OpencodeConversationView(leaf, this));

    this.addRibbonIcon("terminal", "OpenCode Terminal", () => {
      void this.activateTerminalView();
    });
    this.addRibbonIcon("message-circle", "OpenCode Conversations", () => {
      void this.activateConversationView();
    });

    this.addCommand({
      id: "open-opencode-terminal",
      name: "Open OpenCode Terminal",
      callback: () => void this.activateTerminalView(),
    });
    this.addCommand({
      id: "toggle-opencode-terminal-sidebar",
      name: "Toggle OpenCode Terminal in Sidebar",
      callback: () => void this.toggleTerminalSidebar(),
    });
    this.addCommand({
      id: "open-opencode-conversations",
      name: "Open OpenCode Conversations",
      callback: () => void this.activateConversationView(),
    });
    this.addCommand({
      id: "new-opencode-session",
      name: "New OpenCode Session",
      callback: () => void this.newSession(),
    });
    this.addCommand({
      id: "continue-last-opencode-session",
      name: "Continue Last OpenCode Session",
      callback: () => void this.continueLastSession(),
    });

    this.addSettingTab(new OpencodeTerminalSettingTab(this.app, this));
    this.registerEditorSuggest(new OpencodeEditorSuggest(this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(OPENCODE_CONVERSATION_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateTerminalView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: OPENCODE_TERMINAL_VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async activateConversationView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(OPENCODE_CONVERSATION_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: OPENCODE_CONVERSATION_VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async toggleTerminalSidebar(): Promise<void> {
    const { workspace } = this.app;
    const rightSplit = (workspace as any).rightSplit;
    const isCollapsed = rightSplit?.collapsed ?? true;

    if (isCollapsed) {
      rightSplit?.toggle();
    }

    let leaf = workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0];
    if (!leaf) {
      const newLeaf = workspace.getRightLeaf(false);
      if (newLeaf) {
        leaf = newLeaf;
        await leaf.setViewState({ type: OPENCODE_TERMINAL_VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async newSession(): Promise<void> {
    this.sessionArgs = [];
    this.sessionCwd = null;
    await this.openOrRestartTerminal();
  }

  async continueLastSession(): Promise<void> {
    this.sessionArgs = ["-c"];
    this.sessionCwd = null;
    await this.openOrRestartTerminal();
  }

  async openTerminalWithSession(sessionId: string, directory: string): Promise<void> {
    this.sessionArgs = ["-s", sessionId];
    this.sessionCwd = directory;
    await this.openOrRestartTerminal();
  }

  async openOrRestartTerminal(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | undefined = workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0];

    if (leaf) {
      const view = leaf.view as any;
      if (view && typeof view.restartPty === "function") {
        view.restartPty();
      }
      workspace.revealLeaf(leaf);
      return;
    }

    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({ type: OPENCODE_TERMINAL_VIEW_TYPE, active: true });
      workspace.revealLeaf(rightLeaf);
    }
  }

  async startServer(): Promise<boolean> {
    await this.activateTerminalView();
    return true;
  }
}

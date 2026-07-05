import { ItemView, moment, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { OpencodeCliClient } from "../client/OpencodeCliClient";

export const OPENCODE_CONVERSATION_VIEW_TYPE = "opencode-conversations";

export class OpencodeConversationView extends ItemView {
  private sessions: any[] = [];
  private listContainer: HTMLElement | null = null;
  private detailContainer: HTMLElement | null = null;
  private client: OpencodeCliClient;

  constructor(leaf: WorkspaceLeaf, private plugin: any) {
    super(leaf);
    const cwd = this.plugin.settings.defaultWorkingDirectory || this.plugin.vaultRoot;
    this.client = new OpencodeCliClient(plugin.settings.opencodePath, cwd);
  }

  getViewType(): string {
    return OPENCODE_CONVERSATION_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "OpenCode Conversations";
  }

  getIcon(): string {
    return "message-circle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.querySelector(".view-content") as HTMLElement || this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("opencode-conversation-container");

    const header = container.createEl("div", { cls: "opencode-conversation-header" });
    header.createEl("h3", { text: "OpenCode Sessions" });
    const refreshBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "Refresh sessions" },
    });
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", () => void this.loadSessions());

    const main = container.createEl("div", { cls: "opencode-conversation-main" });
    this.listContainer = main.createEl("div", { cls: "opencode-session-list" });
    this.detailContainer = main.createEl("div", { cls: "opencode-session-detail" });

    await this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    if (!this.listContainer) {
      return;
    }

    this.listContainer.empty();
    this.listContainer.createEl("div", { cls: "opencode-loading", text: "Loading sessions..." });
    const cwd = this.plugin.settings.defaultWorkingDirectory || this.plugin.vaultRoot;
    this.client = new OpencodeCliClient(this.plugin.settings.opencodePath, cwd);
    this.sessions = await this.client.listSessions();
    this.listContainer.empty();

    if (this.sessions.length === 0) {
      this.listContainer.createEl("div", { cls: "opencode-empty", text: "No sessions found." });
      return;
    }

    const sorted = [...this.sessions].sort((a, b) => b.updated - a.updated);
    for (const session of sorted) {
      const item = this.listContainer.createEl("div", { cls: "opencode-session-item" });
      item.createEl("div", { cls: "opencode-session-title", text: session.title || "Untitled" });
      const meta = item.createEl("div", { cls: "opencode-session-meta" });
      meta.createEl("span", { text: moment(session.updated).format("YYYY-MM-DD HH:mm") });
      meta.createEl("span", { cls: "opencode-session-dir", text: session.directory });
      item.addEventListener("click", async () => {
        this.listContainer?.querySelectorAll(".opencode-session-item").forEach((el) => el.removeClass("is-active"));
        item.addClass("is-active");
        await this.showSessionDetail(session);
      });
    }
  }

  async showSessionDetail(session: any): Promise<void> {
    if (!this.detailContainer) {
      return;
    }

    this.detailContainer.empty();
    this.detailContainer.createEl("h4", { text: session.title || "Untitled" });
    const actions = this.detailContainer.createEl("div", { cls: "opencode-session-actions" });
    actions.createEl("button", { text: "Restore in Terminal", cls: "mod-cta" }).addEventListener("click", () => {
      void this.plugin.openTerminalWithSession(session.id, session.directory);
    });
    actions.createEl("button", { text: "Export to Note" }).addEventListener("click", () => void this.exportSessionToNote(session));
    actions.createEl("button", { text: "Delete", cls: "mod-warning" }).addEventListener("click", async () => {
      if (confirm(`Delete session "${session.title}"? This cannot be undone.`)) {
        const ok = await this.client.deleteSession(session.id);
        if (ok) {
          new Notice("Session deleted");
          await this.loadSessions();
          this.detailContainer?.empty();
        }
      }
    });

    this.detailContainer.createEl("div", { cls: "opencode-loading", text: "Loading conversation..." });
    const data = await this.client.exportSession(session.id);
    this.detailContainer.querySelector(".opencode-loading")?.remove();

    if (!data) {
      this.detailContainer.createEl("div", { cls: "opencode-error", text: "Failed to load conversation." });
      return;
    }

    this.renderSession(data);
  }

  async exportSessionToNote(session: any): Promise<void> {
    const data = await this.client.exportSession(session.id);
    if (!data) {
      new Notice("Failed to export session");
      return;
    }

    const folder = "OpenCode";
    const fileName = `${folder}/${(session.title || session.id).replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_ ]/g, "_")}.md`;

    try {
      await this.app.vault.createFolder(folder);
    } catch {
      // Folder already exists.
    }

    const content = this.formatSessionNote(session, data);
    const existing = this.app.vault.getAbstractFileByPath(fileName);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      new Notice(`Updated ${fileName}`);
    } else {
      const file = await this.app.vault.create(fileName, content);
      new Notice(`Created ${file.name}`);
    }
  }

  private renderSession(data: any): void {
    if (!this.detailContainer) {
      return;
    }

    const info = this.detailContainer.createEl("div", { cls: "opencode-session-info" });
    info.createEl("div", { text: `Model: ${data.info?.model?.id || "unknown"}` });
    info.createEl("div", { text: `Agent: ${data.info?.agent || "default"}` });
    info.createEl("div", { text: `Cost: $${(data.info?.cost || 0).toFixed(4)}` });

    const messages = this.detailContainer.createEl("div", { cls: "opencode-messages" });
    for (const msg of data.messages || []) {
      const role = msg.info.role || "unknown";
      const roleLabel = role === "user" ? "Tú" : role === "assistant" ? "IA" : role;
      const msgEl = messages.createEl("div", { cls: `opencode-message opencode-message-${role}` });
      const header = msgEl.createEl("div", { cls: "opencode-message-header" });
      header.createEl("span", { cls: "opencode-message-role", text: roleLabel });
      const headerActions = header.createEl("div", { cls: "opencode-message-header-actions" });
      const messageText = this.getMessageText(msg.parts || []);
      if (messageText) {
        headerActions.createEl("button", { cls: "opencode-message-copy", text: "Copiar" }).addEventListener("click", async (event) => {
          event.stopPropagation();
          try {
            await navigator.clipboard.writeText(messageText);
            new Notice("Mensaje copiado");
          } catch {
            new Notice("No se pudo copiar el mensaje");
          }
        });
      }
      headerActions.createEl("span", { cls: "opencode-message-time", text: moment(msg.info.time.created).format("HH:mm:ss") });
      const body = msgEl.createEl("div", { cls: "opencode-message-body" });
      this.renderParts(body, msg.parts || []);
    }
  }

  private getMessageText(parts: any[]): string {
    return parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n\n")
      .trim();
  }

  private renderParts(container: HTMLElement, parts: any[]): void {
    for (const part of parts) {
      if (part.type === "text" && part.text) {
        container.createEl("div", { cls: "opencode-message-text" }).innerText = part.text;
      } else if (part.type === "step-start") {
        container.createEl("div", { cls: "opencode-message-step", text: "[thinking...]" });
      } else if (part.type === "tool-call") {
        container.createEl("div", { cls: "opencode-message-tool", text: `[tool: ${part.name || part.type}]` });
      }
    }
  }

  private formatSessionNote(session: any, data: any): string {
    let content = "---\n";
    content += `opencode-session: ${session.id}\n`;
    content += `opencode-model: ${data.info?.model?.id || "unknown"}\n`;
    content += `opencode-agent: ${data.info?.agent || "default"}\n`;
    content += `opencode-cost: ${data.info?.cost || 0}\n`;
    content += `opencode-created: ${moment(data.info?.time?.created).format("YYYY-MM-DD HH:mm:ss")}\n`;
    content += `opencode-updated: ${moment(data.info?.time?.updated).format("YYYY-MM-DD HH:mm:ss")}\n`;
    content += "---\n\n";
    content += `# ${session.title}\n\n`;

    for (const msg of data.messages || []) {
      content += `## ${msg.info.role === "assistant" ? "Assistant" : "User"}\n\n`;
      for (const part of msg.parts || []) {
        if (part.type === "text" && part.text) {
          content += `${part.text}\n\n`;
        } else if (part.type === "step-start") {
          content += "*(thinking...)*\n\n";
        } else if (part.type === "tool-call") {
          content += "*(tool call)*\n\n";
        }
      }
    }

    return content;
  }
}

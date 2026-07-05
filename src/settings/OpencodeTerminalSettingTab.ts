import { App, PluginSettingTab, Setting } from "obsidian";
import OpenCodePlugin from "../main";
import { TerminalKeybindingAction } from "../types";

const TERMINAL_KEYBINDING_ACTIONS: Record<TerminalKeybindingAction, string> = {
  paste: "Paste",
  killWordForward: "Delete word forward",
  killWordBackward: "Delete word backward",
  disabled: "Disabled",
};

export class OpencodeTerminalSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: OpenCodePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "OpenCode Settings" });

    new Setting(containerEl)
      .setName("OpenCode path")
      .setDesc("Path to the opencode executable. Leave as 'opencode' to use PATH.")
      .addText((text) => text.setPlaceholder("opencode").setValue(this.plugin.settings.opencodePath).onChange(async (value) => {
        this.plugin.settings.opencodePath = value || "opencode";
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Default working directory")
      .setDesc("Default directory to start opencode in. Leave empty to use the vault root.")
      .addText((text) => text.setPlaceholder("/path/to/project").setValue(this.plugin.settings.defaultWorkingDirectory).onChange(async (value) => {
        this.plugin.settings.defaultWorkingDirectory = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Terminal font size")
      .setDesc("Font size for the integrated terminal.")
      .addSlider((slider) => slider.setLimits(8, 32, 1).setValue(this.plugin.settings.terminalFontSize).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.terminalFontSize = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Terminal font family")
      .setDesc("Font family for the integrated terminal.")
      .addText((text) => text.setPlaceholder("monospace").setValue(this.plugin.settings.terminalFontFamily).onChange(async (value) => {
        this.plugin.settings.terminalFontFamily = value || "monospace";
        await this.plugin.saveSettings();
      }));

    containerEl.createEl("h3", { text: "Terminal keybindings" });
    for (const [chord, action] of Object.entries(this.plugin.settings.terminalKeybindings)) {
      this.addTerminalKeybindingSetting(containerEl, chord, action);
    }

    new Setting(containerEl)
      .setName("Add terminal keybinding")
      .setDesc("Use lowercase chords like ctrl+v, ctrl+delete, or ctrl+shift+v.")
      .addButton((button) => button.setButtonText("Add").onClick(async () => {
        const chord = this.getNewKeybindingChord();
        this.plugin.settings.terminalKeybindings[chord] = "disabled";
        await this.plugin.saveSettings();
        this.display();
      }));

    new Setting(containerEl)
      .setName("New session arguments")
      .setDesc("Additional arguments to pass when starting a new opencode session (e.g. --model provider/model).")
      .addText((text) => text.setPlaceholder("--model opencode-go/kimi-k2.6").setValue(this.plugin.settings.newSessionArgs).onChange(async (value) => {
        this.plugin.settings.newSessionArgs = value;
        await this.plugin.saveSettings();
      }));
  }

  private addTerminalKeybindingSetting(
    containerEl: HTMLElement,
    initialChord: string,
    initialAction: TerminalKeybindingAction
  ): void {
    let currentChord = initialChord;

    new Setting(containerEl)
      .setName("Terminal shortcut")
      .setDesc("Chord text is normalized to lowercase, for example ctrl+v.")
      .addText((text) => text
        .setPlaceholder("ctrl+v")
        .setValue(initialChord)
        .onChange(async (value) => {
          const nextChord = this.normalizeChordInput(value);
          if (!nextChord || nextChord === currentChord) {
            return;
          }

          const action = this.plugin.settings.terminalKeybindings[currentChord] ?? initialAction;
          delete this.plugin.settings.terminalKeybindings[currentChord];
          this.plugin.settings.terminalKeybindings[nextChord] = action;
          currentChord = nextChord;
          await this.plugin.saveSettings();
        }))
      .addDropdown((dropdown) => {
        for (const [action, actionLabel] of Object.entries(TERMINAL_KEYBINDING_ACTIONS)) {
          dropdown.addOption(action, actionLabel);
        }

        dropdown
          .setValue(initialAction)
          .onChange(async (value) => {
            this.plugin.settings.terminalKeybindings[currentChord] = value as TerminalKeybindingAction;
            await this.plugin.saveSettings();
          });
      })
      .addButton((button) => button.setButtonText("Remove").onClick(async () => {
        delete this.plugin.settings.terminalKeybindings[currentChord];
        await this.plugin.saveSettings();
        this.display();
      }));
  }

  private normalizeChordInput(value: string): string {
    return value
      .split("+")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .join("+");
  }

  private getNewKeybindingChord(): string {
    const candidates = ["ctrl+shift+v", "ctrl+shift+p", "ctrl+shift+k"];
    for (const chord of candidates) {
      if (!this.plugin.settings.terminalKeybindings[chord]) {
        return chord;
      }
    }

    let charCode = "a".charCodeAt(0);
    let chord = `ctrl+alt+${String.fromCharCode(charCode)}`;
    while (this.plugin.settings.terminalKeybindings[chord]) {
      charCode += 1;
      chord = `ctrl+alt+${String.fromCharCode(charCode)}`;
    }
    return chord;
  }
}

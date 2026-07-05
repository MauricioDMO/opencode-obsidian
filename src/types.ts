export type TerminalKeybindingAction =
  | "paste"
  | "killWordForward"
  | "killWordBackward"
  | "disabled";

export type TerminalKeybindings = Record<string, TerminalKeybindingAction>;

export interface OpenCodeSettings {
  defaultWorkingDirectory: string;
  terminalFontSize: number;
  terminalFontFamily: string;
  terminalKeybindings: TerminalKeybindings;
  newSessionArgs: string;
  opencodePath: string;
}

export const DEFAULT_SETTINGS: OpenCodeSettings = {
  defaultWorkingDirectory: "",
  terminalFontSize: 12,
  terminalFontFamily: "monospace",
  terminalKeybindings: {
    "ctrl+v": "paste",
    "ctrl+delete": "killWordForward",
    "ctrl+backspace": "killWordBackward",
  },
  newSessionArgs: "",
  opencodePath: "opencode",
};

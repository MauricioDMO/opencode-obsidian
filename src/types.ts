export type ViewLocation = "sidebar" | "main";

export interface OpenCodeSettings {
  defaultWorkingDirectory: string;
  terminalFontSize: number;
  terminalFontFamily: string;
  newSessionArgs: string;
  port: number;
  hostname: string;
  autoStart: boolean;
  opencodePath: string;
  projectDirectory: string;
  startupTimeout: number;
  defaultViewLocation: ViewLocation;
  injectWorkspaceContext: boolean;
  maxNotesInContext: number;
  maxSelectionLength: number;
  customCommand: string;
  useCustomCommand: boolean;
}

export const DEFAULT_SETTINGS: OpenCodeSettings = {
  defaultWorkingDirectory: "",
  terminalFontSize: 12,
  terminalFontFamily: "monospace",
  newSessionArgs: "",
  port: 14096,
  hostname: "127.0.0.1",
  autoStart: false,
  opencodePath: "opencode",
  projectDirectory: "",
  startupTimeout: 45000,
  defaultViewLocation: "sidebar",
  injectWorkspaceContext: false,
  maxNotesInContext: 20,
  maxSelectionLength: 2000,
  customCommand: "",
  useCustomCommand: false,
};

export const OPENCODE_VIEW_TYPE = "opencode-view";

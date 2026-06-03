import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { ChildProcess, spawn } from "child_process";
import { getOpencodeEnv } from "../server/OpencodeEnv";
import { EditorServer } from "../server/EditorServer";
import { handleTerminalDrop } from "./TerminalDrop";

export const OPENCODE_TERMINAL_VIEW_TYPE = "opencode-terminal";

const UNIX_PSEUDOTERMINAL_PY = `
import sys
from os import execvp, read, write, waitpid, waitstatus_to_exitcode
from fcntl import ioctl
from pty import fork
from termios import TIOCSWINSZ
from struct import pack
from selectors import DefaultSelector, EVENT_READ

_CHUNK_SIZE = 1024
_CMDIO = 3

def write_all(fd, data):
    while data:
        data = data[write(fd, data):]

def main():
    pid, pty_fd = fork()
    if pid == 0:
        execvp(sys.argv[1], sys.argv[1:])

    with DefaultSelector() as selector:
        selector.register(pty_fd, EVENT_READ, lambda: forward_pty(pty_fd))
        selector.register(0, EVENT_READ, lambda: forward_stdin(pty_fd))
        selector.register(_CMDIO, EVENT_READ, lambda: handle_resize(pty_fd))

        while True:
            events = selector.select()
            for key, _ in events:
                key.data()

    waitstatus_to_exitcode(waitpid(pid, 0)[1])

def forward_pty(pty_fd):
    try:
        data = read(pty_fd, _CHUNK_SIZE)
    except OSError:
        data = b""
    if not data:
        sys.exit(0)
    write_all(1, data)

def forward_stdin(pty_fd):
    try:
        data = read(0, _CHUNK_SIZE)
    except OSError:
        data = b""
    if not data:
        sys.exit(0)
    write_all(pty_fd, data)

def handle_resize(pty_fd):
    try:
        data = read(_CMDIO, _CHUNK_SIZE)
    except OSError:
        data = b""
    if not data:
        return
    for line in data.decode("UTF-8", "strict").splitlines():
        rows, columns = (int(s.strip()) for s in line.split("x", 2))
        ioctl(pty_fd, TIOCSWINSZ, pack("HHHH", rows, columns, 0, 0))

if __name__ == "__main__":
    main()
`;

export class OpencodeTerminalView extends ItemView {
  terminal: Terminal | null = null;
  fitAddon: FitAddon | null = null;
  ptyProcess: ChildProcess | null = null;
  container: HTMLElement | null = null;
  editorServer: EditorServer | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: any) {
    super(leaf);
  }

  getViewType(): string {
    return OPENCODE_TERMINAL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "OpenCode";
  }

  getIcon(): string {
    return "terminal";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.querySelector(".view-content") as HTMLElement || this.containerEl.children[1] as HTMLElement;
    if (!container) {
      return;
    }

    container.empty();
    container.addClass("opencode-terminal-container");
    this.container = container;

    const viewHeader = this.containerEl.children[0] as HTMLElement | undefined;
    if (viewHeader) {
      viewHeader.style.display = "none";
    }

    const termContainer = container.createEl("div", { cls: "opencode-terminal" });
    const computedStyle = getComputedStyle(document.body);
    const isDark = document.body.classList.contains("theme-dark");
    const terminal = new Terminal({
      fontSize: this.plugin.settings.terminalFontSize,
      fontFamily: this.plugin.settings.terminalFontFamily,
      lineHeight: 1.2,
      theme: {
        background: computedStyle.getPropertyValue("--background-primary").trim() || (isDark ? "#1e1e1e" : "#ffffff"),
        foreground: computedStyle.getPropertyValue("--text-normal").trim() || (isDark ? "#d4d4d4" : "#333333"),
        cursor: computedStyle.getPropertyValue("--text-normal").trim() || (isDark ? "#d4d4d4" : "#333333"),
        cursorAccent: computedStyle.getPropertyValue("--background-primary").trim() || (isDark ? "#1e1e1e" : "#ffffff"),
        selectionBackground: computedStyle.getPropertyValue("--text-selection").trim() || (isDark ? "#264f78" : "#add6ff"),
      },
      cursorBlink: true,
      scrollback: 10000,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(termContainer);

    try {
      terminal.loadAddon(new WebglAddon());
    } catch (error) {
      console.warn("WebGL addon failed to load, falling back to canvas", error);
    }

    this.terminal = terminal;
    this.fitAddon = fitAddon;

    let fitTimeout: ReturnType<typeof setTimeout> | null = null;
    let fitFrame: number | null = null;
    const doFit = () => {
      if (fitTimeout) {
        clearTimeout(fitTimeout);
      }
      fitTimeout = setTimeout(() => {
        if (fitFrame) {
          cancelAnimationFrame(fitFrame);
        }
        fitFrame = requestAnimationFrame(() => {
          fitFrame = null;
          const rect = termContainer.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            try {
              fitAddon.fit();
              this.sendResize();
            } catch (error) {
              console.warn("Fit failed:", error);
            }
          }
        });
      }, 50);
    };

    this.register(() => {
      if (fitTimeout) {
        clearTimeout(fitTimeout);
      }
      if (fitFrame) {
        cancelAnimationFrame(fitFrame);
      }
    });

    const doFitAfterLayout = () => {
      doFit();
      requestAnimationFrame(doFit);
    };
    [0, 100, 300, 500].forEach((delay) => setTimeout(doFitAfterLayout, delay));

    const resizeObserver = new ResizeObserver(doFitAfterLayout);
    resizeObserver.observe(termContainer);
    resizeObserver.observe(container);
    this.register(() => resizeObserver.disconnect());
    this.registerEvent(this.app.workspace.on("resize", doFitAfterLayout));
    this.registerEvent(this.app.workspace.on("layout-change", doFitAfterLayout));
    window.addEventListener("resize", doFitAfterLayout);
    this.register(() => window.removeEventListener("resize", doFitAfterLayout));

    terminal.onData((data) => this.ptyProcess?.stdin?.write(data));
    this.registerDropHandlers(termContainer);
    this.spawnPty(terminal);

    this.editorServer = new EditorServer();
    this.editorServer.start(this.plugin.vaultRoot).catch((err) => {
      console.warn("OpenCode editor server failed to start:", err);
    });

    setTimeout(() => this.terminal?.focus(), 600);
  }

  async onClose(): Promise<void> {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
    if (this.editorServer) {
      await this.editorServer.stop();
      this.editorServer = null;
    }
    this.terminal?.dispose();
    this.terminal = null;
    this.fitAddon = null;
  }

  restartPty(): void {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
    if (this.terminal) {
      this.terminal.clear();
      this.spawnPty(this.terminal);
    }
  }

  spawnPty(terminal: Terminal): void {
    const defaultCwd = this.plugin.settings.defaultWorkingDirectory || this.plugin.vaultRoot;
    const cwd = this.plugin.sessionCwd || defaultCwd;
    const opencodePath = this.plugin.settings.opencodePath || "opencode";
    let args = this.plugin.sessionArgs
      ? [...this.plugin.sessionArgs]
      : this.plugin.settings.newSessionArgs.split(/\s+/).filter(Boolean);

    this.plugin.sessionArgs = null;
    this.plugin.sessionCwd = null;

    if (this.plugin.pendingPrompt) {
      args = [...args, "--prompt", this.plugin.pendingPrompt];
      this.plugin.pendingPrompt = null;
    }

    if (process.platform === "win32") {
      terminal.writeln("\r\nWindows PTY support not yet implemented.\r\n");
      new Notice("OpenCode terminal not supported on Windows yet.");
      return;
    }

    this.ptyProcess = spawn("python3", ["-c", UNIX_PSEUDOTERMINAL_PY, opencodePath, ...args], {
      cwd,
      env: getOpencodeEnv(),
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    });

    this.ptyProcess.stdout?.on("data", (chunk) => terminal.write(chunk));
    this.ptyProcess.stderr?.on("data", (chunk) => console.error("PTY stderr:", chunk.toString()));
    this.ptyProcess.on("exit", (code, signal) => {
      terminal.writeln(`\r\n[Process exited with code ${code ?? signal}]\r\n`);
      this.ptyProcess = null;
    });
    this.ptyProcess.on("error", (err) => {
      terminal.writeln(`\r\nError: ${err.message}\r\n`);
      new Notice(`Failed to start OpenCode: ${err.message}`);
    });
    setTimeout(() => this.sendResize(), 300);
  }

  sendResize(): void {
    if (!this.ptyProcess || !this.terminal) {
      return;
    }

    const cmdio = this.ptyProcess.stdio?.[3];
    if (cmdio && typeof (cmdio as any).write === "function") {
      (cmdio as any).write(`${this.terminal.rows}x${this.terminal.cols}\n`);
    }
  }

  private registerDropHandlers(termContainer: HTMLElement): void {
    termContainer.addEventListener("dragover", (event) => event.preventDefault());
    termContainer.addEventListener("drop", (event) => {
      event.preventDefault();
      handleTerminalDrop({
        dragManager: (this.app as any).dragManager,
        dataTransfer: event.dataTransfer,
        ptyWrite: (text) => this.ptyProcess?.stdin?.write(text),
      });
    });
  }
}

import { spawn, execFile } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { Notice } from "obsidian";
import { getOpencodeEnv } from "../server/OpencodeEnv";
import { getRedirectShell, shellQuote } from "../server/Shell";

const execFileAsync = promisify(execFile);

export class OpencodeCliClient {
  constructor(private opencodePath: string, private cwd: string) {}

  resolvePath(): string {
    return this.opencodePath || "opencode";
  }

  parseJsonOutput(output: Buffer | string): any {
    const text = Buffer.isBuffer(output) ? output.toString("utf8") : String(output);
    const trimmed = text.trim();

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      const objectStart = trimmed.indexOf("{");
      const arrayStart = trimmed.indexOf("[");
      const starts = [objectStart, arrayStart].filter((pos) => pos >= 0);
      const start = starts.length ? Math.min(...starts) : -1;

      if (start < 0) {
        throw error;
      }

      return JSON.parse(trimmed.slice(start));
    }
  }

  async listSessions(): Promise<any[]> {
    try {
      const { stdout } = await execFileAsync(
        this.resolvePath(),
        ["session", "list", "--format", "json"],
        { cwd: this.cwd, env: getOpencodeEnv(), encoding: "buffer" }
      );
      return this.parseJsonOutput(stdout as Buffer);
    } catch (error) {
      console.error("Failed to list sessions:", error);
      new Notice("Failed to list OpenCode sessions. Check your OpenCode path in settings.");
      return [];
    }
  }

  async exportSession(sessionId: string): Promise<any | null> {
    const tmpFile = join(
      tmpdir(),
      `opencode-export-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
    );

    try {
      const command = `${shellQuote(this.resolvePath())} export ${shellQuote(sessionId)} > ${shellQuote(tmpFile)}`;
      const shell = getRedirectShell(command);
      await execFileAsync(shell.file, shell.args, {
        cwd: this.cwd,
        env: getOpencodeEnv(),
        maxBuffer: 1024 * 1024,
      });
      return this.parseJsonOutput(readFileSync(tmpFile));
    } catch (error) {
      console.error("Failed to export session:", error);
      new Notice(`Failed to export session ${sessionId}`);
      return null;
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        // Temp file may not exist if export failed before redirection.
      }
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await execFileAsync(this.resolvePath(), ["session", "delete", sessionId], {
        cwd: this.cwd,
        env: getOpencodeEnv(),
      });
      return true;
    } catch (error) {
      console.error("Failed to delete session:", error);
      return false;
    }
  }

  spawnTerminal(cwd: string, extraArgs: string[] = []) {
    return spawn(this.resolvePath(), extraArgs, {
      cwd,
      env: getOpencodeEnv(),
    });
  }
}

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export class EditorServer {
  private wss: any = null;
  private clients = new Set<any>();
  private port = 0;
  private lockFilePath = "";
  private lockDir: string;

  constructor(options: { lockDir?: string } = {}) {
    this.lockDir = options.lockDir || join(homedir(), ".claude", "ide");
  }

  async start(vaultRoot: string): Promise<number> {
    const { WebSocketServer } = require("ws");

    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: 0 }, () => {
        const address = this.wss.address();
        this.port = typeof address === "object" && address !== null ? address.port : 0;

        if (!existsSync(this.lockDir)) {
          mkdirSync(this.lockDir, { recursive: true });
        }

        this.lockFilePath = join(this.lockDir, `${this.port}.lock`);
        writeFileSync(
          this.lockFilePath,
          JSON.stringify({ transport: "ws", workspaceFolders: [vaultRoot] }, null, 2)
        );
        resolve(this.port);
      });

      this.wss.on("error", reject);
      this.wss.on("connection", (ws: any) => {
        this.clients.add(ws);
        ws.on("close", () => this.clients.delete(ws));
        ws.on("message", (rawData: Buffer) => this.handleMessage(ws, rawData.toString()));
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.lockFilePath && existsSync(this.lockFilePath)) {
        unlinkSync(this.lockFilePath);
      }
      this.lockFilePath = "";

      for (const client of this.clients) {
        client.terminate();
      }
      this.clients.clear();

      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  notifyAtMentioned(filePath: string, lineStart = 1, lineEnd = 1): void {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method: "at_mentioned",
      params: { filePath, lineStart, lineEnd },
    });

    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  private handleMessage(ws: any, rawData: string): void {
    try {
      const msg = JSON.parse(rawData);
      if (msg.method === "initialize" && msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              protocolVersion: "2025-11-25",
              serverInfo: { name: "obsidian-opencode", version: "1.2.1" },
            },
          })
        );
      }
    } catch {
      // Ignore malformed editor messages.
    }
  }
}

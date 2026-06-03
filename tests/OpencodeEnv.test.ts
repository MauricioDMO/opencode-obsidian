import { describe, expect, test } from "bun:test";
import { join } from "path";
import { getOpencodeEnv, getOpencodeSearchDirectories } from "../src/server/OpencodeEnv";

describe("OpencodeEnv", () => {
  test("builds a POSIX PATH with common OpenCode tool directories and original PATH last", () => {
    const homeDir = "/home/tester";
    const versionsDir = join(homeDir, ".local", "share", "fnm", "node-versions");

    const env = getOpencodeEnv({
      env: { PATH: "/existing/bin" },
      homeDir,
      platform: "linux",
      pathDelimiter: ":",
      exists: (path) => path === versionsDir,
      readDir: () => ["v20.0.0", "v22.0.0"],
    });

    const pathParts = env.PATH?.split(":") ?? [];

    expect(pathParts).toContain(join(homeDir, ".opencode", "bin"));
    expect(pathParts).toContain(join(homeDir, ".local", "bin"));
    expect(pathParts).toContain(join(homeDir, ".local", "share", "pnpm", "bin"));
    expect(pathParts).toContain(join(homeDir, ".bun", "bin"));
    expect(pathParts).toContain(join(homeDir, ".cargo", "bin"));
    expect(pathParts).toContain("/opt/homebrew/bin");
    expect(pathParts).toContain(join(versionsDir, "v20.0.0", "installation", "bin"));
    expect(pathParts[pathParts.length - 1]).toBe("/existing/bin");
    expect(env.PNPM_HOME).toBe(join(homeDir, ".local", "share", "pnpm"));
    expect(env.FNM_DIR).toBe(join(homeDir, ".local", "share", "fnm"));
  });

  test("builds a Windows PATH and mirrors PATH to Path", () => {
    const homeDir = "C:\\Users\\tester";
    const appData = "C:\\Users\\tester\\AppData\\Roaming";
    const localAppData = "C:\\Users\\tester\\AppData\\Local";
    const versionsDir = join(appData, "fnm", "node-versions");

    const env = getOpencodeEnv({
      env: {
        PATH: "C:\\Windows\\System32",
        USERPROFILE: homeDir,
        APPDATA: appData,
        LOCALAPPDATA: localAppData,
      },
      homeDir,
      platform: "win32",
      pathDelimiter: ";",
      exists: (path) => path === versionsDir,
      readDir: () => ["v20.0.0"],
    });

    const pathParts = env.PATH?.split(";") ?? [];

    expect(pathParts).toContain(join(homeDir, ".opencode", "bin"));
    expect(pathParts).toContain(join(homeDir, ".local", "bin"));
    expect(pathParts).toContain(join(appData, "npm"));
    expect(pathParts).toContain(join(localAppData, "pnpm"));
    expect(pathParts).toContain(join(versionsDir, "v20.0.0", "installation"));
    expect(pathParts[pathParts.length - 1]).toBe("C:\\Windows\\System32");
    expect(env.PNPM_HOME).toBe(join(localAppData, "pnpm"));
    expect(env.FNM_DIR).toBe(join(appData, "fnm"));
    expect(env.Path).toBe(env.PATH);
  });

  test("preserves existing PNPM_HOME and FNM_DIR", () => {
    const env = getOpencodeEnv({
      env: {
        PATH: "/bin",
        PNPM_HOME: "/custom/pnpm",
        FNM_DIR: "/custom/fnm",
      },
      homeDir: "/home/tester",
      platform: "linux",
      pathDelimiter: ":",
      exists: () => false,
      readDir: () => [],
    });

    expect(env.PNPM_HOME).toBe("/custom/pnpm");
    expect(env.FNM_DIR).toBe("/custom/fnm");
  });

  test("returns unique search directories", () => {
    const homeDir = "/home/tester";
    const dirs = getOpencodeSearchDirectories({
      env: { FNM_DIR: join(homeDir, ".local", "share", "fnm") },
      homeDir,
      platform: "linux",
      exists: () => false,
      readDir: () => [],
    });

    expect(new Set(dirs).size).toBe(dirs.length);
  });
});

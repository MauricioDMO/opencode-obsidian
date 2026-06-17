import { existsSync, readdirSync } from "fs";
import { homedir, platform } from "os";
import { delimiter, join } from "path";

type Platform = NodeJS.Platform;

export interface OpencodeEnvOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  platform?: Platform;
  pathDelimiter?: string;
  exists?: (path: string) => boolean;
  readDir?: (path: string) => string[];
}

interface EnvContext {
  env: NodeJS.ProcessEnv;
  homeDir: string;
  platform: Platform;
  pathDelimiter: string;
  exists: (path: string) => boolean;
  readDir: (path: string) => string[];
}

export function getOpencodeEnv(options: OpencodeEnvOptions = {}): NodeJS.ProcessEnv {
  const context = createContext(options);
  const env: NodeJS.ProcessEnv = { ...context.env };
  const originalPath = env.PATH || env.Path || "";
  const searchDirectories = getOpencodeSearchDirectories(context);

  if (!env.PNPM_HOME) {
    env.PNPM_HOME = getDefaultPnpmHome(context);
  }

  if (!env.FNM_DIR) {
    env.FNM_DIR = getDefaultFnmDir(context);
  }

  env.PATH = [...searchDirectories, originalPath]
    .filter((value) => value.length > 0)
    .join(context.pathDelimiter);

  if (context.platform === "win32") {
    env.Path = env.PATH;
  }

  return env;
}

export function getOpencodeSearchDirectories(options: OpencodeEnvOptions = {}): string[] {
  const context = createContext(options);
  const dirs = [
    ...getUserSearchDirectories(context),
    ...getFnmNodeDirectories(context),
    ...getSystemSearchDirectories(context),
  ];
  return unique(dirs);
}

function createContext(options: OpencodeEnvOptions): EnvContext {
  return {
    env: options.env ?? process.env,
    homeDir: options.homeDir ?? homedir(),
    platform: options.platform ?? platform(),
    pathDelimiter: options.pathDelimiter ?? delimiter,
    exists: options.exists ?? existsSync,
    readDir: options.readDir ?? ((path) => readdirSync(path)),
  };
}

function getUserSearchDirectories(context: EnvContext): string[] {
  if (context.platform === "win32") {
    const userProfile = context.env.USERPROFILE || context.homeDir;
    const appData = context.env.APPDATA || join(userProfile, "AppData", "Roaming");
    const localAppData = context.env.LOCALAPPDATA || join(userProfile, "AppData", "Local");

    return [
      join(userProfile, ".opencode", "bin"),
      join(userProfile, ".local", "bin"),
      join(appData, "npm"),
      join(localAppData, "pnpm"),
    ];
  }

  return [
    join(context.homeDir, ".opencode", "bin"),
    join(context.homeDir, ".local", "bin"),
    join(context.homeDir, ".local", "share", "pnpm", "bin"),
    join(context.homeDir, ".local", "share", "pnpm"),
    join(context.homeDir, ".bun", "bin"),
    join(context.homeDir, ".cargo", "bin"),
  ];
}

function getSystemSearchDirectories(context: EnvContext): string[] {
  if (context.platform === "win32") {
    return [];
  }

  return [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
  ];
}

function getDefaultPnpmHome(context: EnvContext): string {
  if (context.platform === "win32") {
    const userProfile = context.env.USERPROFILE || context.homeDir;
    const localAppData = context.env.LOCALAPPDATA || join(userProfile, "AppData", "Local");
    return join(localAppData, "pnpm");
  }

  return join(context.homeDir, ".local", "share", "pnpm");
}

function getDefaultFnmDir(context: EnvContext): string {
  if (context.platform === "win32") {
    const userProfile = context.env.USERPROFILE || context.homeDir;
    const appData = context.env.APPDATA || join(userProfile, "AppData", "Roaming");
    return join(appData, "fnm");
  }

  return join(context.homeDir, ".local", "share", "fnm");
}

function getFnmNodeDirectories(context: EnvContext): string[] {
  const fnmDir = context.env.FNM_DIR || getDefaultFnmDir(context);
  const versionsDir = join(fnmDir, "node-versions");

  if (!context.exists(versionsDir)) {
    return [];
  }

  try {
    return context
      .readDir(versionsDir)
      .map((version) =>
        context.platform === "win32"
          ? join(versionsDir, version, "installation")
          : join(versionsDir, version, "installation", "bin")
      );
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => value.length > 0 && values.indexOf(value) === index);
}

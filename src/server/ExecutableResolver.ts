import { existsSync } from "fs";
import { platform } from "os";
import { join, basename, isAbsolute } from "path";
import { execSync } from "child_process";
import { getOpencodeEnv, getOpencodeSearchDirectories } from "./OpencodeEnv";

/**
 * Resolves the opencode executable path across different platforms.
 * Follows the search algorithm:
 * 1. If configured path is absolute and exists, return it directly
 * 2. Extract basename from configured path
 * 3. Search platform-specific locations for that basename
 * 4. If found, return full path; if not found, return configured path as fallback
 */
export class ExecutableResolver {
  /**
   * Resolve the executable path based on configuration and platform
   * @param configuredPath The path configured in settings (e.g., "opencode" or "/path/to/opencode")
   * @returns The resolved full path or the configured path as fallback
   */
  static resolve(configuredPath: string): string {
    // If configured path is absolute and exists, use it directly
    if (isAbsolute(configuredPath) && existsSync(configuredPath)) {
      return configuredPath;
    }

    // Extract basename (e.g., "opencode" from "/path/to/opencode" or just "opencode")
    const execName = basename(configuredPath) || configuredPath;
    
    // Get search directories for current platform
    const searchDirs = this.getSearchDirectories();
    
    // Search for executable in platform directories
    for (const dir of searchDirs) {
      const fullPath = join(dir, execName);
      if (existsSync(fullPath)) {
        console.log("[OpenCode] Found executable at:", fullPath);
        return fullPath;
      }
    }

    // Fallback: return configured path (let spawn fail naturally if not found)
    console.log("[OpenCode] Executable not found in common paths, using configured:", configuredPath);
    return configuredPath;
  }

  /**
   * Check if executable exists in PATH
   * @param execName Name of executable to search for
   * @returns Full path if found in PATH, null otherwise
   */
  static resolveFromPath(execName: string): string | null {
    try {
      // Use 'which' on Unix systems, 'where' on Windows
      const command = platform() === "win32" ? "where" : "which";
      const result = execSync(`${command} "${execName}"`, {
        encoding: "utf-8",
        env: getOpencodeEnv(),
        stdio: ["pipe", "pipe", "ignore"],
      });
      const path = result.trim().split("\n")[0];
      if (path && existsSync(path)) {
        return path;
      }
    } catch {
      // Command not found in PATH
    }
    return null;
  }

  /**
   * Get platform-specific directories to search for executables
   */
  private static getSearchDirectories(): string[] {
    return getOpencodeSearchDirectories({ platform: platform() });
  }
}

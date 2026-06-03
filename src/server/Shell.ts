export function shellQuote(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function getRedirectShell(command: string): { file: string; args: string[] } {
  if (process.platform === "win32") {
    return { file: "cmd.exe", args: ["/d", "/s", "/c", command] };
  }

  return { file: "sh", args: ["-c", command] };
}

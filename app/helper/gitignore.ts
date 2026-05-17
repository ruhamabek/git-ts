import fs from "node:fs";

export function readGitIgnore(): string[] {
  const path = ".gitignore";

  if (!fs.existsSync(path)) return [];

  const raw = fs.readFileSync(path, "utf8");

  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith("#"));
}

export function isIgnored(
  filePath: string,
  patterns: string[]
): boolean {
  return patterns.some(pattern => {
     if (pattern.endsWith("/")) {
      return filePath.startsWith(pattern);
    }

     return filePath === pattern;
  });
}
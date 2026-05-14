import fs from "fs";
import path from "path";

export function resolveCommit(target: string): string {
  const branchPath = path.join(".git", "refs", "heads", target);
  if (fs.existsSync(branchPath)) {
    return fs.readFileSync(branchPath, "utf8").trim();
  }
  if (/^[0-9a-f]{40}$/.test(target)) {
    const objectPath = path.join(
      ".git",
      "objects",
      target.slice(0, 2),
      target.slice(2)
    );

    if (!fs.existsSync(objectPath)) {
      throw new Error(`Commit object does not exist: ${target}`);
    }

    return target;
  }
   throw new Error(`Unknown branch or commit: ${target}`);
}
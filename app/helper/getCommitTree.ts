import fs from "fs";
import path from "path";
import { inflateSync } from "zlib";

export function getCommitTree(commitSha: string) {
  const objectPath = path.join(
    ".git",
    "objects",
    commitSha.slice(0, 2),
    commitSha.slice(2)
  );

  const compressed = fs.readFileSync(objectPath);

  const raw = inflateSync(compressed);

  const content = raw
    .slice(raw.indexOf(0) + 1)
    .toString();

  const match = content.match(/^tree (.+)$/m);

  if (!match) {
    throw new Error("Commit missing tree");
  }

  return match[1];
}
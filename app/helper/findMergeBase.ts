import fs from "node:fs";
import path from "node:path";


function getParents(commitSha: string): string[] {
  const objPath = path.join(
    ".git",
    "objects",
    commitSha.slice(0, 2),
    commitSha.slice(2)
  );

  const raw = fs.readFileSync(objPath);
  const content = raw.slice(raw.indexOf(0) + 1).toString();

  const parents: string[] = [];

  for (const line of content.split("\n")) {
    if (line.startsWith("parent ")) {
      parents.push(line.replace("parent ", "").trim());
    }
  }

  return parents;
}

export function findMergeBase(a: string, b: string): string | null {
  const visited = new Set<string>();
  const queueA = [a];

  // 1. collect all ancestors of A
  while (queueA.length) {
    const cur = queueA.shift()!;
    if (visited.has(cur)) continue;

    visited.add(cur);

    for (const p of getParents(cur)) {
      queueA.push(p);
    }
  }

  // 2. walk B until we hit shared ancestor
  const queueB = [b];

  while (queueB.length) {
    const cur = queueB.shift()!;
    if (visited.has(cur)) return cur;

    for (const p of getParents(cur)) {
      queueB.push(p);
    }
  }

  return null;
}
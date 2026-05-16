import * as path from "node:path";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { getCommitTree } from "./getCommitTree";
import { inflateSync } from "node:zlib";

function getHeadTree(): Record<string, string> {
  const head = fs.readFileSync(".git/HEAD", "utf8").trim();

  let commitSha: string;

  if (head.startsWith("ref: ")) {
    const ref = head.replace("ref: ", "").trim();
    commitSha = fs.readFileSync(path.join(".git", ref), "utf8").trim();
  } else {
    commitSha = head;
  }

  const treeSha = getCommitTree(commitSha);

  return flattenTree(treeSha);
}

function flattenTree(treeSha: string, prefix = ""): Record<string, string> {
  const objPath = path.join(
    ".git",
    "objects",
    treeSha.slice(0, 2),
    treeSha.slice(2)
  );

  const compressed = fs.readFileSync(objPath);
  const raw = inflateSync(compressed);

  const content = raw.slice(raw.indexOf(0) + 1);

  let i = 0;
  const result: Record<string, string> = {};

  while (i < content.length) {
    const spaceIndex = content.indexOf(32, i);
    const mode = content.slice(i, spaceIndex).toString();
    i = spaceIndex + 1;

    const nullIndex = content.indexOf(0, i);
    const name = content.slice(i, nullIndex).toString();
    i = nullIndex + 1;

    const sha = content.slice(i, i + 20).toString("hex");
    i += 20;

    const fullPath = prefix + name;

    if (mode === "040000") {
      Object.assign(result, flattenTree(sha, fullPath + "/"));
    } else {
      result[fullPath] = sha;
    }
  }

  return result;
}

function readWorkingDir(): Record<string, string> {
  const result: Record<string, string> = {};

  function walk(dir: string) {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      if (entry === ".git") continue;

      const full = path.join(dir, entry);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        walk(full);
      } else {
        const content = fs.readFileSync(full);
        const header = `blob ${content.length}\0`;
        const store = Buffer.concat([Buffer.from(header), content]);
        const sha = createHash("sha1").update(store).digest("hex");

        result[full.replace("./", "")] = sha;
      }
    }
  }

  walk(".");
  return result;
}
function readIndex(): Record<string, string> {
  const indexPath = ".git/index";

  if (!fs.existsSync(indexPath)) {
    return {};
  }

  const raw = fs.readFileSync(indexPath, "utf8").trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

export function getStatus(): string {
  const index = readIndex();
  const head = getHeadTree();
  const working = readWorkingDir();

  let output = "";

  // 1. staged changes (index vs HEAD)
  for (const file in index) {
    if (index[file] !== head[file]) {
      output += `staged: ${file}\n`;
    }
  }

  // 2. modified (working vs index)
  for (const file in working) {
    if (index[file] && index[file] !== working[file]) {
      output += `modified: ${file}\n`;
    }
  }

  // 3. untracked files
  for (const file in working) {
    if (!index[file]) {
      output += `untracked: ${file}\n`;
    }
  }

  return output || "clean\n";
}
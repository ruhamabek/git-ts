import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getCommitTree } from "./getCommitTree";
import { flattenTree } from "./getStatus";
import { readGitIgnore, isIgnored } from "./gitignore";

/* ---------------- INDEX ---------------- */

function readIndex(): Record<string, string> {
  const indexPath = ".git/index";

  if (!fs.existsSync(indexPath)) return {};
  const raw = fs.readFileSync(indexPath, "utf8").trim();
  if (!raw) return {};

  return JSON.parse(raw);
}

/* ---------------- HEAD TREE ---------------- */

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

/* ---------------- SAFE WORKING DIR SCAN ---------------- */

function readWorkingDir(): Record<string, string> {
  const result: Record<string, string> = {};

  const ignorePatterns = readGitIgnore();

  function walk(dir: string) {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const full = path.join(dir, entry);

      const relative = path
        .relative(".", full)
        .replaceAll("\\", "/");

       if (relative.split("/").includes(".git")) {
        continue;
      }

       if (isIgnored(relative, ignorePatterns)) {
        continue;
      }

      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        walk(full);
      } else {
        const content = fs.readFileSync(full);

        const header = `blob ${content.length}\0`;
        const store = Buffer.concat([
          Buffer.from(header),
          content,
        ]);

        const sha = createHash("sha1")
          .update(store)
          .digest("hex");

        result[relative] = sha;
      }
    }
  }

  walk(".");
  return result;
}

/* ---------------- BLOB READ ---------------- */

export function readBlob(sha: string): string {
  const objPath = path.join(
    ".git",
    "objects",
    sha.slice(0, 2),
    sha.slice(2)
  );

  const compressed = fs.readFileSync(objPath);
  const raw = inflateSync(compressed);

  return raw.slice(raw.indexOf(0) + 1).toString();
}

/* ---------------- DIFF ENGINE ---------------- */

function diffLines(a: string, b: string): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");

  let out = "";
  const max = Math.max(aLines.length, bLines.length);

  for (let i = 0; i < max; i++) {
    if (aLines[i] === bLines[i]) continue;

    if (aLines[i] !== undefined) out += `- ${aLines[i]}\n`;
    if (bLines[i] !== undefined) out += `+ ${bLines[i]}\n`;
  }

  return out;
}

/* ---------------- FINAL DIFF ---------------- */

export function getDiff(): string {
  const index = readIndex();
  const head = getHeadTree();
  const working = readWorkingDir();

  let out = "";

  // ONLY real user files (no git garbage)
  const files = new Set([
    ...Object.keys(head),
    ...Object.keys(index),
    ...Object.keys(working),
  ]).values();

  for (const file of files) {
     if (file.includes(".git")) continue;

    const headSha = head[file];
    const indexSha = index[file];
    const workSha = working[file];

    /* ---------------- STAGED ---------------- */
    if (headSha !== indexSha && indexSha !== undefined) {
      const oldContent = headSha ? readBlob(headSha) : "";
      const newContent = readBlob(indexSha);

      out += `diff -- ${file} (staged)\n`;
      out += diffLines(oldContent, newContent);
      out += "\n";
      continue;
    }

    /* ---------------- UNSTAGED ---------------- */
    if (indexSha !== workSha && workSha !== undefined) {
      const oldContent = indexSha ? readBlob(indexSha) : "";
      const newContent = fs.readFileSync(file, "utf8");

      out += `diff -- ${file} (unstaged)\n`;
      out += diffLines(oldContent, newContent);
      out += "\n";
      continue;
    }

    /* ---------------- DELETED ---------------- */
    if (workSha === undefined && indexSha) {
      const oldContent = readBlob(indexSha);

      out += `diff -- ${file} (deleted)\n`;
      out += diffLines(oldContent, "");
      out += "\n";
    }
  }

  return out || "no changes\n";
}
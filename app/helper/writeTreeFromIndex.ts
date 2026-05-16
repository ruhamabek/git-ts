import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { deflateSync } from "zlib";
import { hexToRawBuffer } from "./hexToRaw";

type BlobNode = {
  type: "blob";
  sha: string;
};

type TreeMap = {
  [name: string]: BlobNode | TreeMap;
};

function isBlobNode(value: BlobNode | TreeMap): value is BlobNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as any).type === "blob"
  );
}

function insertPath(tree: TreeMap, filePath: string, sha: string) {
  const parts = filePath.split("/");
  let current: TreeMap = tree;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (isLast) {
      current[part] = { type: "blob", sha };
    } else {
      if (!current[part] || isBlobNode(current[part])) {
        current[part] = {};
      }
      current = current[part] as TreeMap;
    }
  }
}

function writeTreeRecursive(tree: TreeMap): string {
  const entries: Buffer[] = [];

  const names = Object.keys(tree).sort();

  for (const name of names) {
    const value = tree[name];

    if (isBlobNode(value)) {
      entries.push(
        Buffer.concat([
          Buffer.from(`100644 ${name}\0`),
          hexToRawBuffer(value.sha),
        ])
      );
    } else {
      const subtreeSha = writeTreeRecursive(value);

      entries.push(
        Buffer.concat([
          Buffer.from(`040000 ${name}\0`),
          hexToRawBuffer(subtreeSha),
        ])
      );
    }
  }

  const treeContent = Buffer.concat(entries);

  const final = Buffer.concat([
    Buffer.from(`tree ${treeContent.length}\0`),
    treeContent,
  ]);

  const sha = createHash("sha1").update(final).digest("hex");

  const objectPath = path.join(
    ".git",
    "objects",
    sha.slice(0, 2),
    sha.slice(2)
  );

  fs.mkdirSync(path.dirname(objectPath), { recursive: true });
  fs.writeFileSync(objectPath, deflateSync(final));

  return sha;
}

export function writeTreeFromIndex(): string {
  const indexPath = path.join(".git", "index");

  if (!fs.existsSync(indexPath)) {
    throw new Error("Index does not exist");
  }

  const raw = fs.readFileSync(indexPath, "utf8").trim();

  if (!raw) {
    throw new Error("Index is empty");
  }

  let parsed: Record<string, string>;

  // support JSON OR line format
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};

    const lines = raw.split("\n");

    for (const line of lines) {
      const parts = line.trim().split(" ");
      if (parts.length !== 2) continue;

      const [filePath, sha] = parts;
      parsed[filePath] = sha;
    }
  }

  const root: TreeMap = {};

  for (const [filePath, sha] of Object.entries(parsed)) {
    insertPath(root, filePath, sha);
  }

  return writeTreeRecursive(root);
}
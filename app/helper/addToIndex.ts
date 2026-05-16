import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { deflateSync } from "zlib";

export function addToIndex(filePath: string) {
  const content = fs.readFileSync(filePath);

  const header = `blob ${content.length}\0`;

  const store = Buffer.concat([
    Buffer.from(header),
    content,
  ]);

  const sha = createHash("sha1")
    .update(store)
    .digest("hex");

  // write blob object
  const objectPath = path.join(
    ".git",
    "objects",
    sha.slice(0, 2),
    sha.slice(2)
  );

  fs.mkdirSync(path.dirname(objectPath), {
    recursive: true,
  });

  fs.writeFileSync(
    objectPath,
    deflateSync(store)
  );

  // update index
  const indexPath = path.join(".git", "index");

  let index: Record<string, string> = {};

  if (fs.existsSync(indexPath)) {
    const raw = fs.readFileSync(indexPath, "utf8");

    if (raw.trim()) {
      index = JSON.parse(raw);
    }
  }

  index[filePath] = sha;

  fs.writeFileSync(
    indexPath,
    JSON.stringify(index, null, 2)
  );

  console.log(`added ${filePath}`);
}
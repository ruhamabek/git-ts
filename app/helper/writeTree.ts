
import fs from "fs";
import path from "path/win32";
import { createHash } from "crypto";
import { hexToRawBuffer } from "./hexToRaw";

export function writeTree(dirPath: string): string {
  const entries: Buffer[] = [];
  const items = fs.readdirSync(dirPath);
  for (const name of items) {
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);
    if (name === ".git") continue;
    if (stat.isFile()) {
      const fileContent = fs.readFileSync(fullPath);
      const header = `blob ${fileContent.length}\0`;//`blob 8\0`
      const store = Buffer.concat([Buffer.from(header), fileContent]);//`blob 8\0 world`
      const sha = createHash("sha1").update(store).digest("hex");
      const objPath = path.join(".git/objects", sha.slice(0, 2), sha.slice(2));
      fs.mkdirSync(path.dirname(objPath), { recursive: true });
      const compressed = require("zlib").deflateSync(store);
      fs.writeFileSync(objPath, compressed);
      const entry = Buffer.concat([
        Buffer.from(`100644 ${name}\0`),//`100644 hello\0`
        hexToRawBuffer(sha),
      ]);
      entries.push(entry);
    }
    else if (stat.isDirectory()) {
      const treeSha = writeTree(fullPath);
      const entry = Buffer.concat([
        Buffer.from(`040000 ${name}\0`),//`040000 hello\0`
        hexToRawBuffer(treeSha),
      ]);
      entries.push(entry);
    }
  }
  const treeContent = Buffer.concat(entries);
  const final = Buffer.concat([
    Buffer.from(`tree ${treeContent.length}\0`),
    treeContent,
  ]);
  const treeSha = createHash("sha1").update(final).digest("hex");
  const objPath = path.join(".git/objects", treeSha.slice(0, 2), treeSha.slice(2));
  fs.mkdirSync(path.dirname(objPath), { recursive: true });
  const compressed = require("zlib").deflateSync(final);
  fs.writeFileSync(objPath, compressed);
  return treeSha;
}
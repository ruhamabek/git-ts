import * as fs from "fs";
import { inflate, deflate } from 'node:zlib';
import { promisify } from 'node:util';
import * as path from 'node:path';
import { createHash } from "node:crypto";
import { writeTree } from "./helper/writeTree";


const inflateAsync = promisify(inflate);
const deflateAsync = promisify(deflate);
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "init":
    // You can use print statements as follows for debugging, they'll be visible when running tests.
    console.error("Logs from your program will appear here!");
 //.git/objects/3b/18e512dba79e4c8300dd08aeb37f8e728b8dad
 //3b18e512dba79e4c8300dd08aeb37f8e728b8dad
    // TODO: Uncomment the code below to pass the first stage
    fs.mkdirSync(".git", { recursive: true });
    fs.mkdirSync(".git/objects", { recursive: true });
    fs.mkdirSync(".git/refs", { recursive: true });
    fs.writeFileSync(".git/HEAD", "ref: refs/heads/main\n");
    console.log("Initialized git directory");
    break;
  case "cat-file":
    const sha = args[2];
    const firstPart = sha.slice(0, 2);
    const secondPart = sha.slice(2);
    const filePath = path.join('.git/objects', firstPart, secondPart);
    const compressed = fs.readFileSync(filePath);
    const original = await inflateAsync(compressed);
    
    // Find header end
    const nullIndex = original.indexOf(0);
    ///0
    
    // Parse header
    const header = original.slice(0, nullIndex).toString();
    
    // Example:
    // "blob 11\0"
    // "tree 52"
    
    const type = header.split(" ")[0];
    
  // Body after header
  const content = original.slice(nullIndex + 1);
  
  
  // ====================
  // BLOB
  // ====================
  
  if (type === "blob") {
    process.stdout.write(content.toString());
  }
  
  
  // ====================
  // TREE
  // ====================
  
  if (type === "tree") {
  
    let i = 0;
  
    while (i < content.length) {
  
      // --------------------
      // MODE
      // --------------------
  
      const spaceIndex = content.indexOf(32, i);
  
      const mode = content.slice(i, spaceIndex).toString();
  
      i = spaceIndex + 1;
    
  
      // --------------------
      // FILENAME
      // --------------------
  // 040000 file name\0 <raw sha20>
      const nullIndex = content.indexOf(0, i);
  
      const filename = content.slice(i, nullIndex).toString();
  
      i = nullIndex + 1;
  
  
      // --------------------
      // SHA (20 RAW BYTES)
      // --------------------
  
      const shaBuffer = content.slice(i, i + 20);
  
      const shaHex = shaBuffer.toString("hex");
  
      i += 20;
  
  
      // --------------------
      // TYPE
      // --------------------
  
      const objectType =
        mode === "040000"
          ? "tree"
          : "blob";
  
  
      // --------------------
      // PRINT
      // --------------------
  
      process.stdout.write(`${mode} ${objectType} ${shaHex} ${filename}\n`);
    }
  }
    break;
  case "hash-object":
    const readFile = args[2];
    const fileContent = fs.readFileSync(readFile);
    const fileLength = fileContent.length;
    const header2 = `blob ${fileLength}\0`;
    const store = Buffer.concat([Buffer.from(header2), fileContent]);
    const sha2 = createHash("sha1").update(store).digest("hex");
    const compressed2 = await deflateAsync(store);
    const first = sha2.slice(0, 2);
    const second = sha2.slice(2);
    const objectPath = path.join('.git/objects', first, second);
    fs.mkdirSync(path.join('.git/objects', first), { recursive: true });
    fs.writeFileSync(objectPath, compressed2);
    process.stdout.write(sha2);    
    break;
  case "write-tree":
    const sha4 = writeTree(".");
    process.stdout.write(sha4);
    break;
  default:
    throw new Error(`Unknown command ${command}`);

}

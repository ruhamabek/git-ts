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
    const nullIndex = original.indexOf(0);
    const header = original.slice(0, nullIndex).toString();
    const type = header.split(" ")[0];
    const content = original.slice(nullIndex + 1);
    if (type === "blob" || type === "commit") {
      process.stdout.write(content.toString());
    }
    if (type === "tree") {
      let i = 0;
      while (i < content.length) {
        const spaceIndex = content.indexOf(32, i);
        const mode = content.slice(i, spaceIndex).toString();
      i = spaceIndex + 1;
      const nullIndex = content.indexOf(0, i);
      const filename = content.slice(i, nullIndex).toString();
      i = nullIndex + 1;
      const shaBuffer = content.slice(i, i + 20);
      const shaHex = shaBuffer.toString("hex");
      i += 20;
      const objectType =
        mode === "040000"
          ? "tree"
          : "blob";
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
  case "commit-tree":
    const treeSha = args[1];
    const parentFlagIndex = args.indexOf("-p");
    const parentSha = parentFlagIndex !== -1 ? args[parentFlagIndex + 1] : null;
    const commitContent =
`tree ${treeSha}
${parentSha ? `parent ${parentSha}\n` : ''}
author Ruhama <ruhama@example.com> 1715550000 +0300
committer Ruhama <ruhama@example.com> 1715550000 +0300

Initial commit
`;
    const header3 = `commit ${commitContent.length}\0`;
    const store3 = Buffer.concat([Buffer.from(header3), Buffer.from(commitContent)]);
    const commitSha = createHash("sha1").update(store3).digest("hex");
    const compressed3 = await deflateAsync(store3);
    const first3 = commitSha.slice(0, 2);
    const second3 = commitSha.slice(2);
    const objectPath3 = path.join('.git/objects', first3, second3);
    fs.mkdirSync(path.join('.git/objects', first3), { recursive: true });
    fs.writeFileSync(objectPath3, compressed3);
    process.stdout.write(commitSha);
    break;
  case "update-ref":
    const ref = args[1]; //ref/heads/main
    const sha5 = args[2]; //commit-sha
    const refPath = path.join('.git', ref); 
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, sha5 + '\n');
    break;
  case "log": {
      const head = fs.readFileSync(path.join('.git', 'HEAD'), 'utf8').trim();
      const ref = head.replace('ref: ', '');
      const commitSha2 = fs.readFileSync(path.join('.git', ref), 'utf8').trim();
      let current: string | null = commitSha2;
      while (current) {
        const objPath = path.join(
          '.git',
          'objects',
          current.slice(0, 2),
          current.slice(2)
        );
        const compressed = fs.readFileSync(objPath);  
        const raw = await inflateAsync(compressed); 
        const content = raw.slice(raw.indexOf(0) + 1).toString();
        process.stdout.write(content + "\n");
        const parentMatch = content.match(/^parent (.+)$/m);
        current = parentMatch ? parentMatch[1] : null;
      }
    
      break;
    }
  default:
    throw new Error(`Unknown command ${command}`);

}

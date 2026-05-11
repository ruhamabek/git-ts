import * as fs from "fs";
import { inflate } from 'node:zlib';
import { promisify } from 'node:util';
import * as path from 'node:path';

const inflateAsync = promisify(inflate);

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "init":
    // You can use print statements as follows for debugging, they'll be visible when running tests.
    console.error("Logs from your program will appear here!");

    // TODO: Uncomment the code below to pass the first stage
    fs.mkdirSync(".git", { recursive: true });
    fs.mkdirSync(".git/objects", { recursive: true });
    fs.mkdirSync(".git/refs", { recursive: true });
    fs.writeFileSync(".git/HEAD", "ref: refs/heads/main\n");
    console.log("Initialized git directory");
    break;
    case "cat-file":
    const sha = args[2];
  
        // Split SHA
        const dir = sha.slice(0, 2);
        const file = sha.slice(2);
  
        // Build git object path
        const objectPath = path.join(".git", "objects", dir, file);
  
        // Read compressed object
        const compressed = fs.readFileSync(objectPath);
  
        // Decompress
        const decompressed = await inflateAsync(compressed);
  
        // Convert to string
        const content = decompressed.toString();
  
        // Remove "blob <size>\0"
        const nullByteIndex = content.indexOf("\0");
        const actualContent = content.slice(nullByteIndex + 1);
  
        // Print without extra newline
        process.stdout.write(actualContent);

    break;
  default:
    throw new Error(`Unknown command ${command}`);

}

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
    const firstPart = sha.slice(0, 2);
    const secondPart = sha.slice(2);
    const filePath = path.join('.git/objects', firstPart, secondPart);
    const compressed = fs.readFileSync(filePath);
    const original = await inflateAsync(compressed);
    const decoded = original.toString();
    const content = decoded.slice(decoded.indexOf("\0") + 1);
    process.stdout.write(content);    
    break;
  default:
    throw new Error(`Unknown command ${command}`);

}

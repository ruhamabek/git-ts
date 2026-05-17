import * as fs from "fs";
import { inflate, deflate } from "node:zlib";
import { promisify } from "node:util";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { getDiff } from "./helper/getDiff";
import { writeTreeFromIndex } from "./helper/writeTreeFromIndex";
import { restoreTree } from "./helper/restoreTree";
import { resolveCommit } from "./helper/resolveCommit";
import { addToIndex } from "./helper/addToIndex";
import { getStatus } from "./helper/getStatus";
import { findMergeBase } from "./helper/findMergeBase";
import { getCommitFiles } from "./helper/getCommitFiles";
import { readBlob } from "./helper/getDiff";
import { mergeText } from "./helper/mergeText";

const inflateAsync = promisify(inflate);
const deflateAsync = promisify(deflate);

const args = process.argv.slice(2);
const command = args[0];

function getHead(): string {
  return fs.readFileSync(".git/HEAD", "utf8").trim();
}

function isRef(head: string): boolean {
  return head.startsWith("ref: ");
}

function resolveHeadCommit(): { ref: string | null; sha: string | null } {
  const head = getHead();

  if (isRef(head)) {
    const ref = head.replace("ref: ", "").trim();
    const refPath = path.join(".git", ref);

    if (!fs.existsSync(refPath)) {
      return { ref, sha: null };
    }

    const sha = fs.readFileSync(refPath, "utf8").trim();
    return { ref, sha: sha.length === 40 ? sha : null };
  }

  return { ref: null, sha: head.length === 40 ? head : null };
}

switch (command) {
case "init": {
    fs.mkdirSync(".git/objects", { recursive: true });
    fs.mkdirSync(".git/refs/heads", { recursive: true });

    fs.writeFileSync(".git/HEAD", "ref: refs/heads/main\n");
    fs.writeFileSync(".git/refs/heads/main", "");

    process.stdout.write("Initialized git directory");
    break;
  }

case "cat-file": {
    const sha = args[2];
    const filePath = path.join(".git/objects", sha.slice(0, 2), sha.slice(2));

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
        const name = content.slice(i, nullIndex).toString();

        i = nullIndex + 1;

        const shaBuf = content.slice(i, i + 20);
        const shaHex = shaBuf.toString("hex");

        i += 20;

        const type = mode === "040000" ? "tree" : "blob";

        process.stdout.write(`${mode} ${type} ${shaHex} ${name}\n`);
      }
    }
    break;
  }

case "hash-object": {
    const file = args[2];
    const content = fs.readFileSync(file);

    const header = `blob ${content.length}\0`;
    const store = Buffer.concat([Buffer.from(header), content]);

    const sha = createHash("sha1").update(store).digest("hex");

    const compressed = await deflateAsync(store);

    const objectPath = path.join(
      ".git/objects",
      sha.slice(0, 2),
      sha.slice(2)
    );

    fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    fs.writeFileSync(objectPath, compressed);

    process.stdout.write(sha);
    break;
  }

case "write-tree": {
    const sha = writeTreeFromIndex();
    process.stdout.write(sha);
    break;
  }

case "commit-tree": {
    const treeSha = args[1];
    const parentIndex = args.indexOf("-p");
    const parentSha =
      parentIndex !== -1 ? args[parentIndex + 1] : null;

    const content =
`tree ${treeSha}
${parentSha ? `parent ${parentSha}\n` : ""}author Ruhama <ruhama@example.com> 1715550000 +0300
committer Ruhama <ruhama@example.com> 1715550000 +0300

Initial commit
`;

    const header = `commit ${Buffer.byteLength(content)}\0`;
    const store = Buffer.concat([Buffer.from(header), Buffer.from(content)]);

    const sha = createHash("sha1").update(store).digest("hex");
    const compressed = await deflateAsync(store);

    const objectPath = path.join(
      ".git/objects",
      sha.slice(0, 2),
      sha.slice(2)
    );

    fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    fs.writeFileSync(objectPath, compressed);

    process.stdout.write(sha);
    break;
  }

case "update-ref": {
    const ref = args[1];
    const sha = args[2];

    const refPath = path.join(".git", ref);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });

    fs.writeFileSync(refPath, sha + "\n");
    break;
  }

case "log": {
    const head = getHead();

    const first = resolveHeadCommit();
    let current = first.sha;

    while (current) {
      const objPath = path.join(
        ".git/objects",
        current.slice(0, 2),
        current.slice(2)
      );

      const compressed = fs.readFileSync(objPath);
      const raw = await inflateAsync(compressed);

      const content = raw.slice(raw.indexOf(0) + 1).toString();
      process.stdout.write(content + "\n");

      const match = content.match(/^parent (.+)$/m);
      current = match ? match[1].trim() : null;
    }

    break;
  }

case "checkout": {
    const target = args[1];

    const branchPath = path.join(".git", "refs", "heads", target);
    const isBranch = fs.existsSync(branchPath);

    const commitSha = resolveCommit(target);

    if (!/^[0-9a-f]{40}$/.test(commitSha)) {
      throw new Error("Invalid commit SHA");
    }

    if (isBranch) {
      fs.writeFileSync(".git/HEAD", `ref: refs/heads/${target}\n`);
    } else {
      fs.writeFileSync(".git/HEAD", commitSha + "\n");
    }

    const objPath = path.join(
      ".git/objects",
      commitSha.slice(0, 2),
      commitSha.slice(2)
    );

    const compressed = fs.readFileSync(objPath);
    const raw = await inflateAsync(compressed);

    const content = raw.slice(raw.indexOf(0) + 1).toString();
    const tree = content.match(/^tree (.+)$/m)?.[1];

    if (!tree) throw new Error("Missing tree");

    await restoreTree(tree, ".");
    break;
  }

case "branch": {
    const name = args[1];

    const { sha } = resolveHeadCommit();

    if (!sha) throw new Error("No commit to branch from");

    const refPath = path.join(".git", "refs/heads", name);

    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, sha + "\n");

    break;
  }

  case "merge": {
    const target = args[1];
  
    const head = getHead();
    if (!isRef(head)) throw new Error("Detached HEAD");
  
    const currentRef = head.replace("ref: ", "").trim();
  
    const currentCommit = fs
      .readFileSync(path.join(".git", currentRef), "utf8")
      .trim();
  
    const targetRef = path.join(".git", "refs", "heads", target);
  
    if (!fs.existsSync(targetRef)) {
      throw new Error("Branch does not exist");
    }
  
    const targetCommit = fs.readFileSync(targetRef, "utf8").trim();
  
     const baseCommit = findMergeBase(currentCommit, targetCommit);
  
    const safeBase =
      baseCommit && /^[0-9a-f]{40}$/.test(baseCommit)
        ? baseCommit
        : null;
  
 
    const baseFiles = safeBase ? getCommitFiles(safeBase) : {};
    const ourFiles = getCommitFiles(currentCommit);
    const theirFiles = getCommitFiles(targetCommit);
  
    const allFiles = new Set([
      ...Object.keys(baseFiles),
      ...Object.keys(ourFiles),
      ...Object.keys(theirFiles),
    ]);
  
    const load = (sha?: string) => {
      if (!sha) return "";
      return readBlob(sha);
    };
  
    let hasConflict = false;
  
     for (const file of allFiles) {
      const base = load(baseFiles[file]);
      const ours = load(ourFiles[file]);
      const theirs = load(theirFiles[file]);
  
      const merged = mergeText(base, ours, theirs, target);
  
      if (merged.includes("<<<<<<<")) {
        hasConflict = true;
      }
  
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, merged);
  
      addToIndex(file);
    }
  
     const treeSha = writeTreeFromIndex();
  
    const content =
  `tree ${treeSha}
  parent ${currentCommit}
  parent ${targetCommit}
  author Ruhama <ruhama@example.com> 1715550000 +0300
  committer Ruhama <ruhama@example.com> 1715550000 +0300
  
  Merge branch '${target}'
  `;
  
    const header = `commit ${Buffer.byteLength(content)}\0`;
    const store = Buffer.concat([Buffer.from(header), Buffer.from(content)]);
  
    const sha = createHash("sha1").update(store).digest("hex");
    const compressed = await deflateAsync(store);
  
    const objectPath = path.join(
      ".git",
      "objects",
      sha.slice(0, 2),
      sha.slice(2)
    );
  
    fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    fs.writeFileSync(objectPath, compressed);
  
    fs.writeFileSync(path.join(".git", currentRef), sha + "\n");
  
    if (hasConflict) {
      process.stdout.write("Merge completed with conflicts");
    } else {
      process.stdout.write("Merge completed successfully");
    }
  
    break;
  }
    
case "add": {
    addToIndex(args[1]);
    break;
  }

case "commit": {
    const msgIndex = args.indexOf("-m");
    if (msgIndex === -1) throw new Error("Missing message");

    const message = args[msgIndex + 1];

    const treeSha = writeTreeFromIndex();
    const { ref, sha: parentSha } = resolveHeadCommit();

    const content =
`tree ${treeSha}
${parentSha ? `parent ${parentSha}\n` : ""}author Ruhama <ruhama@example.com> 1715550000 +0300
committer Ruhama <ruhama@example.com> 1715550000 +0300

${message}
`;

    const header = `commit ${Buffer.byteLength(content)}\0`;
    const store = Buffer.concat([Buffer.from(header), Buffer.from(content)]);

    const commitSha = createHash("sha1").update(store).digest("hex");
    const compressed = await deflateAsync(store);

    const objectPath = path.join(
      ".git/objects",
      commitSha.slice(0, 2),
      commitSha.slice(2)
    );

    fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    fs.writeFileSync(objectPath, compressed);

    if (ref) {
      fs.writeFileSync(path.join(".git", ref), commitSha + "\n");
    } else {
      fs.writeFileSync(".git/HEAD", commitSha + "\n");
    }

    process.stdout.write(commitSha);
    break;
  }
case "status": {
    const result = getStatus();
    process.stdout.write(result);
    break;
  }
case "diff": {
    process.stdout.write(getDiff());
    break;
  }
  default:
    throw new Error(`Unknown command ${command}`);
}
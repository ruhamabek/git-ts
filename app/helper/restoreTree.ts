import fs from "fs"
import path from "path"
import { inflate } from 'node:zlib';
import { promisify } from 'node:util';

const inflateAsync = promisify(inflate);

export async function restoreTree(treeSha: string, dir: string) {
  const treePath = path.join(
      ".git/objects",
      treeSha.slice(0, 2),
      treeSha.slice(2)
    );
    const compressedTree = fs.readFileSync(treePath);
    const rawTree = await inflateAsync(compressedTree);
    const content = rawTree.slice(rawTree.indexOf(0) + 1);

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

      if (mode === "100644") {
        const blobPath = path.join(
          ".git/objects",
          shaHex.slice(0, 2),
          shaHex.slice(2)
        );

        const compressedBlob = fs.readFileSync(blobPath);
        const rawBlob = await inflateAsync(compressedBlob);
        const blobContent = rawBlob.slice(rawBlob.indexOf(0) + 1);

        fs.writeFileSync(
          path.join(dir, filename),
          blobContent
        );
      }
      else if (mode === "040000") {
        const subDir = path.join(dir, filename);
        fs.mkdirSync(subDir, { recursive: true });
        await restoreTree(shaHex, subDir);
      }
    }
  }
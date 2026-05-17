import { getCommitTree } from "./getCommitTree";
import { flattenTree } from "./getStatus";

export function getCommitFiles(
  commitSha: string
): Record<string, string> {
  const treeSha = getCommitTree(commitSha);

  return flattenTree(treeSha);
}
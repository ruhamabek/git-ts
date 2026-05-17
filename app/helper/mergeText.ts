export function mergeText(
  base: string,
  ours: string,
  theirs: string,
  branchName: string
): string {
  const baseLines = base.split("\n");
  const ourLines = ours.split("\n");
  const theirLines = theirs.split("\n");

  const max = Math.max(
    baseLines.length,
    ourLines.length,
    theirLines.length
  );

  let output = "";

  for (let i = 0; i < max; i++) {
    const b = baseLines[i] ?? "";
    const o = ourLines[i] ?? "";
    const t = theirLines[i] ?? "";

    // same result
    if (o === t) {
      output += o + "\n";
      continue;
    }

    // only they changed
    if (b === o) {
      output += t + "\n";
      continue;
    }

    // only we changed
    if (b === t) {
      output += o + "\n";
      continue;
    }

    // CONFLICT
    output += `<<<<<<< HEAD\n`;
    output += `${o}\n`;
    output += `=======\n`;
    output += `${t}\n`;
    output += `>>>>>>> ${branchName}\n`;
  }

  return output;
}
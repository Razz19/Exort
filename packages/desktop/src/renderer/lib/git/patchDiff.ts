/**
 * Reconstruct the original and modified sides of a file from a unified-diff patch.
 *
 * Agent "last turn" changes carry a unified-diff `patch` but no Git HEAD reference, so we rebuild
 * both sides directly from the hunks: context lines (` `) belong to both, removed lines (`-`) to the
 * original only, and added lines (`+`) to the modified only. Only the regions covered by hunks are
 * reconstructed, which is enough to render a faithful inline diff.
 */
export function patchToOriginalModified(patch: string): { original: string; modified: string } {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  let inHunk = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    // File headers / metadata that can appear between hunks.
    if (
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('rename ') ||
      line.startsWith('similarity ')
    ) {
      inHunk = false;
      continue;
    }

    if (line.startsWith('\\')) {
      // "\ No newline at end of file" — ignore.
      continue;
    }

    const marker = line[0] ?? ' ';
    const content = line.slice(1);

    if (marker === '+') {
      modifiedLines.push(content);
    } else if (marker === '-') {
      originalLines.push(content);
    } else {
      // Context line (leading space, or an empty line).
      originalLines.push(content);
      modifiedLines.push(content);
    }
  }

  return {
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n')
  };
}

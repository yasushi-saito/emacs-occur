import * as vscode from "vscode";

interface OccurResult {
  // The formatted text of all matching lines, where each line is prefixed
  // with its 1-based line number padded to 7 characters, followed by ": " and
  // the full line text. Lines are separated by newlines.
  // Example:
  // " 1: first matching line\n 3: third matching line"
  matchText: string;
  // For each match, the points to the matched word in the occur buffer.
  matchRanges: vscode.Range[];
}

// Find occurrences of regexp `searchText` within `searchRange` of the
// `document` and return the formatted result text and the ranges of matches in
// the result text.
export function getOccurResults(
  document: vscode.TextDocument,
  searchText: string,
  searchRange: vscode.Range,
): OccurResult {
  const regex = new RegExp(searchText, "g");
  let matchTexts: string[] = [];
  let matchRanges: vscode.Range[] = [];

  // TODO: handle the case where searchRanges convers a partial line.
  const startLine = Math.max(0, searchRange.start.line);
  const endLine = Math.min(document.lineCount, searchRange.end.line);

  for (let i = startLine; i < endLine; i++) {
    const line = document.lineAt(i);
    const matches = [...line.text.matchAll(regex)];
    if (matches.length > 0) {
      const lineNumber = (i + 1).toString().padStart(7, " ");
      const resultLine = `${lineNumber}: ${line.text}`;
      matchTexts.push(resultLine);

      // Compute ranges in this resultLine
      const prefixLength = lineNumber.length + 2; // length of "      3: "
      for (const match of matches) {
        if (match.index !== undefined) {
          const start = prefixLength + match.index;
          const end = start + match[0].length;
          matchRanges.push(
            new vscode.Range(
              matchTexts.length - 1,
              start,
              matchTexts.length - 1,
              end,
            ),
          );
        }
      }
    }
  }

  const matchText = matchTexts.join("\n");
  return { matchText, matchRanges };
}

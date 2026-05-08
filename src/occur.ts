import * as vscode from "vscode";

interface OccurResult {
    // The formatted text of all matching lines, where each line is prefixed
    // with its 1-based line number padded to 7 characters, followed by ": " and
    // the full line text. Lines are separated by newlines.
    // Example:
    // " 1: first matching line\n 3: third matching line"
    matchText: string;
    matchRanges: vscode.Range[];
};

// Find occurrences of regexp `searchText` within `document` and return the formatted result text and the ranges of matches in the result text.
export function getOccurResults(document: vscode.TextDocument, searchText: string): OccurResult {
    const regex = new RegExp(searchText, 'g');
    let results: string[] = [];
    let matchRanges: vscode.Range[] = [];
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const matches = [...line.text.matchAll(regex)];
        if (matches.length > 0) {
            const lineNumber = (i+1).toString().padStart(7, " ");
            const resultLine = `${lineNumber}: ${line.text}`;
            results.push(resultLine);

            // Compute ranges in this resultLine
            const prefixLength = lineNumber.length + 2; // length of "      3: "
            for (const match of matches) {
                if (match.index !== undefined) {
                    const start = prefixLength + match.index;
                    const end = start + match[0].length;
                    matchRanges.push(new vscode.Range(results.length - 1, start, results.length - 1, end));
                }
            }
        }
    }

    const matchText = results.join('\n');
    return { matchText, matchRanges };
}

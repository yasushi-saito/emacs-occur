import * as vscode from "vscode";

interface OccurResult {
    matchText: string;
    matchRanges: vscode.Range[];
};

export function getOccurResults(document: vscode.TextDocument, searchText: string): OccurResult {
    let results: string[] = [];
    let matchRanges: vscode.Range[] = [];
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.text.includes(searchText)) {
            const lineNumber = (i+1).toString().padStart(7, " ");
            const resultLine = `${lineNumber}: ${line.text}`;
            results.push(resultLine);
            
            // Compute ranges in this resultLine
            const prefixLength = lineNumber.length + 2; // length of "      3: "
            let index = resultLine.indexOf(searchText, prefixLength);
            while (index !== -1) {
                matchRanges.push(new vscode.Range(results.length - 1, index, results.length - 1, index + searchText.length));
                index = resultLine.indexOf(searchText, index + searchText.length);
            }
        }
    }

    const matchText = results.join('\n');
    return { matchText, matchRanges };
}

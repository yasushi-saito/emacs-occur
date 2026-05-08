import * as vscode from "vscode";
import assert from "assert";
import { getOccurResults } from "../../occur";

suite("getOccurResults", () => {
    test("single match", async () => {
        const text = "line1\nline2\nmatch line\nline4";
        const searchText = "match";
        const expectedMatchText = "      3: match line";
        const expectedRanges = [new vscode.Range(0, 9, 0, 14)];
        
        const document = await vscode.workspace.openTextDocument({ content: text });
        const result = getOccurResults(document, searchText);
        
        assert.strictEqual(result.matchText, expectedMatchText);
        assert.deepStrictEqual(result.matchRanges, expectedRanges);
    });

    test("multiple matches", async () => {
        const text = "match1\nline2\nmatch2\nline4";
        const searchText = "match";
        const expectedMatchText = "      1: match1\n      3: match2";
        const expectedRanges = [
            new vscode.Range(0, 9, 0, 14),
            new vscode.Range(1, 9, 1, 14)
        ];
        
        const document = await vscode.workspace.openTextDocument({ content: text });
        const result = getOccurResults(document, searchText);
        
        assert.strictEqual(result.matchText, expectedMatchText);
        assert.deepStrictEqual(result.matchRanges, expectedRanges);
    });

    test("no matches", async () => {
        const text = "line1\nline2\nline3";
        const searchText = "match";
        const expectedMatchText = "";
        const expectedRanges: vscode.Range[] = [];
        
        const document = await vscode.workspace.openTextDocument({ content: text });
        const result = getOccurResults(document, searchText);
        
        assert.strictEqual(result.matchText, expectedMatchText);
        assert.deepStrictEqual(result.matchRanges, expectedRanges);
    });

    test("case sensitive match", async () => {
        const text = "match\nMatch\nMATCH";
        const searchText = "match";
        const expectedMatchText = "      1: match";
        const expectedRanges = [new vscode.Range(0, 9, 0, 14)];
        
        const document = await vscode.workspace.openTextDocument({ content: text });
        const result = getOccurResults(document, searchText);
        
        assert.strictEqual(result.matchText, expectedMatchText);
        assert.deepStrictEqual(result.matchRanges, expectedRanges);
    });
});

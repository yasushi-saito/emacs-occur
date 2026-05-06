import * as assert from "assert";
import { getOccurResults } from "../../occur";

function runTests() {
    console.log("Running tests...");

    // Test 1
    {
        const text = "line1\nline2\nmatch line\nline4";
        const searchText = "match";
        const expected = ["      3: match line"];
        
        const result = getOccurResults(text, searchText);
        
        assert.deepStrictEqual(result, expected);
        console.log("Test 1 passed");
    }

    // Test 2
    {
        const text = "match1\nline2\nmatch2\nline4";
        const searchText = "match";
        const expected = ["      1: match1", "      3: match2"];
        
        const result = getOccurResults(text, searchText);
        
        assert.deepStrictEqual(result, expected);
        console.log("Test 2 passed");
    }

    // Test 3
    {
        const text = "line1\nline2\nline3";
        const searchText = "match";
        const expected: string[] = [];
        
        const result = getOccurResults(text, searchText);
        
        assert.deepStrictEqual(result, expected);
        console.log("Test 3 passed");
    }

    // Test 4
    {
        const text = "match\nMatch\nMATCH";
        const searchText = "match";
        const expected = ["      1: match"];
        
        const result = getOccurResults(text, searchText);
        
        assert.deepStrictEqual(result, expected);
        console.log("Test 4 passed");
    }

    console.log("All tests passed!");
}

runTests();

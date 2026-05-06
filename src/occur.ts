export function getOccurResults(text: string, searchText: string, basename: string): string[] {
    const lines = text.split(/\r?\n/);
    let results: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(searchText)) {
            results.push(`${basename}:${i + 1}: ${line}`);
        }
    }
    return results;
}

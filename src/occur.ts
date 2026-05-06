export function getOccurResults(text: string, searchText: string): string[] {
    const lines = text.split(/\r?\n/);
    let results: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(searchText)) {
            const lineNumber = (i+1).toString().padStart(7, " ");
            results.push(`${lineNumber}: ${line}`);
        }
    }
    return results;
}

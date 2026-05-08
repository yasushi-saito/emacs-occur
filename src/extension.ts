import * as vscode from 'vscode';
import * as path from 'path';
import { getOccurResults } from './occur';

interface OccurData {
    content: string; // The formatted search results as a single string with lines joined by '\n'
    originalUri: vscode.Uri; // The URI of the original file that was searched
    searchText: string; // The exact search text used to build the occur buffer
    decorationType?: vscode.TextEditorDecorationType; // Decoration type for highlighting matches
    ranges: vscode.Range[]; // Precomputed ranges for occur buffer highlights
}

/**
 * Maps the URI of the occur buffer to its data.
 * Key: occur URI as string (e.g., "occur://path/to/file/*occur-filename*")
 * Value: OccurData containing the formatted search results and original file URI
 */
let occurDataMap = new Map<string, OccurData>();

function buildOccurHighlightRanges(content: string, searchText: string): vscode.Range[] {
    const ranges: vscode.Range[] = [];
    const lines = content.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
        const text = lines[line];
        const prefixMatch = text.match(/^\s*\d+:\s*/);
        const prefixLength = prefixMatch ? prefixMatch[0].length : 0;
        let index = text.indexOf(searchText, prefixLength);
        while (index !== -1) {
            ranges.push(new vscode.Range(line, index, line, index + searchText.length));
            index = text.indexOf(searchText, index + searchText.length);
        }
    }
    return ranges;
}

function setOccurDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor || editor.document.uri.scheme !== 'occur') {
        return;
    }
    const occurData = occurDataMap.get(editor.document.uri.toString());
    if (!occurData || !occurData.decorationType) {
        return;
    }
    editor.setDecorations(occurData.decorationType, occurData.ranges);
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new OccurContentProvider();
    const registration = vscode.workspace.registerTextDocumentContentProvider('occur', provider);
    context.subscriptions.push(registration);

    let occurTextCmd = vscode.commands.registerCommand('emacs-occur.occurtext', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor');
            return;
        }

        const searchText = await vscode.window.showInputBox({
            prompt: 'Enter text to search for',
            placeHolder: 'search text'
        });

        if (!searchText) {
            return;
        }

        const doc = editor.document;
        const results = getOccurResults(doc.getText(), searchText);

        if (results.length === 0) {
            vscode.window.showInformationMessage('No matches found');
            return;
        }

        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.3)', // Light yellow background
            border: '1px solid rgba(255, 255, 0, 0.5)'
        });

        const originalUri = doc.uri;
        const basename = path.basename(doc.uri.fsPath)
        const occurUri = vscode.Uri.parse(`occur://${originalUri.fsPath}/*occur-${basename}*`);
        if (occurUri === undefined) {
            throw new Error("No buffer found");
        }

        const content = results.join('\n');
        occurDataMap.set(occurUri.toString(), {
            content: content,
            originalUri: originalUri,
            searchText: searchText,
            decorationType: decorationType,
            ranges: buildOccurHighlightRanges(content, searchText)
        });
        provider.update(occurUri);

        try {
            const occurDoc = await vscode.workspace.openTextDocument(occurUri);
            const occurEditor = await vscode.window.showTextDocument(occurDoc, { preview: false });
            setOccurDecorations(occurEditor);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to open occur buffer: ${e.message}`);
        }
    });

    context.subscriptions.push(occurTextCmd);

    async function jumpToOccurLine(editor: vscode.TextEditor | undefined) {
        if (!editor) return;

        const doc = editor.document;
        if (doc.uri.scheme !== 'occur') return;

        const position = editor.selection.active;
        const lineText = doc.lineAt(position.line).text;

        const match = lineText.match(/^ *(\d+):/);
        if (!match) return;

        const targetLine = parseInt(match[1], 10);

        try {
            const occurData = occurDataMap.get(doc.uri.toString());
            if (occurData === undefined) {
                throw new Error("No buffer found");
            }
            const originalUri = occurData.originalUri;
            const originalDoc = await vscode.workspace.openTextDocument(originalUri);
            const originalEditor = await vscode.window.showTextDocument(originalDoc);

            const range = originalDoc.lineAt(targetLine - 1).range;
            originalEditor.selection = new vscode.Selection(range.start, range.end);
            originalEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to open original file: ${e.message}`);
        }
    }

    let jumpCmd = vscode.commands.registerCommand('emacs-occur.jump', async () => {
        await jumpToOccurLine(vscode.window.activeTextEditor);
    });

    context.subscriptions.push(jumpCmd);

    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
        const uriString = document.uri.toString();
        const urisToDelete: string[] = [uriString];

        // The document may be either the original one, or the occur buffer. In
        // case it is the original file, find the matching occur buffer.
        for (const [key, occurData] of occurDataMap.entries()) {
          if (occurData.originalUri.toString() == uriString) {
            urisToDelete.push(key);
          }
        }

        for (const key of urisToDelete) {
          const occurData = occurDataMap.get(key);
          if (occurData?.decorationType) {
            occurData.decorationType.dispose();
          }
          occurDataMap.delete(key);
        }
    }));

    let quitCmd = vscode.commands.registerCommand('emacs-occur.quit', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        if (doc.uri.scheme !== 'occur') return;

        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        updateOccurContext(vscode.window.activeTextEditor);
    });

    context.subscriptions.push(quitCmd);

    const updateOccurContext = (editor: vscode.TextEditor | undefined) => {
        if (editor && editor.document.uri.scheme === 'occur') {
            vscode.commands.executeCommand('setContext', 'emacs-occur.active', true);
            setOccurDecorations(editor);
        } else {
            vscode.commands.executeCommand('setContext', 'emacs-occur.active', false);
        }
    };

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateOccurContext));
}

class OccurContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        const occurData = occurDataMap.get(uri.toString());
        return occurData ? occurData.content : 'No results';
    }

    update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }
}

export function deactivate() { }

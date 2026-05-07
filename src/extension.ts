import * as vscode from 'vscode';
import * as path from 'path';
import { getOccurResults } from './occur';

let resultsMap = new Map<string, string>();

// Maps the URI of the occur buffer (`occur://<fspath>/*tmp-occur*`) to
// the URI of the original file.
let occurUriToOrigUriMap = new Map<string, vscode.Uri>();

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

        const originalUri = doc.uri;
        const basename = path.basename(doc.uri.fsPath)
        const occurUri = vscode.Uri.parse(`occur://${originalUri.fsPath}/*occur-${basename}*`);
        if (occurUri === undefined) {
            throw new Error("No buffer found");
        }

        resultsMap.set(occurUri.toString(), results.join('\n'));
        occurUriToOrigUriMap.set(occurUri.toString(), originalUri);
        provider.update(occurUri);

        try {
            const occurDoc = await vscode.workspace.openTextDocument(occurUri);
            await vscode.window.showTextDocument(occurDoc, { preview: false });
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to open occur buffer: ${e.message}`);
        }
    });

    context.subscriptions.push(occurTextCmd);

    let jumpCmd = vscode.commands.registerCommand('emacs-occur.jump', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        if (doc.uri.scheme !== 'occur') return;

        const position = editor.selection.active;
        const lineText = doc.lineAt(position.line).text;

        const match = lineText.match(/^ *(\d+):/);
        if (!match) return;

        const targetLine = parseInt(match[1], 10);

        try {
            const originalUri = occurUriToOrigUriMap.get(doc.uri.toString());
            if (originalUri === undefined) {
                throw new Error("No buffer found");
            }
            const originalDoc = await vscode.workspace.openTextDocument(originalUri);
            const originalEditor = await vscode.window.showTextDocument(originalDoc);

            const range = originalDoc.lineAt(targetLine - 1).range;
            originalEditor.selection = new vscode.Selection(range.start, range.end);
            originalEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to open original file: ${e.message}`);
        }
    });

    context.subscriptions.push(jumpCmd);

    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
        const uriString = document.uri.toString();
        const urisToDelete: string[] = [uriString];

        // The document may be either the original one, or the occur buffer. In
        // case it is the original file, find the matching occur buffer.
        for (const [key, val] of occurUriToOrigUriMap.entries()) {
          if (val.toString() == uriString) {
            urisToDelete.push(key);
          }
        }

        for (const key of urisToDelete) {
          resultsMap.delete(key);
          occurUriToOrigUriMap.delete(key);
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
        } else {
            vscode.commands.executeCommand('setContext', 'emacs-occur.active', false);
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateOccurContext));
}

class OccurContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return resultsMap.get(uri.toString()) || 'No results';
    }

    update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }
}

export function deactivate() { }

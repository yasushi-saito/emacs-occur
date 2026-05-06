import * as vscode from 'vscode';
import * as path from 'path';
import { getOccurResults } from './occur';

let resultsMap = new Map<string, string>();

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
        const results = getOccurResults(doc.getText(), searchText, path.basename(doc.uri.fsPath));

        if (results.length === 0) {
            vscode.window.showInformationMessage('No matches found');
            return;
        }

        const originalUri = doc.uri;
        const occurUri = vscode.Uri.parse(`occur://${originalUri.fsPath}/*tmp-occur*`);

        resultsMap.set(occurUri.toString(), results.join('\n'));
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

        const match = lineText.match(/^([^:]+):(\d+):/);
        if (!match) return;

        const targetLine = parseInt(match[2], 10);

        const occurUri = doc.uri;
        const originalFilePath = occurUri.path.slice(0, -12); // Remove '/*tmp-occur*'
        const originalUri = vscode.Uri.file(originalFilePath);

        try {
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

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.uri.scheme === 'occur') {
            vscode.commands.executeCommand('setContext', 'emacs-occur.active', true);
        } else {
            vscode.commands.executeCommand('setContext', 'emacs-occur.active', false);
        }
    }));
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

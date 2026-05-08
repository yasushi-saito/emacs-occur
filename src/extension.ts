import * as vscode from "vscode";
import * as path from "path";
import { getOccurResults } from "./occur";

interface OccurData {
  content: string; // The formatted search results as a single string with lines joined by '\n'
  originalUri: vscode.Uri; // The URI of the original file that was searched
  searchText: string; // The exact search text used to build the occur buffer
  ranges: vscode.Range[]; // Precomputed ranges for occur buffer highlights
}

// A global maps of the URI of the occur buffer to its data.
//
// Key: occur URI as string (e.g., "occur://path/to/file/*occur-filename*")
// Value: OccurData containing the formatted search results and original file URI
let occurDataMap = new Map<string, OccurData>();

// Called before the given document is deleted. It deletes the entry from
// occurDataMap.
function deleteOccurDataForDocument(document: vscode.TextDocument) {
  const uriString = document.uri.toString();
  const urisToDelete: string[] = [uriString];

  // The document may be either the original one, or the occur buffer. In
  // case it is the original file, find the matching occur buffer.
  for (const [key, occurData] of occurDataMap.entries()) {
    if (occurData.originalUri.toString() == document.uri.toString()) {
      urisToDelete.push(key);
    }
  }

  for (const key of urisToDelete) {
    occurDataMap.delete(key);
  }
}

function setOccurDecorations(editor: vscode.TextEditor | undefined) {
  if (!editor || editor.document.uri.scheme !== "occur") {
    return;
  }

  const occurData = occurDataMap.get(editor.document.uri.toString());
  if (!occurData) {
    return;
  }
  editor.setDecorations(highlightDecoration, occurData.ranges);
}

// Called when the active editor changes. Changes the context
// `emacs-occur.active` used to control the key bindings.
function updateOccurContext(editor: vscode.TextEditor | undefined) {
  if (editor && editor.document.uri.scheme === "occur") {
    vscode.commands.executeCommand("setContext", "emacs-occur.active", true);
    setOccurDecorations(editor);
  } else {
    vscode.commands.executeCommand("setContext", "emacs-occur.active", false);
  }
}

// Decoration type for highlighting matches in the occur buffer.
const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255, 255, 0, 0.3)", // Light yellow background
  border: "1px solid rgba(255, 255, 0, 0.5)",
});

// The main command. Takes a regex from the input box and create an occor text window.
async function occurRegexCommand(provider: OccurContentProvider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor");
    return;
  }

  const searchText = await vscode.window.showInputBox({
    prompt: "Enter text to search for",
    placeHolder: "search text",
  });

  if (!searchText) {
    return;
  }

  // If the selection is empty, search the from the current cursor to the end of
  // the document. Otherwise, search the selected range.
  const document = editor.document;
  const searchRange = editor.selection.isEmpty
    ? new vscode.Range(
        editor.selection.active,
        new vscode.Position(document.lineCount + 1, 0),
      )
    : editor.selection;

  const occurResult = getOccurResults(document, searchText, searchRange);
  if (occurResult.matchRanges.length === 0) {
    vscode.window.showInformationMessage("No matches found");
    return;
  }

  const originalUri = document.uri;
  const basename = path.basename(document.uri.fsPath);
  const occurUri = vscode.Uri.parse(
    `occur://${originalUri.fsPath}/*occur-${basename}*`,
  );
  if (occurUri === undefined) {
    throw new Error("No buffer found");
  }

  occurDataMap.set(occurUri.toString(), {
    content: occurResult.matchText,
    originalUri: originalUri,
    searchText: searchText,
    ranges: occurResult.matchRanges,
  });
  provider.update(occurUri);

  try {
    const occurDoc = await vscode.workspace.openTextDocument(occurUri);
    const occurEditor = await vscode.window.showTextDocument(occurDoc, {
      preview: false,
    });
    updateOccurContext(occurEditor);
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to open occur buffer: ${e.message}`);
  }
}

// Command to jump to the original file:line corresponding to the current line in the occur buffer.
async function jumpToOccurLineCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const doc = editor.document;
  if (doc.uri.scheme !== "occur") return;

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
    const originalDoc = await vscode.workspace.openTextDocument(
      occurData.originalUri,
    );
    const originalEditor = await vscode.window.showTextDocument(originalDoc);
    //, {
    //preview: false,
    //preserveFocus: true,
    //    });

    const range = originalDoc.lineAt(targetLine - 1).range;
    originalEditor.selection = new vscode.Selection(range.start, range.end);
    originalEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (e: any) {
    vscode.window.showErrorMessage(
      `Failed to open original file: ${e.message}`,
    );
  }
}

// Command to close the occur buffer.
async function quitCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const doc = editor.document;
  if (doc.uri.scheme !== "occur") return;

  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  updateOccurContext(editor);
}

class OccurContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const occurData = occurDataMap.get(uri.toString());
    return occurData ? occurData.content : "No results";
  }

  update(uri: vscode.Uri) {
    this._onDidChange.fire(uri);
  }
}

// The main entrypoint.
export function activate(context: vscode.ExtensionContext) {
  const provider = new OccurContentProvider();
  const registration = vscode.workspace.registerTextDocumentContentProvider(
    "occur",
    provider,
  );
  context.subscriptions.push(registration);

  let cmd = vscode.commands.registerCommand(
    "emacs-occur.occurRegex",
    async () => {
      occurRegexCommand(provider);
    },
  );
  context.subscriptions.push(cmd);

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs-occur.jump", jumpToOccurLineCommand),
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
      deleteOccurDataForDocument(document);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs-occur.quit", quitCommand),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateOccurContext),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme === "occur") {
        setTimeout(() => updateOccurContext(vscode.window.activeTextEditor), 0);
      }
    }),
  );
}

export function deactivate() {}

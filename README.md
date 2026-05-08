## Emacs-occur

VSCode extension for emulating the Emacs "occur" command.

## Usage:

From the command palette, invoke `emacs-occur.occurRegex` or `Occur Regex`. It
will ask for a regex in a dialog. It then creates a new editor (buffer) named
`*occur-{basename}*`, with a line for each match.

In the occur editor you can use the following commands:

- `Enter` jumps to the matched line.
- `q` closes the buffer.

## Building and installing

```
npm install --include=dev
npm run compile
```

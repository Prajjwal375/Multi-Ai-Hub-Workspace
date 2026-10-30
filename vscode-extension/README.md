# SaKAi Hub Bridge (VS Code Extension)

Syncs your **active editor file** and **file saves** with the SaKAi Hub desktop app
so every AI model you chat with always knows exactly what you're looking at.

## How it works

```
VS Code  ──ws://localhost:54321──►  SaKAi Hub desktop app
  active editor changes  ────────►  active-file event → highlights file in Context Panel
  file saved             ────────►  file-saved event  → refreshes the mirror
```

- Connects to the SaKAi Hub WebSocket server on `ws://localhost:54321`
- Auto-reconnects every 5 seconds if the app isn't running
- Shows connection status in the status bar:
  - `✓ SaKAi Hub: Connected`
  - `⚡ SaKAi Hub: Disconnected` (click to retry)

## Install (development)

```bash
cd vscode-extension
npm install
npm run compile
```

Then press **F5** in VS Code to launch an Extension Development Host,
or package it with `vsce package` and install the `.vsix`.

## Requirements

- The SaKAi Hub desktop app must be running with a project open.
- The WebSocket server listens only while a project is open.

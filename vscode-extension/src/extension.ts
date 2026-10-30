import * as vscode from 'vscode'
import { WsClient } from './wsClient'

let client: WsClient
let statusBar: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
  client = new WsClient()

  // Status bar item
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBar.command = 'sakaiHub.reconnect'
  updateStatus(false)
  statusBar.show()
  context.subscriptions.push(statusBar)

  client.onStatusChange((connected) => {
    updateStatus(connected)
    // On (re)connect, immediately push the current active file
    if (connected) sendActiveFile(vscode.window.activeTextEditor)
  })

  client.connect()

  // Active editor changed → send active-file
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      sendActiveFile(editor)
    })
  )

  // File saved → send file-saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme !== 'file') return
      client.send({ type: 'file-saved', path: doc.uri.fsPath })
    })
  )

  // Manual reconnect command
  context.subscriptions.push(
    vscode.commands.registerCommand('sakaiHub.reconnect', () => {
      client.connect()
      vscode.window.showInformationMessage('SaKAi Hub: reconnecting…')
    })
  )

  // Send the current file on activation
  sendActiveFile(vscode.window.activeTextEditor)

  context.subscriptions.push({ dispose: () => client.dispose() })
}

export function deactivate() {
  client?.dispose()
}

function sendActiveFile(editor: vscode.TextEditor | undefined) {
  if (!editor || editor.document.uri.scheme !== 'file') return
  client.send({ type: 'active-file', path: editor.document.uri.fsPath })
}

function updateStatus(connected: boolean) {
  if (!statusBar) return
  if (connected) {
    statusBar.text = '$(check) SaKAi Hub: Connected'
    statusBar.tooltip = 'Connected to SaKAi Hub desktop app'
    statusBar.backgroundColor = undefined
  } else {
    statusBar.text = '$(debug-disconnect) SaKAi Hub: Disconnected'
    statusBar.tooltip = 'SaKAi Hub desktop app not reachable — click to retry'
    statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
  }
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const wsClient_1 = require("./wsClient");
let client;
let statusBar;
function activate(context) {
    client = new wsClient_1.WsClient();
    // Status bar item
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'sakaiHub.reconnect';
    updateStatus(false);
    statusBar.show();
    context.subscriptions.push(statusBar);
    client.onStatusChange((connected) => {
        updateStatus(connected);
        // On (re)connect, immediately push the current active file
        if (connected)
            sendActiveFile(vscode.window.activeTextEditor);
    });
    client.connect();
    // Active editor changed → send active-file
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        sendActiveFile(editor);
    }));
    // File saved → send file-saved
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.scheme !== 'file')
            return;
        client.send({ type: 'file-saved', path: doc.uri.fsPath });
    }));
    // Manual reconnect command
    context.subscriptions.push(vscode.commands.registerCommand('sakaiHub.reconnect', () => {
        client.connect();
        vscode.window.showInformationMessage('SaKAi Hub: reconnecting…');
    }));
    // Send the current file on activation
    sendActiveFile(vscode.window.activeTextEditor);
    context.subscriptions.push({ dispose: () => client.dispose() });
}
function deactivate() {
    client?.dispose();
}
function sendActiveFile(editor) {
    if (!editor || editor.document.uri.scheme !== 'file')
        return;
    client.send({ type: 'active-file', path: editor.document.uri.fsPath });
}
function updateStatus(connected) {
    if (!statusBar)
        return;
    if (connected) {
        statusBar.text = '$(check) SaKAi Hub: Connected';
        statusBar.tooltip = 'Connected to SaKAi Hub desktop app';
        statusBar.backgroundColor = undefined;
    }
    else {
        statusBar.text = '$(debug-disconnect) SaKAi Hub: Disconnected';
        statusBar.tooltip = 'SaKAi Hub desktop app not reachable — click to retry';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}
//# sourceMappingURL=extension.js.map
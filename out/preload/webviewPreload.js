"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("__sakai", {
  saveKnowledge: (text) => {
    electron.ipcRenderer.send("webview:save-knowledge", text);
  }
});

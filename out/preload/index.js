"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Projects
  projects: {
    list: () => electron.ipcRenderer.invoke("projects:list"),
    create: (input) => electron.ipcRenderer.invoke("projects:create", input),
    open: (id) => electron.ipcRenderer.invoke("projects:open", id),
    rename: (id, name) => electron.ipcRenderer.invoke("projects:rename", id, name),
    delete: (id) => electron.ipcRenderer.invoke("projects:delete", id),
    updateFolderPath: (id, folderPath) => electron.ipcRenderer.invoke("projects:updateFolderPath", id, folderPath)
  },
  // Files
  files: {
    list: (projectId) => electron.ipcRenderer.invoke("files:list", projectId),
    getImportGraph: (projectId) => electron.ipcRenderer.invoke("files:getImportGraph", projectId),
    onChanged: (callback) => {
      const handler = () => callback();
      electron.ipcRenderer.on("files:changed", handler);
      return () => electron.ipcRenderer.removeListener("files:changed", handler);
    }
  },
  // AI Accounts
  accounts: {
    list: () => electron.ipcRenderer.invoke("accounts:list"),
    add: (input) => electron.ipcRenderer.invoke("accounts:add", input),
    setActive: (id) => electron.ipcRenderer.invoke("accounts:setActive", id),
    remove: (id) => electron.ipcRenderer.invoke("accounts:remove", id)
  },
  // Chats
  chats: {
    list: (projectId) => electron.ipcRenderer.invoke("chats:list", projectId),
    create: (input) => electron.ipcRenderer.invoke("chats:create", input)
  },
  // Knowledge Cards
  knowledge: {
    list: (projectId) => electron.ipcRenderer.invoke("knowledge:list", projectId),
    create: (input) => electron.ipcRenderer.invoke("knowledge:create", input),
    delete: (id) => electron.ipcRenderer.invoke("knowledge:delete", id),
    search: (projectId, query) => electron.ipcRenderer.invoke("knowledge:search", projectId, query)
  },
  // Context Builder
  context: {
    assemble: (input) => electron.ipcRenderer.invoke("context:assemble", input),
    estimateTokens: (text) => electron.ipcRenderer.invoke("context:estimateTokens", text)
  },
  // Webview injection
  webview: {
    show: (accountId, model, bounds) => electron.ipcRenderer.invoke("webview:show", accountId, model, bounds),
    hide: (accountId) => electron.ipcRenderer.invoke("webview:hide", accountId),
    hideAll: () => electron.ipcRenderer.invoke("webview:hideAll"),
    setBounds: (bounds) => electron.ipcRenderer.invoke("webview:setBounds", bounds),
    injectContext: (accountId, contextBlock) => electron.ipcRenderer.invoke("webview:injectContext", accountId, contextBlock),
    login: (accountId, model) => electron.ipcRenderer.invoke("webview:login", accountId, model),
    saveKnowledge: (payload) => electron.ipcRenderer.invoke("webview:saveKnowledge", payload),
    onKnowledgeSaved: (callback) => {
      const handler = (_, card) => callback(card);
      electron.ipcRenderer.on("knowledge:saved", handler);
      return () => electron.ipcRenderer.removeListener("knowledge:saved", handler);
    }
  },
  // Settings
  settings: {
    getApp: () => electron.ipcRenderer.invoke("settings:getApp"),
    setApp: (key, value) => electron.ipcRenderer.invoke("settings:setApp", key, value),
    getProject: (projectId) => electron.ipcRenderer.invoke("settings:getProject", projectId),
    setProject: (projectId, input) => electron.ipcRenderer.invoke("settings:setProject", projectId, input)
  },
  // WebSocket status
  ws: {
    onStatus: (callback) => {
      const handler = (_, status) => callback(status);
      electron.ipcRenderer.on("ws:status", handler);
      return () => electron.ipcRenderer.removeListener("ws:status", handler);
    }
  }
});

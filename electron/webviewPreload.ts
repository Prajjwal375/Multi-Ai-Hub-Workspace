import { contextBridge, ipcRenderer } from 'electron'

// Exposed to the AI provider page so the injected overlay can save responses.
contextBridge.exposeInMainWorld('__sakai', {
  saveKnowledge: (text: string) => {
    ipcRenderer.send('webview:save-knowledge', text)
  },
})

/**
 * loginPreload.ts
 *
 * Preload script used ONLY by the login BrowserWindow (openLogin).
 * It runs in the renderer context before any page script and injects
 * the browser APIs that Google's OAuth page checks to decide whether
 * the client is a "real" Chrome browser.
 *
 * Google blocks OAuth when:
 *  1. window.chrome is undefined  → real Chrome always has it
 *  2. navigator.webdriver is true  → automation flag Electron sets by default
 *
 * This file must NOT import any Electron APIs (contextBridge, ipcRenderer, etc.)
 * because the login window does not expose any IPC — it is a plain browser window.
 * Importing Electron modules here would also break the build for this entry point.
 */

// ── 1. Inject window.chrome ───────────────────────────────────────────────────
// Real Chrome always exposes window.chrome with at minimum a `runtime` object.
// Google's login page calls window.chrome.runtime and bails out if it is absent.
;(window as any).chrome = {
  runtime: {
    // Minimal stub — enough to pass Google's presence check
    id: undefined,
    connect: () => undefined,
    sendMessage: () => undefined,
  },
  loadTimes: () => ({}),
  csi: () => ({}),
  app: {},
}

// ── 2. Hide the webdriver flag ────────────────────────────────────────────────
// Electron sets navigator.webdriver = true, which signals automation to Google.
// We override the property descriptor to return false instead.
Object.defineProperty(navigator, 'webdriver', {
  get: () => false,
  configurable: true,
})

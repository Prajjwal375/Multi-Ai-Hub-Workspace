import { WebContentsView, BrowserWindow, session, clipboard } from 'electron'
import { join } from 'path'
import { mainWindow } from './main'
import { getAdapter, ADAPTERS } from './adapters'
import type { ProviderModel } from './adapters'

// A current Chrome UA so Google OAuth ("this browser may not be secure") works
// inside our embedded sessions. Without this, Google blocks sign-in.
// IMPORTANT: version must match the Chromium bundled with the Electron version
// in use (Electron 33 → Chromium 130). A mismatched version looks fake to Google.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function configureSession(partition: string): Electron.Session {
  const ses = session.fromPartition(partition)
  // Spoof a real Chrome UA on every request from this partition
  ses.setUserAgent(CHROME_UA)
  return ses
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface InjectionResult {
  success: boolean
  method: 'executeJavaScript' | 'clipboard'
  error?: string
}

interface ViewEntry {
  view: WebContentsView
  model: ProviderModel
  partition: string
}

class WebviewManager {
  private views = new Map<string, ViewEntry>() // accountId → view
  private visibleAccountId: string | null = null

  /** Create (if needed) and show the webview for an account at given bounds. */
  show(accountId: string, model: ProviderModel, bounds: Bounds): void {
    if (!mainWindow) return

    // Already visible — just reposition
    if (this.visibleAccountId === accountId && this.views.has(accountId)) {
      this.views.get(accountId)!.view.setBounds(bounds)
      return
    }

    // Hide any other visible view first
    if (this.visibleAccountId && this.visibleAccountId !== accountId) {
      this.detach(this.visibleAccountId)
    }

    let entry = this.views.get(accountId)
    if (!entry) {
      const adapter = getAdapter(model)
      if (!adapter) return

      const partition = `persist:${model}-${accountId}`
      const ses = configureSession(partition)

      const view = new WebContentsView({
        webPreferences: {
          session: ses,
          preload: join(__dirname, '../preload/webviewPreload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      })

      view.webContents.loadURL(adapter.url)

      // Open external links (target=_blank) in the user's real browser
      view.webContents.setWindowOpenHandler(() => {
        return { action: 'allow' }
      })

      // Inject the "Save to Knowledge" overlay after each navigation/load
      const overlay = buildOverlayScript(adapter.messageSelector)
      view.webContents.on('did-finish-load', () => {
        view.webContents.executeJavaScript(overlay).catch(() => {
          /* overlay injection is best-effort */
        })
      })

      entry = { view, model, partition }
      this.views.set(accountId, entry)
    }

    mainWindow.contentView.addChildView(entry.view)
    entry.view.setBounds(bounds)
    this.visibleAccountId = accountId
  }

  /** Remove the view from the window (keeps it alive in memory for fast switching). */
  hide(accountId: string): void {
    this.detach(accountId)
  }

  /** Hide whatever is currently visible (used when leaving the Chat screen). */
  hideAll(): void {
    if (this.visibleAccountId) this.detach(this.visibleAccountId)
  }

  private detach(accountId: string): void {
    const entry = this.views.get(accountId)
    if (entry && mainWindow) {
      try {
        mainWindow.contentView.removeChildView(entry.view)
      } catch {
        // already detached
      }
    }
    if (this.visibleAccountId === accountId) this.visibleAccountId = null
  }

  /** Resize the currently visible view (on layout/window changes). */
  setBounds(bounds: Bounds): void {
    if (this.visibleAccountId) {
      this.views.get(this.visibleAccountId)?.view.setBounds(bounds)
    }
  }

  /** Inject an assembled context block into the provider's input field. */
  async injectContext(accountId: string, contextBlock: string): Promise<InjectionResult> {
    const entry = this.views.get(accountId)
    if (!entry) {
      // No live webview — fall back to clipboard
      clipboard.writeText(contextBlock)
      return { success: false, method: 'clipboard', error: 'No active webview' }
    }

    const adapter = getAdapter(entry.model)
    if (!adapter) {
      clipboard.writeText(contextBlock)
      return { success: false, method: 'clipboard', error: 'No adapter' }
    }

    try {
      const result = await entry.view.webContents.executeJavaScript(
        adapter.injectScript(contextBlock)
      )
      if (result && result.ok) {
        return { success: true, method: 'executeJavaScript' }
      }
      // Injection failed (selector not found) — fall back to clipboard
      clipboard.writeText(contextBlock)
      return { success: false, method: 'clipboard', error: result?.reason ?? 'injection-failed' }
    } catch (err: any) {
      clipboard.writeText(contextBlock)
      return { success: false, method: 'clipboard', error: String(err?.message ?? err) }
    }
  }

  /** Destroy a webview and free its memory (on account removal). */
  destroy(accountId: string): void {
    this.detach(accountId)
    const entry = this.views.get(accountId)
    if (entry) {
      try {
        ;(entry.view.webContents as any).close?.()
      } catch {
        // ignore
      }
      this.views.delete(accountId)
    }
  }

  /** Wipe a session partition's cookies/storage from disk (on account removal). */
  async destroyPartition(partition: string): Promise<void> {
    try {
      const ses = session.fromPartition(partition)
      await ses.clearStorageData()
    } catch {
      // ignore
    }
  }

  /** Tear everything down (app quit). */
  destroyAll(): void {
    for (const accountId of this.views.keys()) {
      this.destroy(accountId)
    }
  }

  /** Find which account owns a given webContents (for save-knowledge routing). */
  findByWebContents(wc: Electron.WebContents): { accountId: string; model: ProviderModel } | null {
    for (const [accountId, entry] of this.views.entries()) {
      if (entry.view.webContents === wc) {
        return { accountId, model: entry.model }
      }
    }
    return null
  }

  getVisibleAccountId(): string | null {
    return this.visibleAccountId
  }

  /**
   * Open a dedicated login window for an account in its isolated session.
   * The user signs in with their Google/Gmail account; cookies persist in the
   * partition so the embedded chat webview is logged in afterwards.
   *
   * Google OAuth blocks sign-in when it detects the "Electron/" token in the
   * User-Agent string. We work around this by:
   *  1. Setting the UA on the session (covers XHR/fetch requests).
   *  2. Overriding the UA on the webContents directly after creation so the
   *     initial navigation also uses the spoofed Chrome UA.
   *  3. Ensuring any popup windows Google spawns during OAuth inherit the same UA.
   */
  openLogin(accountId: string, model: ProviderModel): void {
    const adapter = getAdapter(model)
    if (!adapter) return

    const partition = `persist:${model}-${accountId}`
    const ses = configureSession(partition)

    const win = new BrowserWindow({
      width: 480,
      height: 720,
      title: `Sign in to ${ADAPTERS[model].model}`,
      // Do NOT set parent — child/modal windows are a signal Google uses to
      // detect embedded browsers and block OAuth ("Couldn't sign you in").
      // A standalone window looks like a regular Chrome launch to Google.
      autoHideMenuBar: true,
      webPreferences: {
        session: ses,           // pins the persistent partition (cookies/storage)
        contextIsolation: false, // must be false so loginPreload can write to window directly
        nodeIntegration: false,
        preload: join(__dirname, '../preload/loginPreload.js'),
      },
    })

    // Override UA at the webContents level so the very first navigation
    // (including the Google sign-in redirect) uses our Chrome UA, not "Electron/…"
    win.webContents.setUserAgent(CHROME_UA)

    // Google OAuth often opens a popup window — keep it in the same session
    // and ensure the popup also uses the spoofed UA.
    win.webContents.setWindowOpenHandler(({ url }) => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            session: ses,
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      }
    })

    // Also spoof UA for any popup window that gets created
    win.webContents.on('did-create-window', (popup) => {
      popup.webContents.setUserAgent(CHROME_UA)
    })

    win.loadURL(adapter.url)

    // Tell the renderer when login finishes so it can refresh state
    win.on('closed', () => {
      mainWindow?.webContents.send('accounts:loginClosed', accountId)
    })
  }
}

/**
 * Builds a script that adds a floating "⭐ Save to Knowledge" button to each
 * AI response message. Clicking it sends the message text to the main process
 * via the contextBridge-exposed window.__sakai.saveKnowledge().
 */
function buildOverlayScript(messageSelector: string): string {
  return `
(function () {
  if (window.__sakaiOverlayInstalled) return;
  window.__sakaiOverlayInstalled = true;

  const SELECTOR = ${JSON.stringify(messageSelector)};

  function addButton(msg) {
    if (msg.dataset.sakaiOverlay) return;
    msg.dataset.sakaiOverlay = '1';
    if (getComputedStyle(msg).position === 'static') {
      msg.style.position = 'relative';
    }
    const btn = document.createElement('button');
    btn.textContent = '⭐ Save to Knowledge';
    btn.style.cssText = [
      'position:absolute','top:6px','right:6px','z-index:99999',
      'font-size:11px','font-weight:600','padding:4px 8px','border-radius:8px',
      'border:1px solid rgba(0,0,0,0.1)','background:rgba(59,130,246,0.95)',
      'color:#fff','cursor:pointer','opacity:0','transition:opacity .15s',
      'box-shadow:0 2px 6px rgba(0,0,0,0.15)'
    ].join(';');
    msg.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    msg.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const text = (msg.innerText || msg.textContent || '').trim();
      if (text && window.__sakai && window.__sakai.saveKnowledge) {
        window.__sakai.saveKnowledge(text);
        btn.textContent = '✓ Saved';
        setTimeout(() => { btn.textContent = '⭐ Save to Knowledge'; }, 1500);
      }
    });
    msg.appendChild(btn);
  }

  function scan() {
    try {
      document.querySelectorAll(SELECTOR).forEach(addButton);
    } catch (e) {}
  }

  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
})();
`
}

export const webviewManager = new WebviewManager()

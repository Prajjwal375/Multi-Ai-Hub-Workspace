export type ProviderModel = 'claude' | 'chatgpt' | 'gemini' | 'grok'

export interface ProviderAdapter {
  model: ProviderModel
  url: string
  /** CSS selectors for the chat input — tried in order until one is found. */
  inputSelectors: string[]
  /** CSS selector matching each AI response message (for the Save overlay). */
  messageSelector: string
  /** Returns JS (string) that injects the context block into the input. */
  injectScript(contextBlock: string): string
}

/**
 * Safely serialise a JS string literal for executeJavaScript injection.
 * Prevents breakage from backticks, backslashes, ${} and newlines.
 */
export function jsString(value: string): string {
  return JSON.stringify(value)
}

/**
 * Shared injection routine. Finds the first matching input element,
 * sets its value (textarea OR contenteditable), and fires the events
 * the framework listens for so the send button enables.
 */
function buildInjectScript(selectors: string[], contextBlock: string): string {
  return `
(function () {
  try {
    const text = ${jsString(contextBlock)};
    const selectors = ${JSON.stringify(selectors)};
    let el = null;
    for (const sel of selectors) {
      el = document.querySelector(sel);
      if (el) break;
    }
    if (!el) return { ok: false, reason: 'input-not-found' };

    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      const existing = el.value ? el.value + '\\n\\n' : '';
      setter.call(el, existing + text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable) {
      // ProseMirror / Lexical contenteditable inputs
      el.focus();
      const lines = text.split('\\n');
      // Use execCommand for broad compatibility, falling back to textContent
      const ok = document.execCommand('insertText', false, text);
      if (!ok) {
        el.textContent = (el.textContent ? el.textContent + '\\n\\n' : '') + text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      return { ok: false, reason: 'unsupported-input' };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
})();
`
}

const claude: ProviderAdapter = {
  model: 'claude',
  url: 'https://claude.ai',
  inputSelectors: [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    'textarea',
  ],
  messageSelector: '[data-testid="message"], .font-claude-message',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock)
  },
}

const chatgpt: ProviderAdapter = {
  model: 'chatgpt',
  url: 'https://chatgpt.com',
  inputSelectors: [
    '#prompt-textarea',
    'div[contenteditable="true"]#prompt-textarea',
    'div[contenteditable="true"]',
    'textarea',
  ],
  messageSelector: '[data-message-author-role="assistant"]',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock)
  },
}

const gemini: ProviderAdapter = {
  model: 'gemini',
  url: 'https://gemini.google.com',
  inputSelectors: [
    'div.ql-editor[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
  messageSelector: 'message-content, .model-response-text',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock)
  },
}

const grok: ProviderAdapter = {
  model: 'grok',
  url: 'https://grok.com',
  inputSelectors: [
    'textarea',
    'div[contenteditable="true"]',
  ],
  messageSelector: '.message-bubble, [data-testid="message"]',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock)
  },
}

export const ADAPTERS: Record<ProviderModel, ProviderAdapter> = {
  claude,
  chatgpt,
  gemini,
  grok,
}

export function getAdapter(model: string): ProviderAdapter | null {
  return ADAPTERS[model as ProviderModel] ?? null
}

// Runtime configuration for web-only (static) deployments.
// Users paste their own OpenAI API key; it is stored only in this browser (localStorage).
// On Vercel/Netlify, serverless functions read the key from project env vars instead.

const KEY_STORAGE = 'gameforge_openai_api_key';

export function getLocalApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setLocalApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(KEY_STORAGE);
    }
  } catch {
    // Storage unavailable (private mode) — key simply won't persist.
  }
}

// Browser keys are opt-in. Deployed owner keys belong in server hosting secrets.
export function getEffectiveClientKey(): string { return getLocalApiKey(); }

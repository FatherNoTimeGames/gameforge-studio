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

// Effective key to use for client-side direct calls: local key first,
// then a build-time VITE_OPENAI_API_KEY (only recommended for personal/private deploys).
export function getEffectiveClientKey(): string {
  const local = getLocalApiKey();
  if (local) return local;
  return (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() || '';
}

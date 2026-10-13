// Unified OpenAI call layer.
// 1. If a server proxy is available (Express dev/prod server, or Vercel/Netlify
//    serverless function at /api/openai/chat), we use it — the API key stays secret.
// 2. Otherwise (pure static hosting like GitHub Pages) we fall back to calling
//    the OpenAI Chat Completions REST API directly from the browser using the
//    user's own key.

import { getEffectiveClientKey } from './config';
import { DEFAULT_MODEL, FALLBACK_MODELS } from '../../shared/constants';
import { htmlToPlainText } from '../../shared/htmlText';

export { DEFAULT_MODEL };

export interface AiGenerateRequest {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface AiGenerateResult {
  text: string;
  modelUsed?: string;
}

let proxyMode: 'unknown' | 'available' | 'unavailable' = 'unknown';

async function checkProxy(): Promise<boolean> {
  if (proxyMode === 'available') return true;
  if (proxyMode === 'unavailable') return false;
  const ok = await fetch('/api/status')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: any) => Boolean(data && typeof data.status === 'string'))
    .catch(() => false);
  proxyMode = ok ? 'available' : 'unavailable';
  return ok;
}

interface ChatMessagePayload {
  role: 'system' | 'user';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

function buildMessages(req: AiGenerateRequest): ChatMessagePayload[] {
  const messages: ChatMessagePayload[] = [];
  if (req.systemInstruction) {
    messages.push({ role: 'system', content: req.systemInstruction });
  }
  if (req.imageBase64) {
    const mime = req.imageMimeType || 'image/png';
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${req.imageBase64}` }
        },
        {
          type: 'text',
          text: req.prompt || 'Analyze this game engine screenshot or error.'
        }
      ]
    });
  } else {
    messages.push({ role: 'user', content: req.prompt });
  }
  return messages;
}

async function generateDirect(req: AiGenerateRequest): Promise<AiGenerateResult> {
  const apiKey = getEffectiveClientKey().trim();
  if (!apiKey) {
    throw new Error(
      'No OpenAI API key configured. Open the API Key settings and paste your key from https://platform.openai.com/api-keys'
    );
  }

  const candidateModels = [req.model || DEFAULT_MODEL, ...FALLBACK_MODELS].filter(
    (m, idx, self) => self.indexOf(m) === idx
  );

  const messages = buildMessages(req);
  let lastMessage = 'Failed to generate response from OpenAI.';

  for (const targetModel of candidateModels) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model: targetModel, messages })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message: string =
          errBody?.error?.message || `OpenAI request failed with status ${res.status}.`;
        // Auth / billing / rate-limit errors won't be fixed by trying another model.
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          throw new Error(message);
        }
        throw new Error(message);
      }

      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content || '';
      return { text, modelUsed: targetModel };
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : lastMessage;
      console.warn(`Direct model ${targetModel} failed, trying fallback...`, err);
    }
  }
  throw new Error(lastMessage);
}

export async function aiGenerate(req: AiGenerateRequest): Promise<AiGenerateResult> {
  const hasProxy = await checkProxy();

  if (hasProxy) {
    const res = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }
    const data = await res.json();
    return { text: data.text || '', modelUsed: data.modelUsed };
  }

  return generateDirect(req);
}

// URL content fetcher for Wiki Builder sources.
// Uses the server proxy when present; otherwise falls back to a public CORS reader.
export async function fetchRemoteText(url: string): Promise<string> {
  const hasProxy = await checkProxy();

  if (hasProxy) {
    const res = await fetch('/api/proxy-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Fetch failed with status ${res.status}`);
    }
    const data = await res.json();
    return data.text || '';
  }

  // Static-hosting fallback: allorigins proxy (CORS-enabled public reader)
  const readerUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const res = await fetch(readerUrl);
  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status}. The site may block external readers.`);
  }
  return htmlToPlainText(await res.text());
}

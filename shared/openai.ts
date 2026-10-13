// Shared OpenAI chat-completion logic for the Express server and serverless functions.
// Uses plain fetch against the OpenAI REST API (Node 18+ built-in), so no SDK is needed
// on the hosting edge.

import { DEFAULT_MODEL, FALLBACK_MODELS } from './constants';

export { DEFAULT_MODEL, FALLBACK_MODELS };

export interface ChatPartText {
  type: 'text';
  text: string;
}
export interface ChatPartImage {
  type: 'image_url';
  image_url: { url: string };
}
export type ChatContent = string | Array<ChatPartText | ChatPartImage>;
export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export interface GenerateArgs {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  apiKey: string;
  imageBase64?: string;
  imageMimeType?: string;
  baseUrl?: string; // e.g. https://api.openai.com/v1 (default) — overridable for Azure/OpenRouter/etc.
}

export interface GenerateOutcome {
  ok: boolean;
  text?: string;
  modelUsed?: string;
  error?: string;
  fatal?: boolean; // auth/billing/rate-limit: don't try other models
}

function buildMessages(args: GenerateArgs): ChatMessagePayload[] {
  const messages: ChatMessagePayload[] = [];
  if (args.systemInstruction) {
    messages.push({ role: 'system', content: args.systemInstruction });
  }
  if (args.imageBase64) {
    const mime = args.imageMimeType || 'image/png';
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${args.imageBase64}` } },
        { type: 'text', text: args.prompt || 'Analyze this game engine screenshot or error.' }
      ]
    });
  } else {
    messages.push({ role: 'user', content: args.prompt });
  }
  return messages;
}

async function callOnce(args: GenerateArgs, targetModel: string): Promise<GenerateOutcome> {
  const base = (args.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.apiKey}`
      },
      body: JSON.stringify({ model: targetModel, messages: buildMessages(args) }),
      signal: AbortSignal.timeout(90000)
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error calling OpenAI.' };
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({} as any));
    const message = errBody?.error?.message || `OpenAI responded with status ${res.status}.`;
    // Auth / billing / rate-limit errors will not be fixed by trying another model.
    const fatal = res.status === 401 || res.status === 403 || res.status === 429;
    if (fatal) return { ok: false, error: message, fatal };
    return { ok: false, error: message };
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  return { ok: true, text, modelUsed: targetModel };
}

// Try requested model first, then fallbacks. Returns the first success.
export async function openAiGenerateWithFallback(args: GenerateArgs): Promise<GenerateOutcome> {
  const candidates = [args.model || DEFAULT_MODEL, ...FALLBACK_MODELS].filter(
    (m, idx, self) => self.indexOf(m) === idx
  );

  let lastError: GenerateOutcome = { ok: false, error: 'Failed to generate response from OpenAI.' };
  for (const targetModel of candidates) {
    const outcome = await callOnce(args, targetModel);
    if (outcome.ok) return outcome;
    lastError = outcome;
    console.warn(`Model ${targetModel} failed: ${outcome.error}. Retrying fallback if available...`);
    if (outcome.fatal) break;
  }
  return lastError;
}

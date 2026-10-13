import { getEffectiveClientKey } from './config.ts';
import { generateResponse } from '../../shared/openai.ts';
import { accountFetch } from './workspaceSession.ts';
import { htmlToPlainText } from '../../shared/htmlText.ts';
import { generateWithChatGpt } from './chatgptBridge.ts';

export interface AiGenerateRequest {
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
  imageMimeType?: string;
  outputKind?: 'wiki_build' | 'verification' | 'index';
  clientContext?: { projectId: string; thread: 'concept' | 'teacher'; actionType: string };
}
export interface AiGenerateResult { text: string; modelUsed?: string; requestId?: string; }

let proxyCheck: Promise<boolean> | null = null;
let chatgptMode = false;
let subscriptionMode = false;
export function setChatGptMode(enabled: boolean) { subscriptionMode = enabled; }
async function checkProxy(): Promise<boolean> {
  if (proxyCheck) return proxyCheck;
  proxyCheck = (async () => {
    const response = await accountFetch('/api/status', { signal: AbortSignal.timeout(15_000) });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error('The workspace server is unavailable. Sign in or retry when it is back online.');
    if (!response.headers.get('content-type')?.includes('application/json')) return false;
    const data = await response.json();
    chatgptMode = data?.aiMode === 'chatgpt';
    return data?.status === 'ok';
  })();
  try { return await proxyCheck; } catch (error) { proxyCheck = null; throw error; }
}

export async function aiGenerate(request: AiGenerateRequest): Promise<AiGenerateResult> {
  // The Sites interface must never fall back to a stored browser API key,
  // including when its status endpoint is unavailable or misconfigured.
  if (subscriptionMode) return generateWithChatGpt(request);
  if (await checkProxy()) {
    if (chatgptMode) return generateWithChatGpt(request);
    const response = await accountFetch('/api/openai/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.timeout(250_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AI request failed with status ${response.status}.`);
    if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('AI returned no text. Try again.');
    return data;
  }
  const key = getEffectiveClientKey();
  if (!key) throw new Error('Open API Key settings for browser-only mode, or configure OPENAI_API_KEY on your app server.');
  // A browser-only deployment uses the owner's explicitly supplied key and the same model settings.
  return generateResponse(request, key, AbortSignal.timeout(240_000));
}

export async function fetchRemoteText(url: string): Promise<string> {
  const hasProxy = subscriptionMode || await checkProxy();
  const response = hasProxy
    ? await accountFetch('/api/proxy-fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(20_000) })
    : await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Source import failed with status ${response.status}.`);
  }
  return hasProxy ? (await response.json()).text || '' : htmlToPlainText(await response.text());
}

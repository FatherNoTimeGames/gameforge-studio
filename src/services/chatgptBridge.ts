import type { AiGenerateRequest, AiGenerateResult } from './ai';
import { accountFetch } from './workspaceSession.ts';

export interface ChatGptJob { id: string; state: 'pending' | 'completed' | 'consumed'; created_at: number; }
export const REQUEST_EVENT = 'gameforge-chatgpt-request';
const stopped = new Set<string>();
export const stopWaiting = (id: string) => { stopped.add(id); };
export function requestInstruction(id: string) {
  return `Use my GameForge plugin to read request ${id}, complete the task using this conversation's selected model, and save the full answer with complete_request. If it requires JSON, save plain JSON without markdown fences.`;
}
export async function requestApi(path: string, init?: RequestInit) {
  const response = await accountFetch(`/api/requests${path}`, { ...init, signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not access saved ChatGPT tasks.');
  return data;
}
export async function generateWithChatGpt(request: AiGenerateRequest): Promise<AiGenerateResult> {
  const job = await requestApi('', { method: 'POST', body: JSON.stringify(request) });
  stopped.delete(job.id);
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: job.id }));
  const deadline = Date.now() + 45 * 60_000;
  while (Date.now() < deadline) {
    if (stopped.has(job.id)) throw new Error('Stopped waiting. Your task is saved in ChatGPT tasks; retry the same action to resume.');
    const result = await requestApi(`/${job.id}`);
    if (result.state === 'completed' && typeof result.text === 'string' && result.text.trim()) {
      // Retain the reply after consumption so it can be copied or recovered.
      const claim = await requestApi(`/${job.id}/consume`, { method: 'POST', body: '{}' });
      if (claim.claimed === false) throw new Error('This reply was taken on another device. View or recover it in ChatGPT tasks.');
      window.dispatchEvent(new CustomEvent(REQUEST_EVENT));
      return { text: result.text, modelUsed: result.modelUsed, requestId: job.id };
    }
    if (result.state === 'consumed') throw new Error('This reply was taken on another device. View or recover it in ChatGPT tasks.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Your task is still saved. Complete it in ChatGPT, then retry the same action in GameForge.');
}

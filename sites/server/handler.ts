import { HttpError, type StorageEnv } from './contracts.ts';
import { loadWorkspace, saveWorkspace, listRequests, getRequest, createRequest, requestResult, consumeRequest, recoverRequest, deleteRequest } from './store.ts';
import { handleMcp } from './mcp.ts';
import { htmlToPlainText } from '../../shared/htmlText.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
async function readJson(request: Request, limit: number) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body.');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'This upload is too large. Export a backup and split it into smaller projects or sources.'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid JSON body.');
  } finally { reader.releaseLock(); }
}

// Workers cannot use the original Node DNS-pinned fetcher. Restrict this target
// to documented public source hosts; other sources still support paste/upload.
const sourceHosts = new Set(['github.com', 'raw.githubusercontent.com', 'gist.githubusercontent.com', 'api.github.com', 'docs.godotengine.org', 'docs.unity3d.com', 'en.wikipedia.org']);
async function fetchSource(raw: unknown): Promise<string> {
  if (typeof raw !== 'string') throw new HttpError(400, 'Provide a source URL.');
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, 'Invalid source URL.'); }
  const signal = AbortSignal.timeout(15_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !sourceHosts.has(url.hostname)) {
      throw new HttpError(400, 'Sites imports URLs from GitHub, Godot docs, Unity docs and English Wikipedia. Paste or upload other source text.');
    }
    const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/plain, text/html, application/json' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new HttpError(502, 'The source redirected without a destination.');
      url = new URL(location, url); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new HttpError(502, 'The source could not be downloaded.'); }
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/|application\/(json|xml)/i.test(type)) { await response.body?.cancel(); throw new HttpError(400, 'Import a text source.'); }
    const reader = response.body?.getReader();
    if (!reader) return '';
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2_000_000) { await reader.cancel(); throw new HttpError(413, 'Source exceeds the 2 MB limit.'); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      return htmlToPlainText(text + decoder.decode());
    } finally { reader.releaseLock(); }
  }
  throw new HttpError(502, 'Too many source redirects.');
}

export async function handleGameForge(request: Request, env: StorageEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/') && url.pathname !== '/mcp') return null;
  try {
    // Production Sites dispatch injects identity. Never accept an owner from JSON.
    const owner = request.headers.get('oai-authenticated-user-id');
    if (!owner) throw new HttpError(401, 'Sign in with ChatGPT to use your private GameForge workspace.');
    const expectedAccount = request.headers.get('x-gameforge-account');
    if (expectedAccount && expectedAccount !== owner) throw new HttpError(401, 'Your signed-in account changed. Reload GameForge before continuing.');
    if (!env.DB || !env.BUCKET) throw new HttpError(503, 'GameForge cloud storage is not configured.');
    if (url.pathname === '/mcp') {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
      const result = await handleMcp(await readJson(request, 2_000_000), env, owner);
      return result === null ? new Response(null, { status: 202 }) : json(result);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Open GameForge directly before changing your workspace.');
    }
    if (url.pathname === '/api/status' && request.method === 'GET') return json({ status: 'ok', aiMode: 'chatgpt', durableStorage: true });
    if (url.pathname === '/api/workspace') {
      if (request.method === 'GET') {
        const known = url.searchParams.has('revision') ? Number(url.searchParams.get('revision')) : undefined;
        const workspace = await loadWorkspace(env, owner, known);
        return json({ enabled: true, workspace, unchanged: workspace === undefined, syncMode: 'merge', browserStorageKey: owner });
      }
      if (request.method === 'PUT') return json(await saveWorkspace(env, owner, await readJson(request, 8_000_000)));
    }
    if (url.pathname === '/api/requests') {
      if (request.method === 'GET') return json({ requests: await listRequests(env, owner) });
      if (request.method === 'POST') return json(await createRequest(env, owner, await readJson(request, 16_000_000)));
    }
    const match = url.pathname.match(/^\/api\/requests\/([a-f0-9-]{36})(?:\/(consume|recover))?$/i);
    if (match) {
      if (request.method === 'GET' && !match[2]) return json(await requestResult(env, await getRequest(env, owner, match[1])));
      if (request.method === 'POST' && match[2] === 'consume') return json(await consumeRequest(env, owner, match[1]));
      if (request.method === 'POST' && match[2] === 'recover') return json(await recoverRequest(env, owner, match[1]));
      if (request.method === 'DELETE' && !match[2]) return json(await deleteRequest(env, owner, match[1]));
    }
    if (url.pathname === '/api/proxy-fetch' && request.method === 'POST') return json({ text: await fetchSource((await readJson(request, 8192)).url) });
    if (url.pathname === '/api/openai/chat' || url.pathname === '/api/ai/generate') throw new HttpError(409, 'Use the connected GameForge plugin in ChatGPT to complete this task. Sites does not use an OpenAI API key.');
    return json({ error: 'Route or method not found.' }, 404);
  } catch (error: any) {
    return json({ error: error.status ? error.message : 'GameForge could not complete this operation. Please retry.' }, error.status || 503);
  }
}

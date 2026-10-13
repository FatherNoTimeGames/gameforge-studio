import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleGameForge } from '../sites/server/handler.ts';
import { loadWorkspace, saveWorkspace, createRequest, getRequest, requestResult, completeRequest, consumeRequest, recoverRequest } from '../sites/server/store.ts';
import type { StorageEnv } from '../sites/server/contracts.ts';
import { generateWithChatGpt, REQUEST_EVENT } from '../src/services/chatgptBridge.ts';
import { aiGenerate, setChatGptMode } from '../src/services/ai.ts';

function storage() {
  const db = new DatabaseSync(':memory:');
  const migrations = new URL('../sites/drizzle/', import.meta.url);
  for (const name of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
  const blobs = new Map<string, string>();
  const env: StorageEnv = {
    DB: { prepare(sql) {
      let values: any[] = [];
      const statement = {
        bind(...input: any[]) { values = input; return statement; },
        async first() { return db.prepare(sql).get(...values) as any ?? null; },
        async all() { return { results: db.prepare(sql).all(...values) as any[] }; },
        async run() { return { meta: { changes: Number(db.prepare(sql).run(...values).changes) } }; },
      }; return statement;
    } },
    BUCKET: {
      async put(key, value) { blobs.set(key, value); },
      async get(key) { const value = blobs.get(key); return value === undefined ? null : { async text() { return value; } }; },
      async delete(key) { blobs.delete(key); },
    },
  };
  return { env, blobs, db };
}
const workspace = (revision = 0) => ({ projects: [{ id: 'project', name: 'My game', pages: [{ id: 'home', content: 'Keep this mechanic' }] }], activeProjectId: 'project', revision });
function request(path: string, owner?: string, method = 'GET', body?: unknown, origin = 'https://gameforge.example') {
  return new Request(`https://gameforge.example${path}`, { method, headers: {
    ...(owner ? { 'oai-authenticated-user-id': owner } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: origin } : {}),
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

test('Sites identity and origin checks protect private workspace and requests', async () => {
  const { env } = storage();
  for (const path of ['/api/workspace', '/api/requests', '/mcp']) {
    assert.equal((await handleGameForge(request(path), env))?.status, 401);
  }
  assert.equal((await handleGameForge(request('/api/workspace', 'alice', 'PUT', workspace(), 'https://attacker.example'), env))?.status, 403);
  assert.equal((await handleGameForge(request('/api/workspace', 'alice', 'PUT', workspace()), env))?.status, 200);
  const bob = await (await handleGameForge(request('/api/workspace', 'bob'), env))!.json();
  assert.equal(bob.workspace, null);
  assert.equal(bob.browserStorageKey, 'bob');
  assert.equal((await handleGameForge(request('/api/openai/chat', 'alice', 'POST', {}), env))?.status, 409);
});

test('competing device saves commit one revision and preserve the winning data', async () => {
  const { env, blobs } = storage();
  const saves = await Promise.allSettled([saveWorkspace(env, 'alice', workspace()), saveWorkspace(env, 'alice', workspace())]);
  assert.equal(saves.filter((r) => r.status === 'fulfilled').length, 1);
  const failed = saves.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(failed.reason.status, 409);
  assert.equal((await loadWorkspace(env, 'alice'))?.revision, 1);
  assert.equal(blobs.size, 1, 'failed concurrent save retires its uncommitted blob');
  await saveWorkspace(env, 'alice', workspace(1));
  assert.equal((await loadWorkspace(env, 'alice'))?.revision, 2);
  assert.equal(blobs.size, 1, 'ordinary autosaves do not accumulate workspace copies');
});

test('a request survives reload, isolates owners, and preserves completed replies for recovery', async () => {
  const { env } = storage();
  const input = { prompt: 'Index this page', outputKind: 'index' };
  const first = await createRequest(env, 'alice', input);
  assert.equal((await createRequest(env, 'alice', input)).id, first.id);
  await assert.rejects(getRequest(env, 'bob', first.id), (e: any) => e.status === 404);
  await assert.rejects(completeRequest(env, 'alice', first.id, '```json\n{}\n```'), (e: any) => e.status === 400);
  await assert.rejects(completeRequest(env, 'alice', first.id, '{}'), (e: any) => e.status === 400);
  const answer = JSON.stringify({ summary: 'Movement rules', keywords: ['dodge'] });
  await completeRequest(env, 'alice', first.id, answer);
  await completeRequest(env, 'alice', first.id, answer); // Retry is idempotent.
  await assert.rejects(completeRequest(env, 'alice', first.id, 'Different answer'), (e: any) => e.status === 409);
  assert.equal((await requestResult(env, await getRequest(env, 'alice', first.id))).text, answer);
  await consumeRequest(env, 'alice', first.id);
  await recoverRequest(env, 'alice', first.id);
  assert.equal((await createRequest(env, 'alice', input)).id, first.id);
});

test('MCP reads a saved task and writes a validated reply without calling an inference API', async () => {
  const { env } = storage();
  const job = await createRequest(env, 'alice', { prompt: 'Review the dodge mechanic', systemInstruction: 'Give a concise game design answer.' });
  const rpc = async (owner: string, method: string, params?: unknown) => {
    const response = await handleGameForge(request('/mcp', owner, 'POST', { jsonrpc: '2.0', id: 1, method, params }), env);
    return response!.json();
  };
  assert.ok((await rpc('alice', 'server/discover')).result.supportedVersions.includes('2026-07-28'));
  assert.equal((await rpc('alice', 'tools/list')).result.tools.length, 3);
  const read = await rpc('alice', 'tools/call', { name: 'read_request', arguments: { request_id: job.id } });
  assert.equal(JSON.parse(read.result.content[0].text).task.prompt, 'Review the dodge mechanic');
  const denied = await rpc('bob', 'tools/call', { name: 'read_request', arguments: { request_id: job.id } });
  assert.equal(denied.result.isError, true);
  const saved = await rpc('alice', 'tools/call', { name: 'complete_request', arguments: { request_id: job.id, text: 'Consider a longer recovery window.' } });
  assert.equal(JSON.parse(saved.result.content[0].text).state, 'completed');
  assert.equal((await getRequest(env, 'alice', job.id)).state, 'completed');
});

test('the browser handoff receives a native ChatGPT answer and retains its original chat destination', async () => {
  const { env } = storage();
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const events = new EventTarget();
  (globalThis as any).window = events;
  let taskId = '';
  const context = { projectId: 'project', thread: 'concept', actionType: 'discuss' };
  events.addEventListener(REQUEST_EVENT, (event) => {
    const id = (event as CustomEvent).detail;
    if (id) { taskId = id; void completeRequest(env, 'alice', id, 'A complete game-design reply.'); }
  });
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /^\/api\/requests/, 'the handoff uses app storage, never an external inference API');
    const response = await handleGameForge(request(String(input), 'alice', init?.method ?? 'GET', init?.body ? JSON.parse(String(init.body)) : undefined), env);
    assert.ok(response); return response;
  };
  try {
    const answer = await generateWithChatGpt({ prompt: 'Review my design', clientContext: context as any });
    assert.equal(answer.text, 'A complete game-design reply.');
    const stored = await requestResult(env, await getRequest(env, 'alice', taskId));
    assert.equal(stored.state, 'consumed');
    assert.deepEqual(stored.clientContext, context);
    assert.equal(stored.text, answer.text);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
});

test('Sites mode cannot fall back to paid inference when app endpoints fail', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = { getItem: () => 'previous-browser-api-key' };
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    assert.equal(String(input), '/api/requests');
    return Response.json({ error: 'Cloud tasks unavailable.' }, { status: 404 });
  };
  setChatGptMode(true);
  try {
    await assert.rejects(aiGenerate({ prompt: 'Review my game' }), /Cloud tasks unavailable/);
    assert.equal(calls, 1);
  } finally {
    setChatGptMode(false);
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = originalStorage;
  }
});

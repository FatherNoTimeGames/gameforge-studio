import { spawn, execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const wrangler = './node_modules/wrangler/bin/wrangler.js';
const config = ['--config', 'dist/server/wrangler.json', '--local', '--persist-to', '.wrangler/state'];
for (const migration of readdirSync('drizzle').filter((name) => name.endsWith('.sql')).sort()) {
  execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'DB', ...config, '--file', `drizzle/${migration}`], { stdio: 'pipe' });
}
const server = spawn(process.execPath, [wrangler, 'dev', ...config, '--ip', '127.0.0.1', '--port', '8787', '--inspector-port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', (chunk) => { logs = (logs + chunk).slice(-6000); });
const base = 'http://127.0.0.1:8787';
async function call(path, owner, method = 'GET', body) {
  return fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(10_000), headers: {
    ...(owner ? { 'oai-authenticated-user-id': owner, 'oai-authenticated-user-email': `${owner}@example.test` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: base } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
try {
  let started = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error(`Worker exited early: ${logs}`);
    try { if ((await call('/api/status')).status === 401) { started = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.ok(started, `Worker did not start: ${logs}`);
  const visitor = await call('/');
  assert.equal(visitor.status, 200);
  assert.match(await visitor.text(), /Sign in with ChatGPT/);
  const alice = `smoke-${crypto.randomUUID()}`;
  assert.equal((await call('/', alice)).status, 200);
  assert.equal((await (await call('/api/status', alice)).json()).aiMode, 'chatgpt');
  const input = { projects: [{ id: 'game', name: 'Smoke-test game', pages: [] }], activeProjectId: 'game', revision: 0 };
  assert.equal((await call('/api/workspace', alice, 'PUT', input)).status, 200);
  assert.equal((await call('/api/workspace', alice, 'PUT', input)).status, 200);
  assert.equal((await (await call('/api/workspace', alice)).json()).workspace.revision, 2);
  assert.equal((await (await call('/api/workspace?revision=2', alice)).json()).unchanged, true);
  assert.equal((await (await call('/api/workspace', 'other-owner')).json()).workspace, null);
  const jobResponse = await call('/api/requests', alice, 'POST', { prompt: 'Explain dodge recovery.' });
  assert.equal(jobResponse.status, 200);
  const job = await jobResponse.json();
  const rpc = (owner, name, args) => call('/mcp', owner, 'POST', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  assert.equal((await (await rpc('other-owner', 'read_request', { request_id: job.id })).json()).result.isError, true);
  const read = await (await rpc(alice, 'read_request', { request_id: job.id })).json();
  assert.equal(JSON.parse(read.result.content[0].text).task.prompt, 'Explain dodge recovery.');
  const completed = await (await rpc(alice, 'complete_request', { request_id: job.id, text: 'Leave a readable recovery window.' })).json();
  assert.equal(JSON.parse(completed.result.content[0].text).state, 'completed');
  assert.equal((await (await call(`/api/requests/${job.id}`, alice)).json()).text, 'Leave a readable recovery window.');
  console.log('Built Worker smoke check passed: page, identity, D1/R2 saves, multi-device overwrites and MCP task round trip.');
} finally {
  server.kill('SIGTERM');
  const timeout = setTimeout(() => server.kill('SIGKILL'), 5000);
  timeout.unref();
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  clearTimeout(timeout);
}

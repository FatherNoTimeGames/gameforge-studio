import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../../server.ts';

test('production protects app, AI and saved workspace; health is public; writes reject stale devices', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gameforge-server-'));
  const savedEnvironment = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.APP_USERNAME = 'owner';
  process.env.APP_PASSWORD = 'testing-password-at-least-16';
  process.env.DATA_DIR = directory;
  delete process.env.OPENAI_API_KEY;
  delete process.env.APP_URL;
  const app = await createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { Authorization: `Basic ${Buffer.from('owner:testing-password-at-least-16').toString('base64')}`, 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/api/status`)).status, 401);
    assert.equal((await fetch(`${base}/api/ai/generate`, { method: 'POST', body: '{}' })).status, 401);
    const status = await (await fetch(`${base}/api/status`, { headers })).json();
    assert.equal(status.defaultModel, 'gpt-6.1-sol');
    assert.equal(status.durableStorage, true);
    assert.equal(status.hasServerApiKey, false);
    const input = { projects: [{ id: 'p', name: 'Game', pages: [] }], activeProjectId: 'p', revision: 0 };
    const write = () => fetch(`${base}/api/workspace`, { method: 'PUT', headers, body: JSON.stringify(input) });
    assert.equal((await write()).status, 200);
    assert.equal((await write()).status, 409);
    assert.equal((await fetch(`${base}/api/workspace`, { method: 'PUT', headers: { ...headers, Origin: 'https://attacker.example' }, body: JSON.stringify(input) })).status, 403);
    assert.equal((await fetch(`${base}/api/proxy-fetch`, { method: 'POST', headers, body: JSON.stringify({ url: 'http://169.254.169.254' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/ai/generate`, { method: 'POST', headers, body: JSON.stringify({ prompt: 'x' }) })).status, 503);
    assert.equal((await fetch(`${base}/api/unknown`, { headers })).status, 404);
    const loaded = await (await fetch(`${base}/api/workspace`, { headers })).json();
    assert.equal(loaded.workspace.revision, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
    process.env = savedEnvironment;
  }
});

test('production refuses to start without access protection', async () => {
  const oldMode = process.env.NODE_ENV;
  const oldPassword = process.env.APP_PASSWORD;
  process.env.NODE_ENV = 'production';
  delete process.env.APP_PASSWORD;
  try { await assert.rejects(createApp(), /APP_PASSWORD/); }
  finally { if (oldMode) process.env.NODE_ENV = oldMode; else delete process.env.NODE_ENV; if (oldPassword) process.env.APP_PASSWORD = oldPassword; }
});

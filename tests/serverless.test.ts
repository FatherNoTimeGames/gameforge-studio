import test from 'node:test';
import assert from 'node:assert/strict';
import chat from '../api/openai/chat.ts';
import status from '../api/status.ts';
import netlify from '../netlify/functions/api.mts';

function output() {
  const result = { code: 200, body: null as any, headers: {} as Record<string, string> };
  const res = { setHeader(name: string, value: string) { result.headers[name] = value; }, status(code: number) { result.code = code; return res; }, json(body: unknown) { result.body = body; return res; } };
  return { result, res };
}

test('retained serverless adapter protects the server key and uses Sol high standard', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalPassword = process.env.APP_PASSWORD;
  const originalUser = process.env.APP_USERNAME;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.APP_PASSWORD = 'test-password-at-least-16';
  process.env.APP_USERNAME = 'owner';
  const headers = { authorization: `Basic ${Buffer.from('owner:test-password-at-least-16').toString('base64')}` };
  try {
    const denied = output();
    await chat({ method: 'POST', headers: {}, body: { prompt: 'x' } }, denied.res);
    assert.equal(denied.result.code, 401);
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.model, 'gpt-6.1-sol');
      assert.equal(body.reasoning.effort, 'high');
      assert.equal(body.service_tier, 'default');
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Game design' }] }] });
    };
    const allowed = output();
    await chat({ method: 'POST', headers, body: { prompt: 'x', model: 'gpt-5-nano' } }, allowed.res);
    assert.equal(allowed.result.code, 200);
    assert.equal(allowed.result.body.text, 'Game design');
    const info = output();
    status({ method: 'GET', headers }, info.res);
    assert.equal(info.result.body.defaultModel, 'gpt-6.1-sol');
    assert.equal(info.result.body.durableStorage, false);
    const bridged = await netlify(new Request('https://example.com/.netlify/functions/api/status', { headers }));
    assert.equal(bridged.status, 200);
    assert.equal((await bridged.json()).defaultModel, 'gpt-6.1-sol');
    delete process.env.APP_PASSWORD;
    const noPassword = output();
    status({ method: 'GET', headers }, noPassword.res);
    assert.equal(noPassword.result.code, 503);
  } finally {
    for (const [key, value] of Object.entries({ OPENAI_API_KEY: originalKey, APP_PASSWORD: originalPassword, APP_USERNAME: originalUser })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
  }
});

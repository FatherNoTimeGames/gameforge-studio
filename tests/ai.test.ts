import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponseBody, generateResponse } from '../server/ai.ts';

test('all AI requests use the requested model, high reasoning, and standard speed', () => {
  const body = createResponseBody({ prompt: 'Help me build my game.', model: 'other', service_tier: 'priority' });
  assert.equal(body.model, 'gpt-6.1-sol');
  assert.deepEqual(body.reasoning, { effort: 'high' });
  assert.equal(body.service_tier, 'default');
  assert.equal(body.store, false);
});
test('screenshots and strict wiki output remain supported', () => {
  const body = createResponseBody({ prompt: 'Read this error', imageBase64: 'aGVsbG8=', imageMimeType: 'image/png', outputKind: 'wiki_build' });
  assert.equal(body.input[0].content[1].type, 'input_image');
  assert.equal(body.text?.format.strict, true);
  assert.throws(() => createResponseBody({ prompt: 'x', imageBase64: 'bad image', imageMimeType: 'image/png' }));
  assert.throws(() => createResponseBody({ prompt: '' }));
});
test('only completed output text is returned, without exposing reasoning', async () => {
  const fetcher: typeof fetch = async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).model, 'gpt-6.1-sol');
    return Response.json({ status: 'completed', model: 'gpt-6.1-sol', output: [
      { type: 'reasoning', summary: [{ text: 'private reasoning' }] },
      { type: 'message', content: [{ type: 'output_text', text: '# Combat\n\nDesign.' }] },
    ] });
  };
  const result = await generateResponse({ prompt: 'x' }, 'test-key', new AbortController().signal, fetcher);
  assert.equal(result.text, '# Combat\n\nDesign.');
});
test('quota errors do not retry with another model or leak upstream text', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ error: { message: 'secret prompt' } }, { status: 429 }); };
  await assert.rejects(generateResponse({ prompt: 'x' }, 'key', new AbortController().signal, fetcher), /quota or rate limit/);
  assert.equal(calls, 1);
});
test('incomplete and refused responses cannot become wiki edits', async () => {
  for (const payload of [
    { status: 'incomplete', output: [{ type: 'message', content: [{ type: 'output_text', text: '# Half a page' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] },
  ]) await assert.rejects(generateResponse({ prompt: 'x' }, 'key', new AbortController().signal, async () => Response.json(payload)));
});

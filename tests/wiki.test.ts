import test from 'node:test';
import assert from 'node:assert/strict';
import { autoLinkWikiReferences, assembleWikiContext, requestAssistantResponse, buildWikiFromSources, verifyWikiAgainstSources, autoFixPageFromSources, generateIndexForPage, condenseWikiPage, autoNameProject } from '../src/services/aiService.ts';
import { splitSections, parseWikiEditBlocks, mergeSections } from '../src/utils/sectionMerger.ts';
import { isPublicAddress, validateSourceUrl } from '../server/safeFetch.ts';
import { TARGET_ENGINES } from '../src/data/initialData.ts';

const page = { id: 'p', title: 'Combat', content: '# Combat\n\n## Rules\nDamage 12.', lastModified: 1 };
test('wiki links preserve existing links, headings and code while matching longest titles', () => {
  const pages = [page, { ...page, id: 's', title: 'Stamina' }, { ...page, id: 'sc', title: 'Stamina Cost' }];
  const text = '# Stamina\nStamina Cost and stamina.\n[[stamina|Stamina]]\n`Stamina`\n```gdscript\nvar Stamina = 12\n```\n[Stamina](https://example.com)';
  const linked = autoLinkWikiReferences(text, pages, 'p');
  assert.equal(linked, '# Stamina\n[[Stamina Cost]] and [[stamina|Stamina]].\n[[stamina|Stamina]]\n`Stamina`\n```gdscript\nvar Stamina = 12\n```\n[Stamina](https://example.com)');
  assert.equal(autoLinkWikiReferences(linked, pages, 'p'), linked);
});
test('context contains deeply nested pages and orphaned legacy pages', () => {
  const pages = [page, { ...page, id: 'child', title: 'Damage', parentId: 'p' }, { ...page, id: 'leaf', title: 'Scaling', parentId: 'child' }, { ...page, id: 'orphan', title: 'Orphan', parentId: 'gone' }];
  const context = assembleWikiContext(pages, '[[Scaling]]');
  assert.match(context, /    - \[\[Scaling\]\]/);
  assert.match(context, /- \[\[Orphan\]\]/);
});
test('section merging preserves headings inside code blocks and unrelated sections', () => {
  const original = '# Combat\n\n## Rules\n```python\n## comment\nprint(12)\n```\n\n## Notes\nKeep this';
  assert.equal(splitSections(original).length, 3);
  const result = mergeSections(original, '# Combat\n\n## Notes\nChanged');
  assert.match(result.merged, /## comment\nprint\(12\)/);
  assert.match(result.merged, /## Notes\n\nChanged/);
});
test('wiki apply parser preserves nested code and supports multiple page proposals', () => {
  const text = '````markdown\n# Combat\n\n## Script\n```gdscript\nvar damage = 12\n```\n````\nPaste into: Combat\n\n```markdown\n# Damage\n\nDamage is 12.\n```\nPaste into: Damage';
  const parsed = parseWikiEditBlocks(text);
  assert.equal(parsed.length, 2);
  assert.match(parsed[0].body, /```gdscript\nvar damage = 12\n```/);
});
test('source imports reject private, mapped IPv4 and unsafe URLs', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.20.0.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1']) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  for (const url of ['file:///etc/passwd', 'http://localhost', 'http://127.1', 'http://[::1]', 'http://user:password@example.com', 'https://example.com:8080']) assert.throws(() => validateSourceUrl(url));
  assert.equal(validateSourceUrl('https://example.com/doc').hostname, 'example.com');
});
test('all assistant actions and utility workflows use the OpenAI route and retain inputs', async () => {
  const savedFetch = globalThis.fetch;
  const requests: any[] = [];
  globalThis.fetch = async (url, options) => {
    if (url === '/api/status') return Response.json({ status: 'ok' });
    assert.equal(url, '/api/openai/chat');
    const body = JSON.parse(String(options?.body));
    requests.push(body);
    let text = '# Combat\n\n## Rules\nDamage 12.';
    if (body.outputKind === 'wiki_build') text = JSON.stringify({ pages: [{ title: 'Combat', content: 'x'.repeat(21000), parentTitle: null }] });
    if (body.outputKind === 'verification') text = JSON.stringify({ status: 'ok', issues: [], unsupported: [], missing: [] });
    if (body.outputKind === 'index') text = JSON.stringify({ summary: 'Damage 12', keywords: ['Combat'] });
    if (body.prompt.startsWith('ORIGINAL PAGE:')) text = '````markdown\n# Combat\n\n## Script\n```gdscript\nvar damage = 12\n```\n````';
    return Response.json({ text, modelUsed: 'gpt-6.1-sol' });
  };
  try {
    for (const actionType of ['discuss', 'recompile', 'balance', 'teach', 'wiki_edit', 'test_logic', 'apply_agreed'] as const) {
      await requestAssistantResponse({ actionType, prompt: 'Review combat', pages: [page], targetEngine: TARGET_ENGINES[0], imageBase64: 'aGVsbG8=', imageMimeType: 'image/png' });
      assert.match(requests.at(-1).systemInstruction, /Damage 12/);
      assert.equal(requests.at(-1).imageBase64, 'aGVsbG8=');
    }
    const sources = [{ id: 's', kind: 'paste' as const, title: 'Source', text: 'x'.repeat(13000) + 'DO NOT OMIT', addedAt: 1 }];
    assert.equal((await buildWikiFromSources(sources, [page], false))[0].content.length, 21000);
    assert.match(requests.at(-1).prompt, /DO NOT OMIT/);
    const verdict = await verifyWikiAgainstSources(page, sources);
    assert.equal(verdict.status, 'ok');
    const repaired = await autoFixPageFromSources(page, verdict, sources);
    assert.match(repaired, /```gdscript\nvar damage = 12\n```/);
    await generateIndexForPage(page);
    await condenseWikiPage(page);
    await autoNameProject(page.content, [page.title]);
    assert.equal(requests.length, 13);
  } finally { globalThis.fetch = savedFetch; }
});

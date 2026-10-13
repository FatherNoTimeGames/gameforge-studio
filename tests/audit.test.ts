import test from 'node:test';
import assert from 'node:assert/strict';
import { importProject, createProjectBackup } from '../src/utils/projectData.ts';
import { pageWithContent, applyPageContent, assistantNotes, appendChatReply, canSetPageParent } from '../src/utils/projectEdits.ts';
import { markdownExportFiles } from '../src/utils/exportPages.ts';
import { parseWikiEditBlocks, mergeSections } from '../src/utils/sectionMerger.ts';
import { workspaceFromSave } from '../shared/workspaceSync.ts';

const project = () => importProject({ name: 'Original', updatedAt: 100, pages: [{ id: 'home', title: 'Home', content: '# Home\nOriginal', lastModified: 100 }], conceptNotepad: 'Secret brainstorming', teacherNotepad: 'Private code' }, 'game');
test('renamed imported projects keep their current name and timestamp after cloud normalization', () => {
  const imported = importProject(createProjectBackup(project()), 'game');
  imported.name = 'Renamed on tablet'; imported.updatedAt = 200;
  const loaded = importProject(JSON.parse(JSON.stringify(imported)), 'game');
  assert.equal(loaded.name, 'Renamed on tablet'); assert.equal(loaded.updatedAt, 200);
});
test('corrupt snapshots and duplicate item identifiers are rejected before becoming saved projects', () => {
  assert.throws(() => importProject({ pages: [], snapshots: [{ id: 'snap', name: 'Bad', state: { pages: [{ id: 'page', title: 'Missing content' }] } }] }, 'game'));
  assert.throws(() => importProject({ pages: [], sources: [{ id: 's', title: 'one', text: 'x' }, { id: 's', title: 'two', text: 'y' }] }, 'game'));
  const current = { projects: [project()], activeProjectId: 'game', revision: 1 };
  assert.throws(() => workspaceFromSave(current, { projects: [{ id: 'game', name: 'Broken', pages: [{ id: 'bad' }] }] }));
  assert.equal(current.projects[0].pages[0].content, '# Home\nOriginal');
});
test('cyclic wiki parents are normalized and parent selection cannot create cycles', () => {
  const loaded = importProject({ pages: [{ id: 'a', title: 'A', content: '', parentId: 'b' }, { id: 'b', title: 'B', content: '', parentId: 'a' }] }, 'game');
  assert.equal(loaded.pages[0].parentId, null);
  assert.equal(canSetPageParent(loaded.pages, 'a', 'b'), false);
  assert.equal(canSetPageParent(loaded.pages, 'b', 'a'), true);
});
test('typing preserves a useful pre-edit revision rather than the last five keystrokes', () => {
  const original = project().pages[0];
  let edited = original;
  for (let i = 0; i < 20; i++) edited = pageWithContent(edited, `Typing ${i}`, 1000 + i);
  assert.equal(edited.history!.length, 1); assert.equal(edited.history![0].content, original.content);
  edited = pageWithContent(edited, 'Later editing session', 30_000);
  assert.equal(edited.history!.length, 2); assert.equal(edited.history![0].content, 'Typing 19');
});
test('a delayed AI edit applies only to its original project/page and refuses a deleted target', () => {
  const first = project(), second = { ...project(), id: 'other' };
  const result = applyPageContent([first, second], 'game', 'home', 'Condensed');
  assert.equal(result[0].pages[0].content, 'Condensed'); assert.equal(result[1].pages[0].content, second.pages[0].content);
  assert.throws(() => applyPageContent([second], 'game', 'home', 'Condensed'));
});
test('scratchpads stay out of AI requests until explicitly enabled', () => {
  const p = project(); assert.equal(assistantNotes(p, 'concept'), undefined); assert.equal(assistantNotes(p, 'teacher'), undefined);
  p.includeScratchpadsInAi = true;
  assert.equal(assistantNotes(p, 'concept'), 'Secret brainstorming'); assert.equal(assistantNotes(p, 'teacher'), 'Private code');
});
test('restoring an in-flight reply cannot duplicate it when the original request returns', () => {
  const message = { id: 'chatgpt-task', role: 'assistant' as const, text: 'Reply', actionType: 'discuss' as const, timestamp: 1 };
  const restored = appendChatReply(project(), 'concept', message);
  assert.equal(appendChatReply(restored, 'concept', message).chatConcept.length, 1);
});
test('Markdown export keeps colliding titles, quotes and Unicode without overwriting files', () => {
  const p = project().pages[0];
  const titles = ['Damage/Stats', 'Damage Stats', 'damage stats', '中文', '日本語', 'A "quoted" title\nnext line'];
  const files = markdownExportFiles(titles.map((title, i) => ({ ...p, id: String(i), title })));
  assert.equal(new Set(files.map((f) => f.name.toLowerCase())).size, titles.length);
  for (let i = 0; i < titles.length; i++) assert.equal(JSON.parse(files[i].content.split('\n')[1].slice('title: '.length)), titles[i]);
});
test('plain Markdown proposals keep code headings intact and Unicode section edits target the correct heading', () => {
  const markdown = '# Combat\n\n```\n# A code comment\n```\n\n## Rules\nDamage 12.';
  const parsed = parseWikiEditBlocks(markdown);
  assert.equal(parsed.length, 1); assert.equal(parsed[0].body, markdown);
  const merged = mergeSections('# Stats\n\n## 数值\nKeep\n\n## 伤害\nOld', '# Stats\n\n## 伤害\nNew');
  assert.match(merged.merged, /## 数值\n\nKeep/); assert.match(merged.merged, /## 伤害\n\nNew/);
});

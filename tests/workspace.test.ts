import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WorkspaceStore } from '../server/workspaceStore.ts';
import { createProjectBackup, importProject } from '../src/utils/projectData.ts';

test('full backup round trip preserves sources, notes, chat, history, snapshots and hierarchy', () => {
  const original = importProject({ name: 'Game', pages: [{ id: 'p', title: 'Combat', content: 'Damage: 12', history: [{ content: 'Damage: 10', title: 'Combat', at: 1 }] }, { id: 'c', title: 'Damage', content: 'Scale: 2', parentId: 'p' }], sources: [{ id: 's', title: 'Source', text: '12', kind: 'paste', addedAt: 1 }], conceptNotepad: 'Concept', teacherNotepad: 'Code', chatConcept: [{ id: 'm', text: 'hello', role: 'user' }], chatTeacher: [], snapshots: [{ id: 'snap', name: 'Checkpoint', state: { pages: [] } }] }, 'original');
  const restored = importProject(JSON.parse(JSON.stringify(createProjectBackup(original))), 'restored');
  for (const field of ['pages', 'sources', 'chatConcept', 'chatTeacher', 'snapshots', 'conceptNotepad', 'teacherNotepad'] as const) assert.deepEqual(restored[field], original[field]);
  assert.equal(restored.id, 'restored');
  assert.equal(importProject({ pages: [], notepad: 'old' }, 'legacy').conceptNotepad, 'old');
});
test('invalid page imports are rejected before entering app state', () => {
  assert.throws(() => importProject({ pages: [{ title: 'Missing content' }] }, 'x'));
});
test('durable writes survive restart and reject concurrent stale revisions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gameforge-test-'));
  try {
    const store = new WorkspaceStore(directory);
    assert.equal(await store.load(), null);
    const input = { projects: [{ id: 'p', name: 'Game', pages: [] }], activeProjectId: 'p', revision: 0 };
    const results = await Promise.allSettled([store.save(input), store.save(input)]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    const loaded = await new WorkspaceStore(directory).load();
    assert.equal(loaded?.revision, 1);
    assert.deepEqual(loaded?.projects, input.projects);
    await store.save({ ...input, revision: 1 });
    assert.equal((await store.load())?.revision, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

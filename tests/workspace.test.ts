import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WorkspaceStore } from '../server/workspaceStore.ts';
import { createEmptyProject, createProjectBackup, importProject } from '../src/utils/projectData.ts';
import { changedFields } from '../shared/workspaceSync.ts';

test('new games start empty and remain isolated through workspace saves', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gameforge-new-project-'));
  try {
    const existing = importProject({ name: 'Existing game', pages: [{ id: 'old-page', title: 'Old wiki', content: 'Existing design' }], conceptNotepad: 'Existing notes' }, 'existing');
    const fresh = createEmptyProject('new-game');
    const store = new WorkspaceStore(directory);
    await store.save({ projects: [fresh, existing], activeProjectId: fresh.id, revision: 0 });
    const restored = (await new WorkspaceStore(directory).load())!.projects.map((project, index) => importProject(project, index === 0 ? fresh.id : existing.id));
    assert.deepEqual(restored[0].pages, []);
    assert.equal(restored[0].conceptNotepad, '');
    assert.equal(restored[0].teacherNotepad, '');
    assert.deepEqual(restored[1].pages, existing.pages);
    assert.equal(restored[1].conceptNotepad, 'Existing notes');
    fresh.pages.push({ ...existing.pages[0], id: 'new-page' });
    assert.deepEqual(createEmptyProject('another-game').pages, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
test('durable writes survive restart and accept writes from stale devices', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gameforge-test-'));
  try {
    const store = new WorkspaceStore(directory);
    assert.equal(await store.load(), null);
    const input = { projects: [{ id: 'p', name: 'Game', pages: [] }], activeProjectId: 'p', revision: 0 };
    const results = await Promise.allSettled([store.save(input), store.save(input)]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'fulfilled');
    const loaded = await new WorkspaceStore(directory).load();
    assert.equal(loaded?.revision, 2);
    assert.deepEqual(loaded?.projects, input.projects);
    await store.save({ ...input, revision: 1 });
    assert.equal((await store.load())?.revision, 3);
    const phone = structuredClone(input.projects), tablet = structuredClone(input.projects);
    phone[0].name = 'Phone name';
    (tablet[0] as any).conceptNotepad = 'Tablet notes';
    await Promise.all([
      store.save({ changes: changedFields(input.projects, phone), activeProjectId: 'p' }),
      store.save({ changes: changedFields(input.projects, tablet), activeProjectId: 'p' }),
    ]);
    const merged = await new WorkspaceStore(directory).load();
    assert.equal((merged!.projects[0] as any).name, 'Phone name');
    assert.equal((merged!.projects[0] as any).conceptNotepad, 'Tablet notes');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

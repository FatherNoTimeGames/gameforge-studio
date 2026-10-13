import test from 'node:test';
import assert from 'node:assert/strict';
import { applyChanges, changedFields, keepPendingEdits, validChange, workspaceFromSave } from '../shared/workspaceSync.ts';

const original = () => [{ id: 'game', name: 'Game', pages: [{ id: 'combat', title: 'Combat', content: 'Original' }, { id: 'world', title: 'World', content: 'Original world' }], chatConcept: [], sources: [], snapshots: [], conceptNotepad: 'Draft', teacherNotepad: '' }];
test('phone and tablet edits to separate fields and pages survive either submission order', () => {
  const base = original(), phone = structuredClone(base), tablet = structuredClone(base);
  phone[0].pages[0].content = 'Phone combat'; phone[0].conceptNotepad = 'Phone notes';
  tablet[0].pages[1].content = 'Tablet world'; tablet[0].name = 'Tablet name';
  for (const [first, second] of [[phone, tablet], [tablet, phone]]) {
    const result = applyChanges(applyChanges(base, changedFields(base, first)), changedFields(base, second));
    assert.equal(result[0].pages[0].content, 'Phone combat');
    assert.equal(result[0].pages[1].content, 'Tablet world');
    assert.equal(result[0].conceptNotepad, 'Phone notes');
    assert.equal(result[0].name, 'Tablet name');
  }
});
test('last submitted edit wins on the same field while concurrent additions remain', () => {
  const base: any[] = original(), phone = structuredClone(base), tablet = structuredClone(base);
  phone[0].pages[0].content = 'Phone'; tablet[0].pages[0].content = 'Tablet';
  phone[0].chatConcept.push({ id: 'phone-message', text: 'Hello' });
  tablet[0].chatConcept.push({ id: 'tablet-message', text: 'Hi' });
  phone[0].sources.push({ id: 'phone-source', text: 'Phone source' });
  tablet[0].snapshots.push({ id: 'tablet-snapshot', state: {} });
  const result = applyChanges(applyChanges(base, changedFields(base, phone)), changedFields(base, tablet));
  assert.equal(result[0].pages[0].content, 'Tablet');
  assert.deepEqual(new Set(result[0].chatConcept.map((m: any) => m.id)), new Set(['phone-message', 'tablet-message']));
  assert.equal(result[0].sources[0].id, 'phone-source'); assert.equal(result[0].snapshots[0].id, 'tablet-snapshot');
});
test('pending local typing survives a cloud refresh and an earlier save response', () => {
  const submitted = original(), cloud = structuredClone(submitted), typing = structuredClone(submitted);
  cloud[0].pages[1].content = 'Other device update';
  typing[0].pages[0].content = 'Still typing after save started';
  const visible = keepPendingEdits(cloud, submitted, typing);
  assert.equal(visible[0].pages[0].content, typing[0].pages[0].content);
  assert.equal(visible[0].pages[1].content, cloud[0].pages[1].content);
  const pending = changedFields(cloud, visible);
  const newer = structuredClone(cloud); newer[0].name = 'Renamed later';
  const recovered = applyChanges(newer, JSON.parse(JSON.stringify(pending)));
  assert.equal(recovered[0].name, 'Renamed later');
  assert.equal(recovered[0].pages[0].content, typing[0].pages[0].content);
});
test('deletions propagate without stale copies resurrecting items or losing new remote items', () => {
  const base = original(), phone = structuredClone(base), tablet = structuredClone(base);
  phone[0].pages.splice(0, 1);
  tablet[0].pages[0].content = 'Stale edit of deleted page';
  tablet[0].pages.push({ id: 'new-page', title: 'New', content: 'Keep this' });
  const result = applyChanges(applyChanges(base, changedFields(base, phone)), changedFields(base, tablet));
  assert.deepEqual(result[0].pages.map((p: any) => p.id), ['world', 'new-page']);
});
test('equivalent data with different object key order produces no save loop', () => {
  assert.equal(changedFields([{ id: 'one', name: 'Game' }], [{ name: 'Game', id: 'one' }]), undefined);
});
test('invalid changes cannot become private workspace records', () => {
  assert.equal(validChange({ kind: 'object', fields: JSON.parse('{"__proto__":{"kind":"replace","value":{}}}') }), false);
  assert.throws(() => workspaceFromSave(null, { changes: { kind: 'unknown' } }));
  assert.throws(() => workspaceFromSave(null, { projects: [] }));
});

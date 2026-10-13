import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAndRepairPages } from '../src/services/verification.ts';

test('auto repair verifies repaired pages on the next pass instead of repeating old failures', async () => {
  const checked: string[] = [];
  const repaired: string[] = [];
  const page = { id: 'p', title: 'Combat', content: 'wrong value', lastModified: 1 };
  await verifyAndRepairPages({
    pages: [page], sources: [], maxPasses: 4, shouldStop: () => false,
    onVerdicts: () => {}, onProgress: () => {}, onRepair: (_page, content) => repaired.push(content),
    verify: async (page) => {
      checked.push(page.content);
      return { title: page.title, status: page.content === 'correct value' ? 'ok' : 'error', issues: ['wrong'], unsupported: [], missing: [] };
    },
    repair: async () => 'correct value',
  });
  assert.deepEqual(checked, ['wrong value', 'correct value']);
  assert.deepEqual(repaired, ['correct value']);
  assert.equal(page.content, 'wrong value');
});
test('stopping during a repair prevents later mutations and further requests', async () => {
  let stopped = false;
  let applied = 0;
  await verifyAndRepairPages({
    pages: [{ id: 'p', title: 'Combat', content: 'wrong', lastModified: 1 }], sources: [], maxPasses: 4,
    shouldStop: () => stopped, onVerdicts: () => {}, onProgress: () => {}, onRepair: () => applied++,
    verify: async () => ({ title: 'Combat', status: 'error', issues: [], unsupported: [], missing: [] }),
    repair: async () => { stopped = true; return 'fixed'; },
  });
  assert.equal(applied, 0);
});

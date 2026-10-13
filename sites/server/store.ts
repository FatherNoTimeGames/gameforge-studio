import { HttpError, type StorageEnv, type Job } from './contracts.ts';
import { createResponseBody } from '../../shared/openai.ts';
import { workspaceFromSave } from '../../shared/workspaceSync.ts';

async function readBlob(env: StorageEnv, key: string) {
  const object = await env.BUCKET.get(key);
  if (!object) throw new HttpError(503, 'Saved data is temporarily unavailable. Please retry.');
  return JSON.parse(await object.text());
}
export async function loadWorkspace(env: StorageEnv, owner: string, knownRevision?: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await env.DB.prepare('SELECT revision, blob_key FROM workspaces WHERE owner = ?').bind(owner).first();
    if (!row) return null;
    if (row.revision === knownRevision) return undefined;
    const object = await env.BUCKET.get(row.blob_key);
    // A successful save may have retired the old blob after this pointer read.
    if (object) return { ...JSON.parse(await object.text()), revision: row.revision };
  }
  throw new HttpError(503, 'Saved data is temporarily unavailable. Please retry.');
}
export async function saveWorkspace(env: StorageEnv, owner: string, input: any) {
  // Compare-and-swap is internal: concurrent callers retry against the newest
  // workspace and apply their edits again, rather than returning device conflicts.
  for (let attempt = 0; attempt < 12; attempt++) {
    const current = await loadWorkspace(env, owner);
    let record;
    try { record = workspaceFromSave(current, input); }
    catch (error: any) { throw new HttpError(400, error.message); }
    if (new TextEncoder().encode(JSON.stringify(record)).length > 8_000_000) throw new HttpError(413, 'Workspace exceeds the 8 MB cloud-save limit. Export a backup and reduce stored sources or snapshots.');
    const prior = await env.DB.prepare('SELECT revision, blob_key FROM workspaces WHERE owner = ?').bind(owner).first();
    if ((prior?.revision ?? 0) !== (current?.revision ?? 0)) continue;
    const key = `workspace/${crypto.randomUUID()}`;
    await env.BUCKET.put(key, JSON.stringify({ projects: record.projects, activeProjectId: record.activeProjectId }));
    let changed = false;
    try {
      const result = prior
        ? await env.DB.prepare('UPDATE workspaces SET revision = ?, blob_key = ?, updated_at = ? WHERE owner = ? AND revision = ?')
          .bind(record.revision, key, Date.now(), owner, prior.revision).run()
        : await env.DB.prepare('INSERT INTO workspaces (owner, revision, blob_key, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner) DO NOTHING')
          .bind(owner, record.revision, key, Date.now()).run();
      changed = result.meta.changes === 1;
    } finally { if (!changed) await env.BUCKET.delete(key); }
    if (!changed) continue;
    if (prior?.blob_key) await env.BUCKET.delete(prior.blob_key).catch(() => {});
    return record;
  }
  throw new HttpError(503, 'The workspace is busy. Your device will retry its pending changes.');
}

export async function listRequests(env: StorageEnv, owner: string) {
  return (await env.DB.prepare('SELECT id, state, created_at FROM requests WHERE owner = ? ORDER BY created_at DESC LIMIT 40').bind(owner).all()).results;
}
export async function getRequest(env: StorageEnv, owner: string, id: string): Promise<Job> {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new HttpError(400, 'Invalid request ID.');
  const job = await env.DB.prepare('SELECT * FROM requests WHERE owner = ? AND id = ?').bind(owner, id).first<Job>();
  if (!job) throw new HttpError(404, 'Request not found for your account.');
  return job;
}
export async function createRequest(env: StorageEnv, owner: string, input: unknown) {
  createResponseBody(input); // Reuse the existing prompt/image/format validation; no model call.
  const payload = input as Record<string, unknown>;
  const context = payload.clientContext as any;
  if (context !== undefined && (!context || typeof context.projectId !== 'string' || context.projectId.length > 200 || !['concept', 'teacher'].includes(context.thread) ||
    !['discuss', 'recompile', 'balance', 'teach', 'wiki_edit', 'test_logic', 'apply_agreed'].includes(context.actionType))) throw new HttpError(400, 'Invalid chat destination.');
  const normalized = JSON.stringify({ prompt: payload.prompt, systemInstruction: payload.systemInstruction,
    imageBase64: payload.imageBase64, imageMimeType: payload.imageMimeType, outputKind: payload.outputKind, clientContext: context });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const fingerprint = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const existing = await env.DB.prepare("SELECT * FROM requests WHERE owner = ? AND fingerprint = ? AND state IN ('pending', 'completed') ORDER BY created_at DESC LIMIT 1").bind(owner, fingerprint).first<Job>();
  if (existing) return { id: existing.id, state: existing.state };
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM requests WHERE owner = ?').bind(owner).first();
  if (count.total >= 40) throw new HttpError(429, 'Your request inbox is full. Delete old requests before creating more.');
  const id = crypto.randomUUID();
  const key = `request/${id}/prompt`;
  await env.BUCKET.put(key, normalized);
  try {
    await env.DB.prepare('INSERT INTO requests (id, owner, fingerprint, state, blob_key, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, owner, fingerprint, 'pending', key, Date.now()).run();
  } catch (error) { await env.BUCKET.delete(key); throw error; }
  return { id, state: 'pending' };
}
export async function requestPayload(env: StorageEnv, job: Job) { return readBlob(env, job.blob_key); }
export async function requestResult(env: StorageEnv, job: Job) {
  return { id: job.id, state: job.state, ...(job.result_key ? await readBlob(env, job.result_key) : {}) };
}

function validateResult(text: unknown, kind: unknown) {
  if (typeof text !== 'string' || !text.trim() || new TextEncoder().encode(text).length > 1_000_000) throw new HttpError(400, 'Provide a nonempty answer under 1 MB.');
  if (!kind) return;
  let data: any;
  try { data = JSON.parse(text); } catch { throw new HttpError(400, 'This request requires plain JSON without markdown fences.'); }
  const strings = (x: unknown) => Array.isArray(x) && x.every((s) => typeof s === 'string');
  const valid = data && typeof data === 'object' && !Array.isArray(data) && (
    kind === 'wiki_build' ? Array.isArray(data.pages) && data.pages.every((p: any) => p && typeof p.title === 'string' && typeof p.content === 'string' && (p.parentTitle === null || typeof p.parentTitle === 'string')) :
    kind === 'verification' ? ['ok', 'warning', 'error'].includes(data.status) && strings(data.issues) && strings(data.unsupported) && strings(data.missing) :
    kind === 'index' ? typeof data.summary === 'string' && strings(data.keywords) : false);
  if (!valid) throw new HttpError(400, 'The answer does not match the requested JSON format. Read the request and correct it.');
}
export async function completeRequest(env: StorageEnv, owner: string, id: string, text: unknown) {
  const job = await getRequest(env, owner, id);
  if (job.state !== 'pending') {
    if (job.result_key && (await readBlob(env, job.result_key)).text === text) return { id, state: job.state };
    throw new HttpError(409, 'This request is no longer pending. Its saved answer has not been changed.');
  }
  const payload = await requestPayload(env, job);
  validateResult(text, payload.outputKind);
  const key = `request/${id}/result-${crypto.randomUUID()}`;
  await env.BUCKET.put(key, JSON.stringify({ text, modelUsed: 'ChatGPT (conversation selection)', clientContext: payload.clientContext }));
  let changed = false;
  try {
    const result = await env.DB.prepare("UPDATE requests SET state = 'completed', result_key = ? WHERE owner = ? AND id = ? AND state = 'pending'").bind(key, owner, id).run();
    changed = result.meta.changes === 1;
  } finally { if (!changed) await env.BUCKET.delete(key); }
  if (!changed) throw new HttpError(409, 'Another answer completed this request first.');
  return { id, state: 'completed' };
}
export async function consumeRequest(env: StorageEnv, owner: string, id: string) {
  await getRequest(env, owner, id);
  const result = await env.DB.prepare("UPDATE requests SET state = 'consumed' WHERE owner = ? AND id = ? AND state = 'completed'").bind(owner, id).run();
  return { ok: true, claimed: result.meta.changes === 1 };
}
export async function recoverRequest(env: StorageEnv, owner: string, id: string) {
  const job = await getRequest(env, owner, id);
  if (!job.result_key) throw new HttpError(409, 'This task has no saved reply yet.');
  await env.DB.prepare("UPDATE requests SET state = 'completed' WHERE owner = ? AND id = ? AND state = 'consumed'").bind(owner, id).run();
  return { ok: true };
}
export async function deleteRequest(env: StorageEnv, owner: string, id: string) {
  const job = await getRequest(env, owner, id);
  await env.DB.prepare('DELETE FROM requests WHERE owner = ? AND id = ?').bind(owner, id).run();
  await env.BUCKET.delete(job.blob_key);
  if (job.result_key) await env.BUCKET.delete(job.result_key);
  return { ok: true };
}

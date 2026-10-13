// Send only changed fields/items, so a stale device cannot overwrite unrelated
// work. Whole text fields use the last successfully submitted value.
export type Change =
  | { kind: 'replace'; value: any }
  | { kind: 'remove' }
  | { kind: 'object'; fields: Record<string, Change> }
  | { kind: 'items'; entries: Record<string, Change>; order?: string[] };
const equal = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const object = (x: any) => x !== null && typeof x === 'object' && !Array.isArray(x);
const keyed = (xs: any[]) => xs.every((x) => object(x) && typeof x.id === 'string') && new Set(xs.map((x) => x.id)).size === xs.length;
const map = (xs: any[]) => new Map(xs.map((x) => [x.id, x]));

export function changedFields(base: any, next: any): Change | undefined {
  if (Object.is(base, next)) return undefined;
  if (next === undefined) return { kind: 'remove' };
  if (Array.isArray(base) && Array.isArray(next) && keyed(base) && keyed(next)) {
    const before = map(base), after = map(next);
    const entries = Object.fromEntries([...new Set([...before.keys(), ...after.keys()])].flatMap((id) => {
      const change = changedFields(before.get(id), after.get(id));
      return change ? [[id, change]] : [];
    }));
    const reordered = !equal(base.map((x) => x.id), next.map((x) => x.id));
    return Object.keys(entries).length || reordered ? { kind: 'items', entries, ...(reordered ? { order: next.map((x) => x.id) } : {}) } : undefined;
  }
  if (object(base) && object(next)) {
    const fields = Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(next)])].flatMap((key) => {
      const change = changedFields(base[key], next[key]);
      return change ? [[key, change]] : [];
    }));
    return Object.keys(fields).length ? { kind: 'object', fields } : undefined;
  }
  return equal(base, next) ? undefined : { kind: 'replace', value: next };
}

export function applyChanges(current: any, change?: Change): any {
  if (!change) return current;
  if (change.kind === 'remove') return undefined;
  if (change.kind === 'replace') return change.value;
  // An ordinary edit must not resurrect an item deleted on another device.
  if (current === undefined) return undefined;
  if (change.kind === 'object') {
    const result = new Map(Object.entries(object(current) ? current : {}));
    for (const [key, edit] of Object.entries(change.fields)) {
      const value = applyChanges(result.get(key), edit);
      if (value === undefined) result.delete(key); else result.set(key, value);
    }
    return Object.fromEntries(result);
  }
  const items = map(Array.isArray(current) ? current : []);
  for (const [id, edit] of Object.entries(change.entries)) {
    const value = applyChanges(items.get(id), edit);
    if (value === undefined) items.delete(id); else items.set(id, value);
  }
  const order = [...new Set([...(change.order ?? []), ...items.keys()])];
  return order.filter((id) => items.has(id)).map((id) => items.get(id));
}

export function validChange(change: any, depth = 0): change is Change {
  if (!object(change) || depth > 100) return false;
  if (change.kind === 'remove') return true;
  if (change.kind === 'replace') return Object.hasOwn(change, 'value');
  const children = change.kind === 'object' ? change.fields : change.kind === 'items' ? change.entries : null;
  return object(children) && Object.keys(children).every((key) => !['__proto__', 'constructor', 'prototype'].includes(key)) &&
    Object.values(children).every((child) => validChange(child, depth + 1)) &&
    (change.kind !== 'items' || change.order === undefined || (Array.isArray(change.order) && change.order.every((id: any) => typeof id === 'string')));
}

export function workspaceFromSave(current: any, input: any) {
  if (!input || typeof input !== 'object') throw new Error('Invalid workspace.');
  if (Object.hasOwn(input, 'changes') && !validChange(input.changes)) throw new Error('Invalid workspace changes.');
  const projects = Object.hasOwn(input, 'changes') ? applyChanges(current?.projects ?? [], input.changes) : input.projects;
  if (!Array.isArray(projects) || !projects.length || !keyed(projects) || projects.some((p) => typeof p.name !== 'string' || !Array.isArray(p.pages))) throw new Error('Invalid workspace projects.');
  const activeProjectId = projects.some((p) => p.id === input.activeProjectId) ? input.activeProjectId
    : projects.some((p) => p.id === current?.activeProjectId) ? current.activeProjectId : projects[0].id;
  return { projects, activeProjectId, revision: (current?.revision ?? 0) + 1 };
}

export function keepPendingEdits(serverProjects: any[], submittedProjects: any[], latestProjects: any[]) {
  return applyChanges(serverProjects, changedFields(submittedProjects, latestProjects));
}

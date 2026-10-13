import type { ProjectData } from '../types';
import { TARGET_ENGINES } from '../data/initialData.ts';
import { normalizePageHierarchy } from './projectEdits.ts';

export function importProject(data: any, id: string): ProjectData {
  if (typeof id !== 'string' || !id) throw new Error('Invalid project identifier.');
  if (!data || !Array.isArray(data.pages)) throw new Error('Invalid project file: missing pages array.');
  const pageIds = new Set<string>();
  const pages = data.pages.map((p: any) => {
    if (!p || typeof p.id !== 'string' || !p.id || pageIds.has(p.id) || typeof p.title !== 'string' || typeof p.content !== 'string') throw new Error('Invalid or duplicate wiki page in project file.');
    pageIds.add(p.id);
    return { ...p, lastModified: Number.isFinite(p.lastModified) ? p.lastModified : Date.now(), history: Array.isArray(p.history) ? p.history.filter((h: any) => h && typeof h.content === 'string' && typeof h.title === 'string' && Number.isFinite(h.at)) : [], keywords: Array.isArray(p.keywords) ? p.keywords.filter((k: any) => typeof k === 'string') : undefined, tags: Array.isArray(p.tags) ? p.tags.filter((t: any) => typeof t === 'string') : undefined };
  });
  const sources = Array.isArray(data.sources) ? data.sources : [];
  if (sources.some((source: any) => !source || typeof source.id !== 'string' || typeof source.title !== 'string' || typeof source.text !== 'string')) throw new Error('Invalid source document in backup.');
  const chatConcept = Array.isArray(data.chatConcept) ? data.chatConcept : [];
  const chatTeacher = Array.isArray(data.chatTeacher) ? data.chatTeacher : [];
  if ([...chatConcept, ...chatTeacher].some((message: any) => !message || typeof message.id !== 'string' || typeof message.text !== 'string' || !['user', 'assistant'].includes(message.role))) throw new Error('Invalid chat message in backup.');
  for (const items of [sources, chatConcept, chatTeacher]) {
    if (items.some((item: any) => !item.id) || new Set(items.map((item: any) => item.id)).size !== items.length) throw new Error('Invalid or duplicate source/chat identifier in backup.');
  }
  const snapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
  if (snapshots.some((snapshot: any) => !snapshot || typeof snapshot.id !== 'string' || typeof snapshot.name !== 'string' || !snapshot.state || !Array.isArray(snapshot.state.pages))) throw new Error('Invalid snapshot in backup.');
  if (new Set(snapshots.map((snapshot: any) => snapshot.id)).size !== snapshots.length) throw new Error('Duplicate snapshot identifier in backup.');
  const checkedSnapshots = snapshots.map((snapshot: any) => {
    const restored = importProject({ ...snapshot.state, name: snapshot.state.projectName ?? data.name ?? data.projectName, snapshots: [] }, snapshot.id);
    return { ...snapshot, pageCount: restored.pages.length, state: { ...snapshot.state,
      projectName: restored.name, targetEngineId: restored.targetEngineId, pages: restored.pages, sources: restored.sources,
      conceptNotepad: restored.conceptNotepad, teacherNotepad: restored.teacherNotepad } };
  });
  return {
    ...data,
    id,
    name: String(data.name ?? data.projectName ?? 'Imported Project'),
    manualName: data.manualName ?? true,
    updatedAt: Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now(),
    targetEngineId: TARGET_ENGINES.some((e) => e.id === data.targetEngineId) ? data.targetEngineId : 'godot4',
    pages: normalizePageHierarchy(pages),
    sources,
    conceptNotepad: String(data.conceptNotepad ?? data.notepad ?? ''),
    teacherNotepad: String(data.teacherNotepad ?? ''),
    chatConcept,
    chatTeacher,
    snapshots: checkedSnapshots,
    includeScratchpadsInAi: data.includeScratchpadsInAi === true,
  };
}

export function createProjectBackup(project: ProjectData) {
  return { ...project, gameForgeVersion: '1.1.0', exportedAt: new Date().toISOString(), projectName: project.name };
}

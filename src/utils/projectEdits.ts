import type { ChatMessage, ProjectData, WikiPage } from '../types/index.ts';

export function pageWithContent(page: WikiPage, content: string, now = Date.now(), checkpoint = false): WikiPage {
  if (page.content === content) return page;
  const history = page.history ?? [];
  const saveCheckpoint = checkpoint || !history.length || now - page.lastModified > 10_000;
  return { ...page, content, summary: undefined, keywords: undefined, lastModified: now,
    history: saveCheckpoint ? [{ content: page.content, title: page.title, at: now }, ...history].slice(0, 5) : history };
}
export function applyPageContent(projects: ProjectData[], projectId: string, pageId: string, content: string) {
  if (!projects.some((p) => p.id === projectId && p.pages.some((page) => page.id === pageId))) throw new Error('The original page was deleted. Your saved AI reply is still available.');
  return projects.map((project) => project.id !== projectId ? project : { ...project, updatedAt: Date.now(),
    pages: project.pages.map((page) => page.id === pageId ? pageWithContent(page, content, Date.now(), true) : page) });
}
export function appendChatReply(project: ProjectData, thread: 'concept' | 'teacher', message: ChatMessage) {
  const key = thread === 'teacher' ? 'chatTeacher' : 'chatConcept';
  return project[key].some((m) => m.id === message.id) ? project : { ...project, [key]: [...project[key], message] };
}
export function assistantNotes(project: ProjectData, thread: 'concept' | 'teacher') {
  return project.includeScratchpadsInAi ? (thread === 'teacher' ? project.teacherNotepad : project.conceptNotepad) : undefined;
}
export function canSetPageParent(pages: WikiPage[], pageId: string, parentId: string | null) {
  if (!parentId) return true;
  const byId = new Map(pages.map((page) => [page.id, page]));
  const seen = new Set([pageId]);
  let cursor = parentId;
  while (cursor) {
    if (seen.has(cursor) || !byId.has(cursor)) return false;
    seen.add(cursor); cursor = byId.get(cursor)!.parentId ?? '';
  }
  return true;
}
export function normalizePageHierarchy(pages: WikiPage[]): WikiPage[] {
  const result = pages.map((page) => ({ ...page }));
  for (const page of result) if (!canSetPageParent(result, page.id, page.parentId ?? null)) page.parentId = null;
  return result;
}

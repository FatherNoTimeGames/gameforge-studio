import { useEffect, useRef, useState } from 'react';
import type { ProjectData } from '../types';
import { importProject } from '../utils/projectData';

const PROJECTS_KEY = 'gameforge_multi_projects_v4';
const ACTIVE_KEY = 'gameforge_active_project_id_v4';
type SaveStatus = 'saved' | 'saving' | 'dirty';

function loadLocal(defaultProject: ProjectData) {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length) {
      const projects = parsed.map((p) => importProject(p, p.id));
      const active = localStorage.getItem(ACTIVE_KEY);
      return { projects, activeProjectId: projects.some((p) => p.id === active) ? active! : projects[0].id, error: '' };
    }
  } catch {
    return { projects: [defaultProject], activeProjectId: defaultProject.id, error: 'The browser workspace could not be loaded. Its stored data has not been replaced. Restore a backup or use a saved server workspace.' };
  }
  return { projects: [defaultProject], activeProjectId: defaultProject.id, error: '' };
}

export function useWorkspace(defaultProject: ProjectData) {
  const [initial] = useState(() => loadLocal(defaultProject));
  const [projects, setProjects] = useState(initial.projects);
  const [activeProjectId, setActiveProjectId] = useState(initial.activeProjectId);
  const [ready, setReady] = useState(false);
  const [durable, setDurable] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState(initial.error);
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);
  const conflict = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const latest = useRef({ projects, activeProjectId });
  latest.current = { projects, activeProjectId };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    (async () => {
      try {
        const response = await fetch('/api/workspace', { signal: controller.signal });
        if (response.status === 404 || (response.ok && !response.headers.get('content-type')?.includes('application/json'))) {
          if (initial.error) throw new Error(initial.error);
          if (!cancelled) setReady(true);
          return;
        }
        if (!response.ok) throw new Error('Could not load the saved workspace. Your browser copy is available for export. Reload when the server is available.');
        const data = await response.json();
        if (cancelled) return;
        setDurable(Boolean(data.enabled));
        if (initial.error && !data.workspace) throw new Error(initial.error);
        if (data.workspace) {
          const loaded = data.workspace.projects.map((p: ProjectData) => importProject(p, p.id));
          setProjects(loaded);
          setActiveProjectId(data.workspace.activeProjectId);
          revision.current = data.workspace.revision;
          setSaveError('');
        }
        setReady(true);
      } catch (error: any) {
        if (!cancelled) setSaveError(error.message || 'Could not load workspace. Reload to retry.');
      } finally { clearTimeout(timer); }
    })();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (conflict.current) { setAutoSaveStatus('dirty'); return; }
    setAutoSaveStatus('saving');
    const currentGeneration = ++generation.current;
    const timer = setTimeout(() => {
      const snapshot = { projects, activeProjectId };
      let localError = '';
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
        localStorage.setItem(ACTIVE_KEY, activeProjectId);
      } catch { localError = 'Browser backup is full or unavailable. Export a backup to protect your work.'; }
      if (!durable) {
        setSaveError(localError);
        setAutoSaveStatus(localError ? 'dirty' : 'saved');
        return;
      }
      queue.current = queue.current.catch(() => {}).then(async () => {
        if (conflict.current) return;
        try {
          const response = await fetch('/api/workspace', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...snapshot, revision: revision.current }),
            signal: AbortSignal.timeout(15_000),
          });
          const data = await response.json();
          if (!response.ok) {
            if (response.status === 409) conflict.current = true;
            throw new Error(data.error || 'Server save failed. Your browser backup is retained.');
          }
          revision.current = data.revision;
          if (currentGeneration === generation.current) {
            setAutoSaveStatus('saved');
            setSaveError(localError);
          }
        } catch (error: any) {
          setAutoSaveStatus('dirty');
          setSaveError(error.message || 'Server save failed. Export a backup and retry.');
        }
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [projects, activeProjectId, ready, durable, retry]);

  // Flush the browser backup when navigating away before the debounce finishes.
  useEffect(() => {
    const flush = () => {
      if (!ready) return;
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(latest.current.projects));
        localStorage.setItem(ACTIVE_KEY, latest.current.activeProjectId);
      } catch { /* Save error is surfaced by the normal save path. */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ready]);

  return { projects, setProjects, activeProjectId, setActiveProjectId, ready, durable, autoSaveStatus, saveError, retrySave: () => setRetry((n) => n + 1) };
}

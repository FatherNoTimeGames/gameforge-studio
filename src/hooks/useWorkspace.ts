import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectData } from '../types';
import { importProject } from '../utils/projectData';
import { applyChanges, changedFields, keepPendingEdits, validChange } from '../../shared/workspaceSync.ts';
import { accountFetch, setWorkspaceAccount } from '../services/workspaceSession';

const PROJECTS_KEY = 'gameforge_multi_projects_v4';
const ACTIVE_KEY = 'gameforge_active_project_id_v4';
type SaveStatus = 'saved' | 'saving' | 'dirty';
function getStored(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function loadLocal(defaultProject: ProjectData, keys = { projects: PROJECTS_KEY, active: ACTIVE_KEY }) {
  try {
    const parsed = JSON.parse(getStored(keys.projects) || 'null');
    if (Array.isArray(parsed) && parsed.length) {
      const projects = parsed.map((p) => importProject(p, p.id));
      const active = getStored(keys.active);
      return { projects, activeProjectId: projects.some((p) => p.id === active) ? active! : projects[0].id, error: '' };
    }
  } catch { return { projects: [defaultProject], activeProjectId: defaultProject.id, error: 'The browser workspace could not be loaded. Export or restore a backup before editing.' }; }
  return { projects: [defaultProject], activeProjectId: defaultProject.id, error: '' };
}
const normalize = (projects: ProjectData[]) => projects.map((p) => importProject(p, p.id));

export function useWorkspace(defaultProject: ProjectData, accountStorage = false) {
  const [initial] = useState(() => accountStorage ? { projects: [defaultProject], activeProjectId: defaultProject.id, error: '' } : loadLocal(defaultProject));
  const [projects, rawSetProjects] = useState(initial.projects);
  const [activeProjectId, rawSetActive] = useState(initial.activeProjectId);
  const [ready, setReady] = useState(false);
  const [durable, setDurable] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState(initial.error);
  const latest = useRef({ projects: initial.projects, activeProjectId: initial.activeProjectId });
  const acknowledged = useRef<ProjectData[]>([]);
  const revision = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const initialized = useRef(false);
  const cloud = useRef(false);
  const mergeMode = useRef(false);
  const backupError = useRef('');
  const storageKeys = useRef({ projects: PROJECTS_KEY, active: ACTIVE_KEY });
  const methods = useRef<{ save: () => Promise<void>; refresh: () => Promise<void> }>(null);

  // Update the ref synchronously: edits made while a request is in flight must
  // survive its eventual response, even before React commits another render.
  const setProjects = useCallback((action: ProjectData[] | ((previous: ProjectData[]) => ProjectData[])) => {
    const next = typeof action === 'function' ? action(latest.current.projects) : action;
    latest.current.projects = next;
    if (mounted.current) rawSetProjects(next);
  }, []);
  const setActiveProjectId = useCallback((action: string | ((previous: string) => string)) => {
    const next = typeof action === 'function' ? action(latest.current.activeProjectId) : action;
    latest.current.activeProjectId = next;
    if (mounted.current) rawSetActive(next);
  }, []);
  const backup = useCallback(() => {
    if (!initialized.current) return;
    try {
      localStorage.setItem(storageKeys.current.projects, JSON.stringify(latest.current.projects));
      localStorage.setItem(storageKeys.current.active, latest.current.activeProjectId);
      if (cloud.current) {
        const pending = changedFields(acknowledged.current, latest.current.projects);
        const key = `${storageKeys.current.projects}_pending`;
        if (pending) localStorage.setItem(key, JSON.stringify(pending)); else localStorage.removeItem(key);
      }
      backupError.current = '';
    } catch { backupError.current = 'Browser backup is full or unavailable. Export a backup to protect unsent edits.'; }
  }, []);
  const accept = useCallback((record: any, submitted = acknowledged.current) => {
    const serverProjects = normalize(record.projects);
    const next = keepPendingEdits(serverProjects, submitted, latest.current.projects);
    acknowledged.current = serverProjects;
    revision.current = record.revision;
    setProjects(next);
    // Navigating between projects is local to each device.
    if (!next.some((p: ProjectData) => p.id === latest.current.activeProjectId)) setActiveProjectId(next[0].id);
    backup();
  }, [setProjects, setActiveProjectId, backup]);

  const save = useCallback(async () => {
    if (!initialized.current || busy.current) return;
    backup();
    const submitted = latest.current.projects;
    const changes = changedFields(acknowledged.current, submitted);
    if (!cloud.current || !changes) {
      if (mounted.current) { setAutoSaveStatus(backupError.current ? 'dirty' : 'saved'); setSaveError(backupError.current); }
      return;
    }
    busy.current = true;
    if (mounted.current) setAutoSaveStatus('saving');
    let succeeded = false;
    try {
      const payload = mergeMode.current ? { changes, activeProjectId: latest.current.activeProjectId }
        : { projects: submitted, activeProjectId: latest.current.activeProjectId, revision: revision.current };
      const body = JSON.stringify(payload);
      const response = await accountFetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
        keepalive: new TextEncoder().encode(body).length < 60_000, signal: AbortSignal.timeout(15_000) });
      const data = await response.json();
      if (response.status === 401) { initialized.current = false; if (mounted.current) setReady(false); }
      if (!response.ok) throw new Error(data.error || 'Cloud save failed. Pending edits will retry automatically.');
      accept(data.projects ? data : { ...payload, projects: submitted, revision: data.revision }, submitted);
      succeeded = true;
      if (mounted.current) { setAutoSaveStatus(changedFields(acknowledged.current, latest.current.projects) ? 'saving' : 'saved'); setSaveError(backupError.current); }
    } catch (error: any) {
      if (mounted.current) { setAutoSaveStatus('dirty'); setSaveError(error.message || 'Cloud save failed. Pending edits will retry automatically.'); }
    } finally { busy.current = false; }
    if (succeeded && changedFields(acknowledged.current, latest.current.projects)) void methods.current?.save();
  }, [accept, backup]);
  const refresh = useCallback(async () => {
    if (!initialized.current || !cloud.current || busy.current) return;
    busy.current = true;
    try {
      const response = await accountFetch(`/api/workspace?revision=${revision.current}`, { signal: AbortSignal.timeout(15_000) });
      if (response.status === 401) {
        backup(); initialized.current = false; if (mounted.current) setReady(false);
        throw new Error('Your sign-in session changed or expired. Reload GameForge to continue. Pending edits are kept in the original account backup.');
      }
      if (!response.ok) throw new Error('Could not refresh cloud updates. Your pending edits are kept and will retry.');
      const data = await response.json();
      if (!data.unchanged && data.workspace && data.workspace.revision !== revision.current) accept(data.workspace);
      if (mounted.current) setSaveError(backupError.current);
    } catch (error: any) { if (mounted.current) setSaveError(error.message); }
    finally { busy.current = false; }
    if (changedFields(acknowledged.current, latest.current.projects)) void methods.current?.save();
  }, [accept, backup]);
  methods.current = { save, refresh };

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    (async () => {
      try {
        const response = await fetch('/api/workspace', { signal: controller.signal });
        if (response.status === 404 || (response.ok && !response.headers.get('content-type')?.includes('application/json'))) {
          if (accountStorage) throw new Error('GameForge cloud storage is unavailable. Reload before editing.');
          if (initial.error) throw new Error(initial.error);
          if (!cancelled) { initialized.current = true; setReady(true); }
          return;
        }
        if (!response.ok) throw new Error('Could not load your saved workspace. Reload to retry.');
        const data = await response.json();
        if (cancelled) return;
        if (accountStorage) {
          if (typeof data.browserStorageKey !== 'string' || !data.enabled) throw new Error('Your private workspace could not be identified. Sign in again.');
          const owner = encodeURIComponent(data.browserStorageKey);
          setWorkspaceAccount(data.browserStorageKey);
          storageKeys.current = { projects: `${PROJECTS_KEY}_${owner}`, active: `${ACTIVE_KEY}_${owner}` };
        }
        cloud.current = Boolean(data.enabled);
        if (!accountStorage) setWorkspaceAccount(null);
        mergeMode.current = data.syncMode === 'merge';
        setDurable(cloud.current);
        if (initial.error && !data.workspace) throw new Error(initial.error);
        if (data.workspace) {
          const serverProjects = normalize(data.workspace.projects);
          let recovered = serverProjects;
          // Unsent mobile edits survive closing/reopening and are rebased onto
          // the latest cloud data, rather than replaced by an older browser copy.
          const saved = getStored(`${storageKeys.current.projects}_pending`);
          if (saved) {
            const pending = JSON.parse(saved);
            if (!validChange(pending)) throw new Error('Pending browser edits could not be read. Export your browser backup before retrying.');
            recovered = applyChanges(serverProjects, pending);
          }
          acknowledged.current = serverProjects;
          revision.current = data.workspace.revision;
          setProjects(recovered);
          const localActive = getStored(storageKeys.current.active);
          setActiveProjectId(recovered.some((p: ProjectData) => p.id === localActive) ? localActive! : recovered.some((p: ProjectData) => p.id === data.workspace.activeProjectId) ? data.workspace.activeProjectId : recovered[0].id);
        } else if (accountStorage) {
          const local = loadLocal(defaultProject, storageKeys.current);
          if (local.error) throw new Error(local.error);
          setProjects(local.projects); setActiveProjectId(local.activeProjectId);
        }
        initialized.current = true;
        setSaveError(''); setReady(true);
      } catch (error: any) { if (!cancelled) setSaveError(error.message || 'Could not load workspace. Reload to retry.'); }
      finally { clearTimeout(timer); }
    })();
    return () => { cancelled = true; mounted.current = false; clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    backup();
    const pending = durable && changedFields(acknowledged.current, latest.current.projects);
    setAutoSaveStatus(pending ? 'saving' : backupError.current ? 'dirty' : 'saved');
    const timer = setTimeout(() => { void methods.current?.save(); }, 450);
    return () => clearTimeout(timer);
  }, [projects, activeProjectId, ready, durable, backup]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => { backup(); void methods.current?.save(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); else void methods.current?.refresh(); };
    const refreshNow = () => { void methods.current?.refresh(); };
    const interval = setInterval(() => { if (document.visibilityState !== 'hidden') refreshNow(); }, 2000);
    window.addEventListener('pagehide', flush);
    window.addEventListener('focus', refreshNow);
    window.addEventListener('online', refreshNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', flush); window.removeEventListener('focus', refreshNow); window.removeEventListener('online', refreshNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ready, backup]);

  return { projects, setProjects, activeProjectId, setActiveProjectId, ready, durable, autoSaveStatus, saveError,
    retrySave: () => { void methods.current?.refresh().then(() => methods.current?.save()); } };
}

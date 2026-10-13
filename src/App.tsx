import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onBrowserChromeChange } from './utils/browserChrome';
import { Header } from './components/Header';
import { WikiPanel } from './components/WikiPanel';
import { AssistantPanel } from './components/AssistantPanel';
import { CompatibilityModal } from './components/CompatibilityModal';
import { ExportModal } from './components/ExportModal';
import { SnapshotsModal } from './components/SnapshotsModal';
import { PageHistoryModal } from './components/PageHistoryModal';
import { CondenseModal } from './components/CondenseModal';
import { SectionApplyModal } from './components/SectionApplyModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import {
  ActionType,
  AutoVerifyProgress,
  ChatMessage,
  LeftTab,
  PageHistoryItem,
  ProjectData,
  RightTab,
  Snapshot,
  SourceItem,
  TargetEngineId,
  VerificationVerdict,
  WikiPage,
  WikiViewMode
} from './types';
import { INITIAL_WIKI_PAGES, TARGET_ENGINES } from './data/initialData';
import {
  autoFixPageFromSources,
  autoNameProject,
  buildWikiFromSources,
  condenseWikiPage,
  generateIndexForPage,
  requestAssistantResponse,
  verifyWikiAgainstSources
} from './services/aiService';

const STORAGE_PROJECTS_KEY = 'gameforge_multi_projects_v4';
const STORAGE_ACTIVE_ID_KEY = 'gameforge_active_project_id_v4';

function createDefaultProject(id: string = 'proj-default', name: string = 'Project ChronoStrike'): ProjectData {
  return {
    id,
    name,
    manualName: false,
    updatedAt: Date.now(),
    targetEngineId: 'godot4',
    pages: INITIAL_WIKI_PAGES,
    sources: [],
    conceptNotepad:
      '# Concept Brainstorm\n- Verify if Phase Dodge 220ms i-frames feel generous on 60fps.\n- Idea: Boss enrage state doubles resonance recovery delay.\n- Strength scaling: Should strength increase knockback distance or freeze-frame duration?',
    teacherNotepad:
      '# Code Scratchpad (Godot 4)\n- move_and_slide() in Godot 4 uses internal velocity property (no arguments).\n- CharacterBody2D collision layer: Layer 1 = Player, Layer 4 = Ethereal.\n- Connect signals using: stamina_changed.connect(_on_stamina_changed)',
    chatConcept: [],
    chatTeacher: [],
    snapshots: []
  };
}

export default function App() {
  // Multi-Project State
  const [projects, setProjects] = useState<ProjectData[]>(() => [createDefaultProject()]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-default');

  // UI Views (2-Pane Architecture with 3 Tabs each)
  const [leftTab, setLeftTab] = useState<LeftTab>('wiki');
  const [wikiViewMode, setWikiViewMode] = useState<WikiViewMode>('split');
  const [rightTab, setRightTab] = useState<RightTab>('concept');
  const [activePageId, setActivePageId] = useState<string>(INITIAL_WIKI_PAGES[0].id);

  // Scalable Split Pane Resizing
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gameforge_split_ratio_v1');
      if (saved) {
        const num = parseFloat(saved);
        if (!isNaN(num) && num >= 20 && num <= 80) return num;
      }
    } catch {}
    return 52;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  // Detect browser chrome (address bar / tab strip) and window size so the app
  // always fits exactly in the visible viewport. Only inner panels scroll;
  // header, tabs, dropdowns, chat input and its buttons stay pinned.
  const [appHeightPx, setAppHeightPx] = useState<number | null>(null);

  useEffect(() => {
    // Debounced so the mobile address bar collapsing/expanding during a scroll
    // gesture doesn't re-render the whole app on every pixel change.
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Use the *visual* viewport height: it excludes the address bar when
        // shown, so our layout never renders controls underneath it. This is
        // what fixes top buttons being unusable/clipped in a regular web page.
        const visual = window.visualViewport?.height ?? window.innerHeight;
        setAppHeightPx(Math.round(visual));

        // Expose as a CSS variable for the document/body sizing in index.css.
        document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(visual)}px`);
      });
    };
    const unsubscribe = onBrowserChromeChange(update);
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPercent = (e.clientX / window.innerWidth) * 100;
      const clamped = Math.min(78, Math.max(22, newPercent));
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      try {
        localStorage.setItem('gameforge_split_ratio_v1', String(splitPercent));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter, splitPercent]);

  // Status & Loaders
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isBuildingSources, setIsBuildingSources] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [isCondensing, setIsCondensing] = useState<boolean>(false);

  // Self-Healing Auto-Verify Loop state
  const [autoVerifyProgress, setAutoVerifyProgress] = useState<AutoVerifyProgress>({
    isRunning: false,
    currentPass: 1,
    maxPasses: 4,
    statusMessage: '',
    cleanPagesCount: 0,
    totalPagesCount: 0,
    issuesResolvedTotal: 0
  });
  const autoVerifyStopRef = useRef(false);

  // Modals & Popups
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSnapshotsModalOpen, setIsSnapshotsModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [condenseModalData, setCondenseModalData] = useState<{ open: boolean; text: string }>({
    open: false,
    text: ''
  });
  const [sectionApplyData, setSectionApplyData] = useState<{ open: boolean; rawText: string }>({
    open: false,
    rawText: ''
  });
  const [verdicts, setVerdicts] = useState<VerificationVerdict[]>([]);

  // Current active project
  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const currentEngine =
    TARGET_ENGINES.find((e) => e.id === currentProject.targetEngineId) || TARGET_ENGINES[0];
  const activeWikiPage =
    currentProject.pages.find((p) => p.id === activePageId) || currentProject.pages[0] || null;

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(STORAGE_PROJECTS_KEY);
      const storedActiveId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);

      if (storedProjects) {
        const parsed = JSON.parse(storedProjects);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Backward compatibility check for separate scratchpads
          const migrated = parsed.map((p: any) => ({
            ...p,
            conceptNotepad: p.conceptNotepad || p.notepad || '# Concept Notes\n',
            teacherNotepad: p.teacherNotepad || '# Code Notes\n'
          }));
          setProjects(migrated);
          if (storedActiveId && migrated.some((p: any) => p.id === storedActiveId)) {
            setActiveProjectId(storedActiveId);
          } else {
            setActiveProjectId(migrated[0].id);
          }
          if (migrated[0].pages?.length > 0) {
            setActivePageId(migrated[0].pages[0].id);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load projects from localStorage:', e);
    }
  }, []);

  // Debounced auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSave = useCallback(() => {
    setAutoSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
        localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeProjectId);
        setAutoSaveStatus('saved');
      } catch (e) {
        console.error('LocalStorage write failed:', e);
      }
    }, 450);
  }, [projects, activeProjectId]);

  useEffect(() => {
    triggerSave();
  }, [projects, activeProjectId, triggerSave]);

  // Project Mutators
  const updateCurrentProject = useCallback(
    (updater: (prev: ProjectData) => ProjectData) => {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id === activeProjectId) {
            const updated = updater(proj);
            return { ...updated, updatedAt: Date.now() };
          }
          return proj;
        })
      );
    },
    [activeProjectId]
  );

  const handleNewProject = () => {
    const newId = `proj-${Date.now()}`;
    const newProj = createDefaultProject(newId, 'New Game Project');
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newId);
    setActivePageId(newProj.pages[0].id);
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    setActiveProjectId(remaining[0].id);
    if (remaining[0].pages.length > 0) {
      setActivePageId(remaining[0].pages[0].id);
    }
  };

  const handleRenameProject = (name: string) => {
    updateCurrentProject((p) => ({ ...p, name, manualName: true }));
  };

  // Wiki Page Mutators (Supports Parent ID for Subpages)
  const handleCreatePage = (parentId?: string | null) => {
    const newId = `page-${Date.now()}`;
    const parent = parentId ? currentProject.pages.find((p) => p.id === parentId) : null;
    const newPage: WikiPage = {
      id: newId,
      title: parent ? `${parent.title} - Subpage` : 'New Design Specification',
      parentId: parentId || null,
      content: `# ${parent ? `${parent.title} - Subpage` : 'New Design Specification'}\n\n## 1. Overview\nDocument rules, sub-mechanics, or attributes here.\n\n## 2. Technical Details\n- Parameters:\n- Signals / Events:\n`,
      category: parent ? parent.category : 'Mechanics',
      tags: parent ? ['Subpage'] : ['WIP'],
      lastModified: Date.now(),
      history: []
    };
    updateCurrentProject((p) => ({
      ...p,
      pages: [...p.pages, newPage]
    }));
    setActivePageId(newId);
    setLeftTab('edit');
  };

  const handleDeletePage = (id: string) => {
    if (currentProject.pages.length <= 1) return;
    if (confirm('Are you sure you want to delete this wiki page? Subpages under it will become top-level.')) {
      const remaining = currentProject.pages
        .filter((p) => p.id !== id)
        .map((p) => (p.parentId === id ? { ...p, parentId: null } : p));
      updateCurrentProject((p) => ({ ...p, pages: remaining }));
      setActivePageId(remaining[0].id);
    }
  };

  const handleUpdateTitle = (id: string, title: string) => {
    updateCurrentProject((proj) => ({
      ...proj,
      pages: proj.pages.map((p) => (p.id === id ? { ...p, title, lastModified: Date.now() } : p))
    }));
  };

  const handleUpdateContent = (id: string, content: string) => {
    updateCurrentProject((proj) => ({
      ...proj,
      pages: proj.pages.map((p) => {
        if (p.id === id) {
          const history = Array.isArray(p.history) ? [...p.history] : [];
          if (p.content !== content) {
            history.unshift({ content: p.content, title: p.title, at: Date.now() });
          }
          return {
            ...p,
            content,
            history: history.slice(0, 5),
            lastModified: Date.now()
          };
        }
        return p;
      })
    }));
  };

  const handleUpdateCategory = (id: string, category: WikiPage['category']) => {
    updateCurrentProject((proj) => ({
      ...proj,
      pages: proj.pages.map((p) => (p.id === id ? { ...p, category, lastModified: Date.now() } : p))
    }));
  };

  const handleUpdateParentId = (id: string, parentId: string | null) => {
    updateCurrentProject((proj) => ({
      ...proj,
      pages: proj.pages.map((p) => (p.id === id ? { ...p, parentId, lastModified: Date.now() } : p))
    }));
  };

  const handleRestoreHistory = (item: PageHistoryItem) => {
    if (!activeWikiPage) return;
    handleUpdateContent(activeWikiPage.id, item.content);
  };

  // Sources Mutators
  const handleAddSource = (source: Omit<SourceItem, 'id' | 'addedAt'>) => {
    const newSource: SourceItem = {
      ...source,
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      addedAt: Date.now()
    };
    updateCurrentProject((p) => ({
      ...p,
      sources: [...p.sources, newSource]
    }));
  };

  const handleRemoveSource = (id: string) => {
    updateCurrentProject((p) => ({
      ...p,
      sources: p.sources.filter((s) => s.id !== id)
    }));
  };

  const handleClearSources = () => {
    updateCurrentProject((p) => ({ ...p, sources: [] }));
  };

  // Build Wiki from Sources Pipeline (Handles Parent/Subpage hierarchy)
  const handleBuildWiki = async (replaceMode: boolean) => {
    if (currentProject.sources.length === 0) return;
    setIsBuildingSources(true);

    try {
      const generatedPages = await buildWikiFromSources(
        currentProject.sources,
        currentProject.pages
      );

      updateCurrentProject((proj) => {
        let updatedPages = replaceMode ? [] : [...proj.pages];

        // First pass: add parent pages
        for (const gen of generatedPages) {
          const existingIdx = updatedPages.findIndex(
            (p) => p.title.toLowerCase() === gen.title.toLowerCase()
          );
          if (existingIdx >= 0) {
            const old = updatedPages[existingIdx];
            const history = Array.isArray(old.history) ? [...old.history] : [];
            history.unshift({ content: old.content, title: old.title, at: Date.now() });
            updatedPages[existingIdx] = {
              ...old,
              content: gen.content,
              history: history.slice(0, 5),
              lastModified: Date.now()
            };
          } else {
            updatedPages.push({
              id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: gen.title,
              content: gen.content,
              parentId: null,
              category: 'Mechanics',
              lastModified: Date.now(),
              history: []
            });
          }
        }

        // Second pass: link subpages to their parent pages
        for (const gen of generatedPages) {
          if (gen.parentTitle) {
            const parent = updatedPages.find(
              (p) => p.title.toLowerCase() === gen.parentTitle?.toLowerCase()
            );
            const child = updatedPages.find(
              (p) => p.title.toLowerCase() === gen.title.toLowerCase()
            );
            if (parent && child && parent.id !== child.id) {
              child.parentId = parent.id;
            }
          }
        }

        return { ...proj, pages: updatedPages };
      });

      setLeftTab('wiki');

      if (!currentProject.manualName && currentProject.name === 'New Game Project') {
        const home = generatedPages.find((p) => p.title.toLowerCase() === 'home');
        if (home) {
          autoNameProject(home.content, generatedPages.map((p) => p.title)).then((newName) => {
            if (newName) updateCurrentProject((p) => ({ ...p, name: newName }));
          });
        }
      }
    } catch (e: any) {
      alert(`Build Wiki failed: ${e.message}`);
    } finally {
      setIsBuildingSources(false);
    }
  };

  // Verify Wiki against Sources (Single Pass)
  const handleVerifyWiki = async () => {
    if (currentProject.sources.length === 0 || currentProject.pages.length === 0) return;
    setIsVerifying(true);
    setVerdicts([]);

    try {
      const results: VerificationVerdict[] = [];
      for (const p of currentProject.pages) {
        const verdict = await verifyWikiAgainstSources(p, currentProject.sources);
        results.push(verdict);
      }
      setVerdicts(results);
    } catch (e: any) {
      alert(`Verification failed: ${e.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Self-Healing Auto-Verify Loop
  const handleAutoVerifyAndFixLoop = async () => {
    if (currentProject.sources.length === 0 || currentProject.pages.length === 0) return;

    autoVerifyStopRef.current = false;
    const MAX_PASSES = 4;
    let issuesResolved = 0;

    setAutoVerifyProgress({
      isRunning: true,
      currentPass: 1,
      maxPasses: MAX_PASSES,
      statusMessage: 'Starting Pass 1: Checking all pages against source documents...',
      cleanPagesCount: 0,
      totalPagesCount: currentProject.pages.length,
      issuesResolvedTotal: 0
    });

    try {
      for (let pass = 1; pass <= MAX_PASSES; pass++) {
        if (autoVerifyStopRef.current) break;

        setAutoVerifyProgress((prev) => ({
          ...prev,
          currentPass: pass,
          statusMessage: `Pass ${pass}/${MAX_PASSES}: Fact-checking ${currentProject.pages.length} pages/subpages...`
        }));

        const results: VerificationVerdict[] = [];
        for (const p of currentProject.pages) {
          if (autoVerifyStopRef.current) break;
          const verdict = await verifyWikiAgainstSources(p, currentProject.sources);
          results.push(verdict);
        }

        if (autoVerifyStopRef.current) break;

        setVerdicts(results);
        const flawed = results.filter((r) => r.status !== 'ok');
        const cleanCount = results.length - flawed.length;

        setAutoVerifyProgress((prev) => ({
          ...prev,
          cleanPagesCount: cleanCount,
          totalPagesCount: results.length
        }));

        if (flawed.length === 0) {
          setAutoVerifyProgress((prev) => ({
            ...prev,
            statusMessage: `Success! All ${results.length} pages are 100% factual and verified! 🎉`,
            isRunning: false
          }));
          return;
        }

        if (pass === MAX_PASSES) {
          setAutoVerifyProgress((prev) => ({
            ...prev,
            statusMessage: `Finished ${MAX_PASSES} passes. ${cleanCount}/${results.length} clean (${flawed.length} remaining).`,
            isRunning: false
          }));
          return;
        }

        setAutoVerifyProgress((prev) => ({
          ...prev,
          statusMessage: `Pass ${pass}/${MAX_PASSES}: Found ${flawed.length} flawed pages. Auto-repairing with the AI...`
        }));

        for (const flaw of flawed) {
          if (autoVerifyStopRef.current) break;
          const targetPage = currentProject.pages.find((p) => p.title === flaw.title);
          if (!targetPage) continue;

          try {
            const fixedContent = await autoFixPageFromSources(
              targetPage,
              flaw,
              currentProject.sources
            );

            handleUpdateContent(targetPage.id, fixedContent);
            issuesResolved += flaw.issues.length + flaw.unsupported.length;

            setAutoVerifyProgress((prev) => ({
              ...prev,
              issuesResolvedTotal: issuesResolved,
              statusMessage: `Pass ${pass}/${MAX_PASSES}: Repaired "${flaw.title}". Re-verifying...`
            }));
          } catch (err) {
            console.warn(`Failed to fix ${flaw.title}:`, err);
          }
        }
      }
    } catch (err: any) {
      alert(`Auto-Verify Loop error: ${err.message}`);
    } finally {
      setAutoVerifyProgress((prev) => ({ ...prev, isRunning: false }));
    }
  };

  const handleStopAutoVerify = () => {
    autoVerifyStopRef.current = true;
    setAutoVerifyProgress((prev) => ({
      ...prev,
      isRunning: false,
      statusMessage: 'Auto-Verify loop paused by user.'
    }));
  };

  const handleApplyVerificationFix = async (verdict: VerificationVerdict) => {
    const targetPage = currentProject.pages.find((p) => p.title === verdict.title);
    if (!targetPage) return;

    try {
      const fixPrompt = `Please fix this wiki page according to this verification report:
Issues: ${verdict.issues.join('; ')}
Unsupported claims: ${verdict.unsupported.join('; ')}
Missing details: ${verdict.missing.join('; ')}
Keep the exact same markdown structure, headings, and tables.`;

      const response = await requestAssistantResponse({
        actionType: 'wiki_edit',
        prompt: fixPrompt,
        pages: [targetPage],
        targetEngine: currentEngine
      });

      setSectionApplyData({ open: true, rawText: response.text });
    } catch (e: any) {
      alert(`Fix generation failed: ${e.message}`);
    }
  };

  const handleGenerateIndex = async () => {
    setIsIndexing(true);
    try {
      for (const p of currentProject.pages) {
        if (!p.summary) {
          const res = await generateIndexForPage(p);
          updateCurrentProject((proj) => ({
            ...proj,
            pages: proj.pages.map((item) =>
              item.id === p.id ? { ...item, summary: res.summary, keywords: res.keywords } : item
            )
          }));
        }
      }
    } catch (e) {
      console.warn('Indexing error:', e);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleCondensePage = async () => {
    if (!activeWikiPage) return;
    setIsCondensing(true);
    try {
      const condensed = await condenseWikiPage(activeWikiPage);
      setCondenseModalData({ open: true, text: condensed });
    } catch (e: any) {
      alert(`Condense failed: ${e.message}`);
    } finally {
      setIsCondensing(false);
    }
  };

  const handleApplySectionPlan = (
    plans: { pageId: string; title: string; newContent: string; isNew: boolean }[]
  ) => {
    updateCurrentProject((proj) => {
      let pages = [...proj.pages];
      for (const pl of plans) {
        if (pl.isNew) {
          pages.push({
            id: pl.pageId,
            title: pl.title,
            content: pl.newContent,
            category: 'Mechanics',
            parentId: activeWikiPage?.id || null,
            lastModified: Date.now(),
            history: []
          });
        } else {
          pages = pages.map((p) => {
            if (p.id === pl.pageId) {
              const history = Array.isArray(p.history) ? [...p.history] : [];
              history.unshift({ content: p.content, title: p.title, at: Date.now() });
              return {
                ...p,
                content: pl.newContent,
                history: history.slice(0, 5),
                lastModified: Date.now()
              };
            }
            return p;
          });
        }
      }
      return { ...proj, pages };
    });
  };

  // Chat sender
  const handleSendMessage = async (
    actionType: ActionType,
    prompt: string,
    image?: { base64: string; mimeType: string; name: string }
  ) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: prompt,
      actionType,
      timestamp: Date.now(),
      engineTarget: currentEngine.name,
      imageName: image?.name
    };

    updateCurrentProject((p) => ({
      ...p,
      chatConcept: rightTab === 'concept' ? [...p.chatConcept, userMsg] : p.chatConcept,
      chatTeacher: rightTab === 'teacher' ? [...p.chatTeacher, userMsg] : p.chatTeacher
    }));

    setIsAiLoading(true);

    try {
      const activeChatHistory =
        rightTab === 'concept' ? currentProject.chatConcept : currentProject.chatTeacher;

      const result = await requestAssistantResponse({
        actionType,
        prompt,
        pages: currentProject.pages,
        targetEngine: currentEngine,
        notepadContent:
          rightTab === 'concept' ? currentProject.conceptNotepad : currentProject.teacherNotepad,
        chatHistory: activeChatHistory,
        imageBase64: image?.base64,
        imageMimeType: image?.mimeType
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: result.text,
        actionType,
        timestamp: Date.now(),
        modelUsed: result.modelUsed
      };

      updateCurrentProject((p) => ({
        ...p,
        chatConcept: rightTab === 'concept' ? [...p.chatConcept, assistantMsg] : p.chatConcept,
        chatTeacher: rightTab === 'teacher' ? [...p.chatTeacher, assistantMsg] : p.chatTeacher
      }));
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: `**Assistant Request Failed:** ${err.message || 'Check connection or model server availability.'}`,
        actionType,
        timestamp: Date.now()
      };

      updateCurrentProject((p) => ({
        ...p,
        chatConcept: rightTab === 'concept' ? [...p.chatConcept, errorMsg] : p.chatConcept,
        chatTeacher: rightTab === 'teacher' ? [...p.chatTeacher, errorMsg] : p.chatTeacher
      }));
    } finally {
      setIsAiLoading(false);
    }
  };

  // Snapshots Handlers
  const handleCreateSnapshot = (name: string) => {
    const snap: Snapshot = {
      id: `snap-${Date.now()}`,
      name,
      timestamp: Date.now(),
      pageCount: currentProject.pages.length,
      state: {
        projectName: currentProject.name,
        targetEngineId: currentProject.targetEngineId,
        pages: JSON.parse(JSON.stringify(currentProject.pages)),
        conceptNotepad: currentProject.conceptNotepad,
        teacherNotepad: currentProject.teacherNotepad,
        sources: JSON.parse(JSON.stringify(currentProject.sources))
      }
    };
    updateCurrentProject((p) => ({
      ...p,
      snapshots: [snap, ...p.snapshots]
    }));
  };

  const handleRestoreSnapshot = (snap: Snapshot) => {
    updateCurrentProject((p) => ({
      ...p,
      name: snap.state.projectName,
      targetEngineId: snap.state.targetEngineId,
      pages: snap.state.pages,
      conceptNotepad: snap.state.conceptNotepad || '',
      teacherNotepad: snap.state.teacherNotepad || '',
      sources: snap.state.sources || []
    }));
    if (snap.state.pages.length > 0) {
      setActivePageId(snap.state.pages[0].id);
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    updateCurrentProject((p) => ({
      ...p,
      snapshots: p.snapshots.filter((s) => s.id !== id)
    }));
  };

  const handleImportProject = (importedData: any) => {
    const newId = `proj-${Date.now()}`;
    const newProj: ProjectData = {
      id: newId,
      name: importedData.projectName || importedData.name || 'Imported Project',
      manualName: true,
      updatedAt: Date.now(),
      targetEngineId: importedData.targetEngineId || 'godot4',
      pages: Array.isArray(importedData.pages) ? importedData.pages : INITIAL_WIKI_PAGES,
      sources: Array.isArray(importedData.sources) ? importedData.sources : [],
      conceptNotepad: importedData.conceptNotepad || importedData.notepad || '',
      teacherNotepad: importedData.teacherNotepad || '',
      chatConcept: [],
      chatTeacher: [],
      snapshots: []
    };
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newId);
    if (newProj.pages.length > 0) {
      setActivePageId(newProj.pages[0].id);
    }
  };

  return (
    <div
      style={appHeightPx ? { height: `${appHeightPx}px` } : undefined}
      className="h-[100dvh] w-screen flex flex-col bg-[#0b0d13] text-zinc-100 font-sans overflow-hidden"
    >
      {/* Header */}
      <Header
        currentProject={currentProject}
        allProjects={projects}
        onSelectProject={setActiveProjectId}
        onNewProject={handleNewProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        targetEngineId={currentProject.targetEngineId}
        onTargetEngineChange={(id) => updateCurrentProject((p) => ({ ...p, targetEngineId: id }))}
        autoSaveStatus={autoSaveStatus}
        onOpenCompatibilityModal={() => setIsCompatibilityModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenSnapshotsModal={() => setIsSnapshotsModalOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* Exactly Two Scalable Split Windows with Draggable Divider */}
      <main
        className={`flex-1 flex overflow-hidden ${
          isDraggingSplitter ? 'select-none cursor-col-resize' : ''
        }`}
      >
        {/* PANE 1 (LEFT): WIKI / EDIT / BUILDER WITH 3 TABS AT TOP */}
        <section
          style={{ width: `${splitPercent}%` }}
          className="border-r border-[#1f2638] flex flex-col overflow-hidden min-w-[280px]"
        >
          <WikiPanel
            pages={currentProject.pages}
            activePageId={activePageId}
            activeLeftTab={leftTab}
            onSetLeftTab={setLeftTab}
            viewMode={wikiViewMode}
            onSetViewMode={setWikiViewMode}
            onSelectPage={setActivePageId}
            onCreatePage={handleCreatePage}
            onDeletePage={handleDeletePage}
            onUpdateTitle={handleUpdateTitle}
            onUpdateContent={handleUpdateContent}
            onUpdateCategory={handleUpdateCategory}
            onUpdateParentId={handleUpdateParentId}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onGenerateIndex={handleGenerateIndex}
            onCondensePage={handleCondensePage}
            isIndexing={isIndexing}
            isCondensing={isCondensing}
            sources={currentProject.sources}
            onAddSource={handleAddSource}
            onRemoveSource={handleRemoveSource}
            onClearSources={handleClearSources}
            onBuildWiki={handleBuildWiki}
            onVerifyWiki={handleVerifyWiki}
            onAutoVerifyAndFixLoop={handleAutoVerifyAndFixLoop}
            onStopAutoVerify={handleStopAutoVerify}
            autoVerifyProgress={autoVerifyProgress}
            onApplyVerificationFix={handleApplyVerificationFix}
            isBuilding={isBuildingSources}
            isVerifying={isVerifying}
            verdicts={verdicts}
            onClearVerdicts={() => setVerdicts([])}
          />
        </section>

        {/* DRAGGABLE MIDDLE DIVIDER LINE */}
        <div
          onMouseDown={handleMouseDownSplitter}
          className={`w-1.5 hover:w-2 transition-all cursor-col-resize select-none shrink-0 relative group z-20 flex items-center justify-center ${
            isDraggingSplitter
              ? 'w-2 bg-indigo-500'
              : 'bg-[#1f2638] hover:bg-indigo-500/80 active:bg-indigo-600'
          }`}
          title="Click and drag to resize panels"
        >
          <div
            className={`h-8 w-1 rounded-full transition-colors ${
              isDraggingSplitter ? 'bg-white' : 'bg-zinc-600 group-hover:bg-white'
            }`}
          />
        </div>

        {/* PANE 2 (RIGHT): CO-DEVELOPER STUDIO WITH SEPARATE SCRATCHPADS & CLEAN CONTEXT TAB */}
        <section
          style={{ width: `${100 - splitPercent}%` }}
          className="flex flex-col overflow-hidden min-w-[280px]"
        >
          <AssistantPanel
            activeTab={rightTab}
            onTabChange={setRightTab}
            targetEngine={currentEngine}
            chatConcept={currentProject.chatConcept}
            chatTeacher={currentProject.chatTeacher}
            onSendMessage={handleSendMessage}
            onClearChat={() => {
              updateCurrentProject((p) => ({
                ...p,
                chatConcept: rightTab === 'concept' ? [] : p.chatConcept,
                chatTeacher: rightTab === 'teacher' ? [] : p.chatTeacher
              }));
            }}
            isLoading={isAiLoading}
            activeWikiPage={activeWikiPage}
            onOpenSectionApply={(text) => setSectionApplyData({ open: true, rawText: text })}
            pages={currentProject.pages}
            onSelectPage={setActivePageId}
            conceptNotepad={currentProject.conceptNotepad}
            onConceptNotepadChange={(val) =>
              updateCurrentProject((p) => ({ ...p, conceptNotepad: val }))
            }
            teacherNotepad={currentProject.teacherNotepad}
            onTeacherNotepadChange={(val) =>
              updateCurrentProject((p) => ({ ...p, teacherNotepad: val }))
            }
            onPromoteNotepadToPage={(title, content, parentId) => {
              const newId = `page-${Date.now()}`;
              const newPage: WikiPage = {
                id: newId,
                title,
                parentId: parentId || null,
                content: content.startsWith('#') ? content : `# ${title}\n\n${content}`,
                category: 'Systems',
                lastModified: Date.now(),
                history: []
              };
              updateCurrentProject((p) => ({
                ...p,
                pages: [...p.pages, newPage],
                conceptNotepad: rightTab === 'concept' ? '' : p.conceptNotepad,
                teacherNotepad: rightTab === 'teacher' ? '' : p.teacherNotepad
              }));
              setActivePageId(newId);
              setLeftTab('wiki');
            }}
          />
        </section>
      </main>

      {/* Modals */}
      <CompatibilityModal
        isOpen={isCompatibilityModalOpen}
        onClose={() => setIsCompatibilityModalOpen(false)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectName={currentProject.name}
        pages={currentProject.pages}
        notepad={`${currentProject.conceptNotepad}\n\n---\n\n${currentProject.teacherNotepad}`}
        targetEngine={currentEngine}
        activeWikiPage={activeWikiPage}
        onImportProject={handleImportProject}
      />

      <SnapshotsModal
        isOpen={isSnapshotsModalOpen}
        onClose={() => setIsSnapshotsModalOpen(false)}
        snapshots={currentProject.snapshots}
        onCreateSnapshot={handleCreateSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
      />

      <PageHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        page={activeWikiPage}
        onRestoreHistory={handleRestoreHistory}
      />

      <CondenseModal
        isOpen={condenseModalData.open}
        onClose={() => setCondenseModalData({ open: false, text: '' })}
        page={activeWikiPage}
        condensedText={condenseModalData.text}
        onApplyCondensed={(text) => {
          if (activeWikiPage) handleUpdateContent(activeWikiPage.id, text);
        }}
      />

      <SectionApplyModal
        isOpen={sectionApplyData.open}
        onClose={() => setSectionApplyData({ open: false, rawText: '' })}
        rawAssistantText={sectionApplyData.rawText}
        pages={currentProject.pages}
        onApplyPlan={handleApplySectionPlan}
      />

      <ApiKeyModal open={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </div>
  );
}

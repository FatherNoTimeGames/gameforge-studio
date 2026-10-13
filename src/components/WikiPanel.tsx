import React, { useMemo, useState } from 'react';
import { canSetPageParent } from '../utils/projectEdits';
import {
  BookMarked,
  Plus,
  Trash2,
  Edit3,
  Hash,
  Bold,
  List,
  Code2,
  Table as TableIcon,
  Clock,
  Minimize2,
  Search,
  BookOpen,
  Check,
  Copy,
  ChevronDown,
  FolderTree,
  CornerDownRight,
  Link,
  Wrench
} from 'lucide-react';
import { renderMarkdown } from '../utils/markdown';
import {
  AutoVerifyProgress,
  LeftTab,
  SourceItem,
  VerificationVerdict,
  WikiPage,
  WikiViewMode
} from '../types';
import { estimateTokens } from '../utils/tokenCounter';
import { autoLinkWikiReferences } from '../services/aiService';
import { SourceBuilderPanel } from './SourceBuilderPanel';

interface WikiPanelProps {
  pages: WikiPage[];
  activePageId: string;
  activeLeftTab: LeftTab;
  onSetLeftTab: (tab: LeftTab) => void;
  viewMode: WikiViewMode;
  onSetViewMode: (mode: WikiViewMode) => void;
  onSelectPage: (id: string) => void;
  onCreatePage: (parentId?: string | null) => void;
  onDeletePage: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onUpdateCategory: (id: string, category: WikiPage['category']) => void;
  onUpdateParentId: (id: string, parentId: string | null) => void;
  onOpenHistory: () => void;
  onGenerateIndex: () => void;
  onCondensePage: () => void;
  isIndexing: boolean;
  isCondensing: boolean;
  // Source Builder integration for Builder tab
  sources: SourceItem[];
  onAddSource: (source: Omit<SourceItem, 'id' | 'addedAt'>) => void;
  onRemoveSource: (id: string) => void;
  onClearSources: () => void;
  onBuildWiki: (replaceMode: boolean) => Promise<void>;
  onVerifyWiki: () => Promise<void>;
  onAutoVerifyAndFixLoop: () => Promise<void>;
  onStopAutoVerify: () => void;
  autoVerifyProgress: AutoVerifyProgress;
  onApplyVerificationFix: (verdict: VerificationVerdict) => Promise<void>;
  isBuilding: boolean;
  isVerifying: boolean;
  verdicts: VerificationVerdict[];
  onClearVerdicts: () => void;
}

export const WikiPanel: React.FC<WikiPanelProps> = ({
  pages,
  activePageId,
  activeLeftTab,
  onSetLeftTab,
  viewMode,
  onSetViewMode,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  onUpdateTitle,
  onUpdateContent,
  onUpdateCategory,
  onUpdateParentId,
  onOpenHistory,
  onGenerateIndex,
  onCondensePage,
  isIndexing,
  isCondensing,
  sources,
  onAddSource,
  onRemoveSource,
  onClearSources,
  onBuildWiki,
  onVerifyWiki,
  onAutoVerifyAndFixLoop,
  onStopAutoVerify,
  autoVerifyProgress,
  onApplyVerificationFix,
  isBuilding,
  isVerifying,
  verdicts,
  onClearVerdicts
}) => {
  const [isPagesDropdownOpen, setIsPagesDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [autoLinkedSuccess, setAutoLinkedSuccess] = useState(false);

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const parentPage = activePage?.parentId ? pages.find((p) => p.id === activePage.parentId) : null;
  const subpages = useMemo(() => {
    if (!activePage) return [];
    return pages.filter((p) => p.parentId === activePage.id);
  }, [pages, activePage?.id]);

  // Hierarchical groupings: Top-level pages with their subpages
  const { topLevelPages, subpagesMap } = useMemo(() => {
    const topLevel: WikiPage[] = [];
    const map = new Map<string, WikiPage[]>();

    pages.forEach((p) => {
      if (p.parentId) {
        const list = map.get(p.parentId) || [];
        list.push(p);
        map.set(p.parentId, list);
      } else {
        topLevel.push(p);
      }
    });

    return { topLevelPages: topLevel, subpagesMap: map };
  }, [pages]);

  // Normalize string for wiki title matching (handles spaces vs hyphens and casing)
  const normalizeTitle = (str: string) => {
    return str.toLowerCase().replace(/[-_]+/g, ' ').trim();
  };

  // Find page by title or slug
  const findPageByTitle = (target: string) => {
    const cleanTarget = normalizeTitle(target);
    return pages.find((p) => {
      const pClean = normalizeTitle(p.title);
      return pClean === cleanTarget || p.title.toLowerCase() === target.toLowerCase();
    });
  };

  // Render markdown with GitHub Wiki format: [[display text|Page Title]] or [[Page Title]]
  const parsedReaderHtml = useMemo(() => {
    if (!activePage) return '';
    try {
      let raw = activePage.content || '';

      // Match [[part1|part2]] or [[part1]]
      raw = raw.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, p1, p2) => {
        let targetPageTitle = p1.trim();
        let displayLabel = p1.trim();

        if (p2 !== undefined) {
          const part1 = p1.trim();
          const part2 = p2.trim();

          // GitHub Wiki Standard: [[display text|Page Title]]
          // part1 = display text, part2 = Target Page Title
          const p2Match = findPageByTitle(part2);
          const p1Match = findPageByTitle(part1);

          if (p2Match) {
            targetPageTitle = part2;
            displayLabel = part1;
          } else if (p1Match && !p2Match) {
            // Fallback for legacy Obsidian order [[Page Title|display text]]
            targetPageTitle = part1;
            displayLabel = part2;
          } else {
            // Default GitHub Wiki syntax: part1 = display text, part2 = Target Page Title
            targetPageTitle = part2;
            displayLabel = part1;
          }
        }

        const escapedLabel = displayLabel.replace(/[&<>"']/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
        return `<button class="wiki-inline-link text-indigo-400 hover:text-indigo-300 font-semibold underline decoration-indigo-400/50 decoration-2 underline-offset-2 transition cursor-pointer" data-wikitarget="${encodeURIComponent(
          targetPageTitle
        )}">${escapedLabel}</button>`;
      });

      return renderMarkdown(raw);
    } catch (e) {
      return '<p class="text-rose-400">Failed to render Markdown.</p>';
    }
  }, [activePage?.content, pages]);

  // Click handler for interactive [[Wiki Links]]
  const handleReaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.wiki-inline-link') as HTMLElement | null;
    if (target && target.dataset.wikitarget) {
      const rawTitle = decodeURIComponent(target.dataset.wikitarget);
      const matchedPage = findPageByTitle(rawTitle);
      if (matchedPage) {
        onSelectPage(matchedPage.id);
      }
    }
  };

  const activeTokens = useMemo(() => {
    if (!activePage) return 0;
    return estimateTokens(activePage.content);
  }, [activePage?.content]);

  const wordCount = useMemo(() => {
    if (!activePage?.content) return 0;
    const words = activePage.content.match(/\b\S+\b/g);
    return words ? words.length : 0;
  }, [activePage?.content]);

  const handleCopyMarkdown = () => {
    if (!activePage) return;
    navigator.clipboard.writeText(activePage.content);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleAutoLinkTerms = () => {
    if (!activePage) return;
    const linked = autoLinkWikiReferences(activePage.content, pages, activePage.id);
    if (linked !== activePage.content) {
      onUpdateContent(activePage.id, linked);
      setAutoLinkedSuccess(true);
      setTimeout(() => setAutoLinkedSuccess(false), 2000);
    }
  };

  const insertSnippet = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('wikiTextarea') as HTMLTextAreaElement | null;
    if (!textarea || !activePage) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activePage.content;
    const selection = text.substring(start, end);

    const replacement = `${prefix}${selection || 'text'}${suffix}`;
    const newContent = text.substring(0, start) + replacement + text.substring(end);

    onUpdateContent(activePage.id, newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selection ? selection.length : 4)
      );
    }, 10);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1017]">
      {/* 3 TABS HEADER: Styled IDENTICALLY to the Right Window Tabs */}
      <div className="bg-[#11141e] border-b border-[#212638] px-3 sm:px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
          {/* Tab 1: Wiki (Read View) */}
          <button
            onClick={() => onSetLeftTab('wiki')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition shrink-0 cursor-pointer ${
              activeLeftTab === 'wiki'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Wiki</span>
          </button>

          {/* Tab 2: Edit (Markdown Editor View) */}
          <button
            onClick={() => onSetLeftTab('edit')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition shrink-0 cursor-pointer ${
              activeLeftTab === 'edit'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {/* Tab 3: Builder (Sources, GDD Compiler & Auto-Verify) */}
          <button
            onClick={() => onSetLeftTab('builder')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition shrink-0 cursor-pointer ${
              activeLeftTab === 'builder'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Builder</span>
          </button>
        </div>

        {/* Right side tools */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {activeLeftTab === 'builder' ? (
            <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
              <span className="bg-[#181c29] border border-[#272e42] px-2.5 py-1 rounded-lg text-indigo-300 font-medium">
                {sources.length} {sources.length === 1 ? 'source' : 'sources'} loaded
              </span>
            </div>
          ) : (
            <>
              {/* In Edit mode, show Code / Split / Preview sub-toggle */}
              {activeLeftTab === 'edit' && (
                <div className="hidden sm:flex items-center space-x-0.5 bg-[#171b28] p-0.5 rounded-lg border border-[#252c3f]">
                  <button
                    onClick={() => onSetViewMode('edit')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                      viewMode === 'edit'
                        ? 'bg-[#252d42] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Code
                  </button>
                  <button
                    onClick={() => onSetViewMode('split')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                      viewMode === 'split'
                        ? 'bg-[#252d42] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Split
                  </button>
                  <button
                    onClick={() => onSetViewMode('preview')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                      viewMode === 'preview'
                        ? 'bg-[#252d42] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              )}

              {/* Auto-link terms button with GitHub Wiki format: [[display text|Page Title]] */}
              <button
                onClick={handleAutoLinkTerms}
                className="bg-[#181c29] hover:bg-[#202638] text-zinc-300 hover:text-indigo-300 border border-[#272e42] px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer"
                title="Auto-insert GitHub Wiki [[display text|Target Page Title]] links for mentions in this page"
              >
                {autoLinkedSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Link className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="hidden xl:inline text-[11px]">
                  {autoLinkedSuccess ? 'Linked!' : 'Auto-Link'}
                </span>
              </button>

              {/* Copy Markdown */}
              <button
                onClick={handleCopyMarkdown}
                className="bg-[#181c29] hover:bg-[#202638] text-zinc-300 hover:text-zinc-100 border border-[#272e42] px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer"
                title="Copy raw markdown to clipboard"
              >
                {copiedMarkdown ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="hidden xl:inline text-[11px]">Copy</span>
              </button>

              <button onClick={onGenerateIndex} disabled={isIndexing || !pages.length} title="Generate summaries and keywords for wiki pages" className="bg-[#181c29] hover:bg-[#202638] disabled:opacity-50 text-indigo-300 border border-[#272e42] px-2 py-1.5 rounded-lg text-xs">{isIndexing ? 'Indexing...' : 'Index wiki'}</button>
              {/* History */}
              <button
                onClick={onOpenHistory}
                className="bg-[#181c29] hover:bg-[#202638] text-zinc-300 hover:text-purple-300 border border-[#272e42] px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer"
                title="Revision history checkpoints"
              >
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden xl:inline text-[11px]">History</span>
              </button>

              {/* Condense */}
              <button
                onClick={onCondensePage}
                disabled={isCondensing}
                className="bg-[#181c29] hover:bg-[#202638] text-zinc-300 hover:text-amber-300 border border-[#272e42] px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer"
                title="Preview a shorter page and check its numbers, tables and links"
              >
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline text-[11px]">Condense</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CONTENT FOR TAB 3: BUILDER */}
      {activeLeftTab === 'builder' ? (
        <SourceBuilderPanel
          sources={sources}
          pages={pages}
          onAddSource={onAddSource}
          onRemoveSource={onRemoveSource}
          onClearSources={onClearSources}
          onBuildWiki={onBuildWiki}
          onVerifyWiki={onVerifyWiki}
          onAutoVerifyAndFixLoop={onAutoVerifyAndFixLoop}
          onStopAutoVerify={onStopAutoVerify}
          autoVerifyProgress={autoVerifyProgress}
          onApplyVerificationFix={onApplyVerificationFix}
          isBuilding={isBuilding}
          isVerifying={isVerifying}
          verdicts={verdicts}
          onClearVerdicts={onClearVerdicts}
        />
      ) : (
        <>
          {/* COLLAPSIBLE PAGES DROPDOWN (Styled IDENTICALLY to the Concept Scratchpad on the right) */}
          <div className="border-b border-[#1f2638] bg-[#111420] shrink-0">
            <div
              onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
              className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[#151928] transition select-none text-xs"
            >
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold truncate pr-2">
                <FolderTree className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  Pages:{' '}
                  <span className="text-zinc-100 font-medium">
                    {parentPage ? `${parentPage.title} / ` : ''}
                    {activePage?.title || 'Wiki'}
                  </span>
                </span>
                <span className="text-[10px] text-zinc-500 font-normal hidden sm:inline">
                  ({pages.length} total • click to browse)
                </span>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
                  isPagesDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* Expanded Pages Panel */}
            {isPagesDropdownOpen && (
              <div className="p-3 border-t border-[#1f2638] bg-[#0c0e15] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filter pages..."
                      className="w-full bg-[#121624] border border-[#232b40] rounded-md pl-7 pr-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex space-x-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onCreatePage(null);
                        setIsPagesDropdownOpen(false);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md transition flex items-center space-x-1 shadow-sm cursor-pointer"
                      title="Create new top-level page"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Page</span>
                    </button>
                    <button
                      onClick={() => {
                        onCreatePage(activePage?.id || null);
                        setIsPagesDropdownOpen(false);
                      }}
                      className="bg-[#191e2e] hover:bg-[#222a40] text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold px-2.5 py-1 rounded-md transition flex items-center space-x-1 cursor-pointer"
                      title={`Create subpage under "${activePage?.title || 'current'}"`}
                    >
                      <CornerDownRight className="w-3 h-3" />
                      <span>+ Subpage</span>
                    </button>
                  </div>
                </div>

                {/* Hierarchical Tree of Pages and Subpages */}
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 text-xs">
                  {topLevelPages
                    .filter(
                      (p) =>
                        !searchFilter.trim() ||
                        p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        (subpagesMap.get(p.id) || []).some((sub) =>
                          sub.title.toLowerCase().includes(searchFilter.toLowerCase())
                        )
                    )
                    .map((parent) => {
                      const isParentActive = parent.id === activePageId;
                      const children = subpagesMap.get(parent.id) || [];
                      return (
                        <div key={parent.id} className="space-y-0.5">
                          {/* Parent Page Row */}
                          <div
                            onClick={() => {
                              onSelectPage(parent.id);
                              setIsPagesDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${
                              isParentActive
                                ? 'bg-indigo-600/25 border border-indigo-500/40 text-white font-semibold'
                                : 'hover:bg-[#1a1f30] text-zinc-300'
                            }`}
                          >
                            <div className="truncate flex items-center space-x-1.5">
                              <BookMarked
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isParentActive ? 'text-indigo-400' : 'text-zinc-500'
                                }`}
                              />
                              <span className="truncate">{parent.title}</span>
                              {children.length > 0 && (
                                <span className="text-[10px] text-zinc-500 font-normal">
                                  ({children.length} subpages)
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              ~{estimateTokens(parent.content)}t
                            </span>
                          </div>

                          {/* Subpages indented underneath */}
                          {children.map((child) => {
                            const isChildActive = child.id === activePageId;
                            return (
                              <div
                                key={child.id}
                                onClick={() => {
                                  onSelectPage(child.id);
                                  setIsPagesDropdownOpen(false);
                                }}
                                className={`flex items-center justify-between pl-6 pr-2 py-1 rounded-md cursor-pointer transition text-[11px] ${
                                  isChildActive
                                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                                    : 'hover:bg-[#181c2b] text-zinc-400'
                                }`}
                              >
                                <div className="truncate flex items-center space-x-1.5">
                                  <CornerDownRight className="w-3 h-3 text-zinc-600 shrink-0" />
                                  <span className="truncate">{child.title}</span>
                                </div>
                                <span className="text-[9px] text-zinc-500 font-mono shrink-0">
                                  ~{estimateTokens(child.content)}t
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Formatting Toolbar (Only in Edit mode) */}
          {activeLeftTab === 'edit' && viewMode !== 'preview' && (
            <div className="px-4 py-1.5 border-b border-[#1f2638] bg-[#0f121a] flex flex-wrap items-center justify-between shrink-0 gap-2">
              {/* Title input & Parent Page selector */}
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                <input
                  type="text"
                  value={activePage?.title || ''}
                  onChange={(e) => activePage && onUpdateTitle(activePage.id, e.target.value)}
                  className="bg-[#181c2b] border border-[#272e42] text-xs font-semibold rounded-lg px-2.5 py-1 text-zinc-100 focus:outline-none focus:border-indigo-500 transition w-44 sm:w-60"
                  placeholder="Article Title..."
                />

                <div className="flex flex-wrap items-center gap-1 text-zinc-400 text-xs">
                  <label className="text-[10px] text-zinc-500">Category:
                    <select aria-label="Page category" value={activePage?.category ?? ''} onChange={(e) => activePage && onUpdateCategory(activePage.id, (e.target.value || undefined) as WikiPage['category'])} className="ml-1 bg-[#181c2b] border border-[#272e42] text-[11px] rounded px-1 py-0.5 text-zinc-200">
                      <option value="">Uncategorized</option>
                      {['Core', 'Mechanics', 'Systems', 'World', 'Tech'].map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <span className="text-[10px] text-zinc-500">Parent:</span>
                  <select
                    value={activePage?.parentId || ''}
                    onChange={(e) =>
                      activePage && onUpdateParentId(activePage.id, e.target.value || null)
                    }
                    className="bg-[#181c2b] border border-[#272e42] text-[11px] rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none"
                  >
                    <option value="">None (Top-Level)</option>
                    {pages
                      .filter((p) => activePage && canSetPageParent(pages, activePage.id, p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Formatting helpers */}
              <div className="flex items-center space-x-1 text-zinc-400">
                <button
                  onClick={() => insertSnippet('# ')}
                  className="p-1 hover:text-zinc-100 hover:bg-[#1e2436] rounded cursor-pointer"
                  title="Heading 1"
                >
                  <Hash className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertSnippet('**', '**')}
                  className="p-1 hover:text-zinc-100 hover:bg-[#1e2436] rounded cursor-pointer"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertSnippet('- ')}
                  className="p-1 hover:text-zinc-100 hover:bg-[#1e2436] rounded cursor-pointer"
                  title="List item"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertSnippet('```\n', '\n```')}
                  className="p-1 hover:text-zinc-100 hover:bg-[#1e2436] rounded cursor-pointer"
                  title="Code block"
                >
                  <Code2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    insertSnippet(
                      '| Parameter | Value | Formula |\n| :--- | :--- | :--- |\n| Phase Dodge | 22.0 | Base Stamina |\n'
                    )
                  }
                  className="p-1 hover:text-zinc-100 hover:bg-[#1e2436] rounded cursor-pointer"
                  title="Markdown Table"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertSnippet('[[display text|', ']]')}
                  className="px-1.5 py-0.5 hover:text-zinc-100 hover:bg-[#1e2436] rounded font-mono text-[11px] text-indigo-300 border border-indigo-500/20 cursor-pointer"
                  title="GitHub Wiki Link: [[display text|Target Page Title]]"
                >
                  [[text|Page]]
                </button>
              </div>

              <button
                onClick={() => onSetLeftTab('wiki')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                Done Editing ✓
              </button>
            </div>
          )}

          {/* MAIN ARTICLE AREA */}
          <div className="flex-1 overflow-hidden relative p-4 sm:p-6 flex flex-col">
            {activeLeftTab === 'wiki' ? (
              /* CLEAN WIKI READER MODE */
              <div className="h-full overflow-y-auto max-w-4xl pr-2 sm:pr-4 selection:bg-indigo-500/30 leading-relaxed">
                {/* Breadcrumb if subpage */}
                {parentPage && (
                  <div className="flex items-center space-x-1.5 text-xs text-zinc-500 mb-3 pb-2 border-b border-[#1f2638]">
                    <button
                      onClick={() => onSelectPage(parentPage.id)}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                    >
                      {parentPage.title}
                    </button>
                    <span>/</span>
                    <span className="text-zinc-300">{activePage?.title}</span>
                  </div>
                )}

                {/* Markdown rendered body with clickable GitHub Wiki links */}
                <div
                  onClick={handleReaderClick}
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: parsedReaderHtml }}
                />

                {/* Directory of Subpages for this section */}
                {subpages.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-[#1f2638] bg-[#111420] p-4 rounded-xl border border-[#232b40]">
                    <div className="flex items-center space-x-1.5 font-bold text-xs text-indigo-300 mb-2">
                      <FolderTree className="w-4 h-4 text-indigo-400" />
                      <span>Subpages in this Section ({subpages.length}):</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {subpages.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => onSelectPage(sub.id)}
                          className="text-left bg-[#161a29] hover:bg-[#1f2538] border border-[#252c3f] p-2 rounded-lg text-zinc-200 transition flex items-center space-x-2 group cursor-pointer"
                        >
                          <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:translate-x-0.5 transition" />
                          <div className="truncate">
                            <span className="font-semibold block truncate group-hover:text-indigo-300">
                              {sub.title}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              ~{estimateTokens(sub.content)} tokens
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* EDITING WORKSPACE */
              viewMode === 'split' ? (
                <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
                  <div className="h-full bg-[#0a0c12] border border-[#212638] rounded-xl overflow-hidden flex flex-col">
                    <textarea
                      id="wikiTextarea"
                      value={activePage?.content || ''}
                      onChange={(e) => activePage && onUpdateContent(activePage.id, e.target.value)}
                      placeholder="Write GDD specifications in Markdown..."
                      className="w-full flex-1 bg-transparent p-3 text-xs font-mono text-zinc-100 resize-none focus:outline-none leading-relaxed"
                      spellCheck={false}
                    />
                  </div>
                  <div className="h-full bg-[#0a0c12] border border-[#212638] rounded-xl p-4 overflow-y-auto markdown-body">
                    <div onClick={handleReaderClick} dangerouslySetInnerHTML={{ __html: parsedReaderHtml }} />
                  </div>
                </div>
              ) : viewMode === 'preview' ? (
                <div className="h-full bg-[#0a0c12] border border-[#212638] rounded-xl p-4 overflow-y-auto markdown-body flex-1">
                  <div onClick={handleReaderClick} dangerouslySetInnerHTML={{ __html: parsedReaderHtml }} />
                </div>
              ) : (
                <div className="h-full bg-[#0a0c12] border border-[#212638] rounded-xl overflow-hidden flex flex-col flex-1">
                  <textarea
                    id="wikiTextarea"
                    value={activePage?.content || ''}
                    onChange={(e) => activePage && onUpdateContent(activePage.id, e.target.value)}
                    placeholder="Write GDD specifications in Markdown..."
                    className="w-full flex-1 bg-transparent p-3 text-xs font-mono text-zinc-100 resize-none focus:outline-none leading-relaxed"
                    spellCheck={false}
                  />
                </div>
              )
            )}
          </div>

          {/* Footer Status Bar */}
          <div className="h-8 border-t border-[#1f2638] bg-[#10131d] px-4 flex justify-between items-center text-[10px] sm:text-[11px] text-zinc-400 shrink-0 select-none">
            <div className="flex items-center space-x-2 truncate pr-2">
              <span>{wordCount} words</span>
              <span>•</span>
              <span className="text-indigo-400 font-mono">~{activeTokens}t</span>
              <span>•</span>
              <span className="text-zinc-500 truncate">
                {parentPage ? `Subpage of "${parentPage.title}"` : 'Top-Level Section'}
              </span>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {pages.length > 1 && (
                <button
                  onClick={() => activePage && onDeletePage(activePage.id)}
                  className="text-zinc-500 hover:text-rose-400 transition flex items-center space-x-1 cursor-pointer"
                  title="Delete this page"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


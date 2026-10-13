import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  GraduationCap,
  Sparkles,
  Loader2,
  Trash2,
  Copy,
  Check,
  Scale,
  RefreshCw,
  Wand2,
  Terminal,
  Paperclip,
  X,
  Layers,
  Brain,
  StickyNote,
  Search,
  ChevronDown,
  CornerDownRight
} from 'lucide-react';
import { renderMarkdown } from '../utils/markdown';
import { ActionType, ChatMessage, RightTab, TargetEngine, WikiPage } from '../types';
import { calculateTotalWikiTokens, estimateTokens } from '../utils/tokenCounter';

interface AssistantPanelProps {
  activeTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  targetEngine: TargetEngine;
  chatConcept: ChatMessage[];
  chatTeacher: ChatMessage[];
  onSendMessage: (
    actionType: ActionType,
    prompt: string,
    image?: { base64: string; mimeType: string; name: string }
  ) => Promise<void>;
  onClearChat: () => void;
  isLoading: boolean;
  activeWikiPage: WikiPage | null;
  onOpenSectionApply: (rawText: string) => void;
  // Context Working Memory props
  pages: WikiPage[];
  onSelectPage: (id: string) => void;
  // Separate Private Scratchpads
  conceptNotepad: string;
  onConceptNotepadChange: (val: string) => void;
  teacherNotepad: string;
  onTeacherNotepadChange: (val: string) => void;
  onPromoteNotepadToPage: (title: string, content: string, parentId?: string | null) => void;
}

const AGREE_RE = /if you agree|say the word|give me the (go-ahead|green light|nod)|want me to (apply|update|lock|write)|ready for me to (apply|update)|agreed\?/i;

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  activeTab,
  onTabChange,
  targetEngine,
  chatConcept,
  chatTeacher,
  onSendMessage,
  onClearChat,
  isLoading,
  activeWikiPage,
  onOpenSectionApply,
  pages,
  onSelectPage,
  conceptNotepad,
  onConceptNotepadChange,
  teacherNotepad,
  onTeacherNotepadChange,
  onPromoteNotepadToPage
}) => {
  const [promptText, setPromptText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contextFilter, setContextFilter] = useState('');

  // Scratchpad UI toggles
  const [isConceptScratchpadOpen, setIsConceptScratchpadOpen] = useState(false);
  const [isTeacherScratchpadOpen, setIsTeacherScratchpadOpen] = useState(false);
  const [promotedSuccess, setPromotedSuccess] = useState(false);

  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    name: string;
    previewUrl: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = activeTab === 'concept' ? chatConcept : chatTeacher;
  const renderedMessages = useMemo(() => new Map(activeChat.map((msg) => [msg.id, renderMarkdown(msg.text || '')])), [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat, isLoading]);

  const handleSend = (actionType: ActionType) => {
    if (isLoading) return;
    const trimmed = promptText.trim();
    if (!trimmed && actionType !== 'recompile' && actionType !== 'balance') {
      return;
    }

    const imgPayload = pendingImage
      ? {
          base64: pendingImage.base64,
          mimeType: pendingImage.mimeType,
          name: pendingImage.name
        }
      : undefined;

    onSendMessage(actionType, trimmed, imgPayload);
    setPromptText('');
    setPendingImage(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      alert('Choose a PNG, JPEG, WebP, or GIF screenshot under 10 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || file.type || 'image/png';
      setPendingImage({
        base64,
        mimeType,
        name: file.name,
        previewUrl: dataUrl
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Context & Token Calculations for Tab 3
  const { totalTokens, totalWords } = useMemo(() => {
    return calculateTotalWikiTokens(pages);
  }, [pages]);

  const TOKEN_BUDGET = 1_050_000;
  const budgetPercent = Math.min(100, Math.round((totalTokens / TOKEN_BUDGET) * 100));

  const filteredContextPages = useMemo(() => {
    if (!contextFilter.trim()) return pages;
    const q = contextFilter.toLowerCase();
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [pages, contextFilter]);

  const handlePromoteScratchpad = (rawNotepad: string, asSubpage: boolean = false) => {
    if (!rawNotepad.trim()) return;
    const firstLine =
      rawNotepad
        .trim()
        .split('\n')[0]
        .replace(/^[#\s*-]+/, '')
        .trim() || 'New Design Note';

    const parentId = asSubpage ? activeWikiPage?.id || null : null;
    onPromoteNotepadToPage(firstLine, rawNotepad, parentId);
    setPromotedSuccess(true);
    setTimeout(() => setPromotedSuccess(false), 2000);
  };

  return (
    <section className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden">
      {/* 3 Tabs Header: Concept, Teacher, Wiki Context */}
      <div className="bg-[#11141e] border-b border-[#212638] px-3 sm:px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => onTabChange('concept')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'concept'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Concept Assistant</span>
          </button>

          <button
            onClick={() => onTabChange('teacher')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'teacher'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Code Teacher</span>
          </button>

          <button
            onClick={() => onTabChange('context')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'context'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Wiki Context</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="text-[10px] sm:text-[11px] text-zinc-400 hidden xl:flex items-center space-x-1.5 bg-[#181c29] px-2.5 py-1 rounded-lg border border-[#272e42]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Grounded in Wiki</span>
          </div>

          {activeChat.length > 0 && activeTab !== 'context' && (
            <button
              onClick={onClearChat}
              className="bg-[#181c29] hover:bg-[#202638] text-zinc-400 hover:text-rose-300 border border-[#272e42] px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Clear current chat thread"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 3: Dedicated Wiki Context & Memory Gauge (Scratchpad removed from here) */}
      {activeTab === 'context' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-zinc-300">
          <div className="bg-[#141826] border border-[#232b40] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-zinc-100">AI Grounding Memory Gauge</h3>
              </div>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Tiered Retrieval Active
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Every prompt sent to the Concept Assistant or Code Teacher is grounded in the Home page, relevant pages, and summaries of other wiki pages.
            </p>

            {/* Token Budget Gauge */}
            <div className="bg-[#0e1017] p-3 rounded-lg border border-[#1f2537] space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium">Context Working Memory</span>
                <span className="font-bold text-zinc-100">
                  {totalTokens.toLocaleString()} / {TOKEN_BUDGET.toLocaleString()} tokens
                </span>
              </div>
              <div className="w-full bg-[#1b2031] h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    budgetPercent > 85 ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 pt-0.5">
                <span>{pages.length} pages/subpages ({totalWords.toLocaleString()} words)</span>
                <span>{100 - budgetPercent}% free headroom</span>
              </div>
            </div>

            {/* Context Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={contextFilter}
                onChange={(e) => setContextFilter(e.target.value)}
                placeholder="Filter pages in working memory..."
                className="w-full bg-[#0d0f17] border border-[#212638] rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* List of pages in context */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredContextPages.map((page) => {
                const pageTokens = estimateTokens(page.content);
                return (
                  <div
                    key={page.id}
                    onClick={() => onSelectPage(page.id)}
                    className="group py-1 px-2 rounded-md hover:bg-[#1b2031] cursor-pointer text-zinc-300 flex items-center justify-between transition text-xs"
                  >
                    <div className="truncate flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span className="truncate group-hover:text-white font-medium">{page.title}</span>
                      {page.parentId && (
                        <span className="text-[10px] text-zinc-500">(Subpage)</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                      ~{pageTokens}t
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Chat Stream Area with Dedicated Scratchpad (Concept or Teacher) */
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Collapsible Dedicated Scratchpad for Concept Assistant */}
          {activeTab === 'concept' && (
            <div className="border-b border-[#1f2638] bg-[#111420] shrink-0">
              <div
                onClick={() => setIsConceptScratchpadOpen(!isConceptScratchpadOpen)}
                className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[#151928] transition select-none text-xs"
              >
                <div className="flex items-center space-x-2 text-amber-300 font-semibold">
                  <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                  <span>Concept Scratchpad</span>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    (Private design brainstorm & notes)
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                    isConceptScratchpadOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {isConceptScratchpadOpen && (
                <div className="p-3 border-t border-[#1f2638] bg-[#0c0e15] space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>Private notes — never sent to the model prompt.</span>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => handlePromoteScratchpad(conceptNotepad, false)}
                        disabled={!conceptNotepad.trim()}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-semibold transition"
                        title="Promote notes into a new top-level wiki page"
                      >
                        {promotedSuccess ? 'Created Page!' : '+ Turn into Page'}
                      </button>
                      <button
                        onClick={() => handlePromoteScratchpad(conceptNotepad, true)}
                        disabled={!conceptNotepad.trim()}
                        className="bg-[#191e2e] hover:bg-[#222a40] text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-semibold transition flex items-center space-x-1"
                        title={`Promote notes into a subpage under "${activeWikiPage?.title || 'active'}"`}
                      >
                        <CornerDownRight className="w-2.5 h-2.5" />
                        <span>+ Subpage</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={conceptNotepad}
                    onChange={(e) => onConceptNotepadChange(e.target.value)}
                    placeholder="Draft game design ideas, skill concept notes, balancing math..."
                    rows={4}
                    className="w-full bg-[#121624] border border-[#232b40] rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-amber-500/50 font-mono leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          {/* Collapsible Dedicated Scratchpad for Code Teacher */}
          {activeTab === 'teacher' && (
            <div className="border-b border-[#1f2638] bg-[#111420] shrink-0">
              <div
                onClick={() => setIsTeacherScratchpadOpen(!isTeacherScratchpadOpen)}
                className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[#151928] transition select-none text-xs"
              >
                <div className="flex items-center space-x-2 text-indigo-300 font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Code Scratchpad ({targetEngine.lang})</span>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    (Private script notes & API reminders)
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                    isTeacherScratchpadOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {isTeacherScratchpadOpen && (
                <div className="p-3 border-t border-[#1f2638] bg-[#0c0e15] space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>Private code notes — never sent to the model prompt.</span>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => handlePromoteScratchpad(teacherNotepad, false)}
                        disabled={!teacherNotepad.trim()}
                        className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-semibold transition"
                      >
                        {promotedSuccess ? 'Created Page!' : '+ Turn into Page'}
                      </button>
                      <button
                        onClick={() => handlePromoteScratchpad(teacherNotepad, true)}
                        disabled={!teacherNotepad.trim()}
                        className="bg-[#191e2e] hover:bg-[#222a40] text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-semibold transition flex items-center space-x-1"
                      >
                        <CornerDownRight className="w-2.5 h-2.5" />
                        <span>+ Subpage</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={teacherNotepad}
                    onChange={(e) => onTeacherNotepadChange(e.target.value)}
                    placeholder="Paste code snippets, node path notes, input map names..."
                    rows={4}
                    className="w-full bg-[#121624] border border-[#232b40] rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4 pr-2 mb-2">
            {/* Welcome Banner */}
            <div className="bg-[#141826] border border-[#232b40] rounded-xl p-3.5 max-w-3xl shadow-sm">
              <div className="flex items-center space-x-2 mb-1 text-indigo-400 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>
                  {activeTab === 'concept'
                    ? 'Concept Co-Developer Ready'
                    : `Code Teacher Ready — ${targetEngine.name}`}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {activeTab === 'concept'
                  ? 'I read all active pages and subpages as single source of truth. Ask about mechanic tradeoffs, click Balance to audit damage/resource curves, or click Recompile to audit your entire design.'
                  : `I translate your GDD specifications into production starter code for ${targetEngine.name}. All variables, signals, and formulas directly map to your wiki. Attach error screenshots if you get stuck!`}
              </p>
            </div>

            {/* Chat Messages */}
            {activeChat.map((msg) => {
              const isUser = msg.role === 'user';
              const parsedHtml = renderedMessages.get(msg.id) || '';
              const hasAgreementCheck =
                !isUser && (AGREE_RE.test(msg.text) || msg.actionType === 'wiki_edit');

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl rounded-xl p-4 text-xs shadow-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-[#131722] border border-[#232a3e] text-zinc-200 w-full'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 opacity-80 text-[11px]">
                      <span className="font-bold flex items-center space-x-1.5">
                        {isUser ? (
                          <span>You</span>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>
                              {activeTab === 'concept' ? 'Concept Assistant' : 'Code Teacher'}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {msg.imageName && (
                      <div className="mb-2 bg-[#0c0e14] px-2 py-1 rounded text-[10px] text-indigo-300 font-mono inline-block">
                        📎 Attached screenshot: {msg.imageName}
                      </div>
                    )}

                    <div
                      className="leading-relaxed markdown-body"
                      dangerouslySetInnerHTML={{ __html: parsedHtml }}
                    />

                    {/* Actions on Assistant messages */}
                    {!isUser && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-[#232a3e]">
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 bg-[#1a1f30] hover:bg-[#222940] px-2.5 py-1 rounded-md transition flex items-center space-x-1 border border-[#2b334b]"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onOpenSectionApply(msg.text)}
                          className={`text-[11px] px-2.5 py-1 rounded-md transition flex items-center space-x-1 border font-medium ${
                            hasAgreementCheck
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-sm'
                              : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
                          }`}
                          title="Preview and apply section updates directly to the wiki"
                        >
                          <Layers className="w-3 h-3" />
                          <span>
                            {hasAgreementCheck ? '✨ Agree & Apply to Wiki' : 'Apply to Wiki'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute bottom-28 left-6 bg-[#181c2b] border border-indigo-500/40 px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-xl text-indigo-300 z-10 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Consulting GDD Wiki context with GPT-6.1 Sol...</span>
            </div>
          )}


          {/* Input & Action Bar */}
          <div className="bg-[#121520] border-t border-[#232b40] p-3 flex flex-col space-y-2 shrink-0">
            {pendingImage && (
              <div className="flex items-center space-x-2 bg-[#181c29] p-1.5 rounded-lg border border-[#272e42] w-fit">
                <img
                  src={pendingImage.previewUrl}
                  alt="Upload preview"
                  className="w-10 h-10 object-cover rounded"
                />
                <span className="text-xs text-zinc-300 max-w-[150px] truncate">
                  {pendingImage.name}
                </span>
                <button
                  onClick={() => setPendingImage(null)}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend(activeTab === 'concept' ? 'discuss' : 'teach');
                }
              }}
              placeholder={
                activeTab === 'concept'
                  ? "Talk through a concept (e.g. 'Should sprint drain stamina? What are tradeoffs for stamina burnout?')"
                  : `Ask for starter code or attach an error screenshot (e.g. 'Write the PlayerController script in ${targetEngine.lang}')`
              }
              rows={2}
              className="w-full bg-[#0d0f17] border border-[#212638] rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-zinc-400 hover:text-zinc-200 bg-[#181c29] border border-[#272e42] px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1"
                  title="Attach an engine error screenshot or level map diagram"
                >
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Attach Screenshot</span>
                </button>

                <span className="text-[10px] text-zinc-500 hidden md:inline">
                  Press <kbd className="px-1.5 py-0.5 bg-[#1b2031] rounded text-[10px] text-zinc-400 border border-[#262c42]">Ctrl+Enter</kbd>
                </span>
              </div>

              {/* Dynamic Action Buttons */}
              {activeTab === 'concept' ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSend('discuss')}
                    disabled={isLoading || (!promptText.trim() && !pendingImage)}
                    className="bg-[#1e2436] hover:bg-[#273048] disabled:opacity-40 text-zinc-200 border border-[#2f3854] text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Discuss</span>
                  </button>
                  <button
                    onClick={() => handleSend('balance')}
                    disabled={isLoading}
                    className="bg-[#1e2436] hover:bg-[#273048] disabled:opacity-40 text-purple-200 border border-purple-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5"
                    title="Audit numerical curves, power scaling, and economy sinks"
                  >
                    <Scale className="w-3.5 h-3.5 text-purple-400" />
                    <span>Balance</span>
                  </button>
                  <button
                    onClick={() => handleSend('recompile')}
                    disabled={isLoading}
                    className="bg-[#1e2436] hover:bg-[#273048] disabled:opacity-40 text-amber-200 border border-amber-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5"
                    title="Synthesize and restate affected wiki pages"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>📄 Recompile</span>
                  </button>
                  {activeChat.length > 0 && (
                    <button
                      onClick={onClearChat}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSend('teach')}
                    disabled={isLoading || (!promptText.trim() && !pendingImage)}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Teach Me ({targetEngine.lang})</span>
                  </button>
                  <button
                    onClick={() => handleSend('wiki_edit')}
                    disabled={isLoading || !promptText.trim()}
                    className="bg-[#1e2436] hover:bg-[#273048] disabled:opacity-40 text-zinc-200 border border-[#2f3854] text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>✨ Wiki Edit</span>
                  </button>
                  <button
                    onClick={() => handleSend('test_logic')}
                    disabled={isLoading || !promptText.trim()}
                    className="bg-[#1e2436] hover:bg-[#273048] disabled:opacity-40 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Logic Test</span>
                  </button>
                  {activeChat.length > 0 && (
                    <button
                      onClick={onClearChat}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};


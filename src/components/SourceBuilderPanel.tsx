import React, { useState } from 'react';
import {
  Sparkles,
  Link2,
  Upload,
  ClipboardPaste,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Loader2,
  Zap,
  Square
} from 'lucide-react';
import { AutoVerifyProgress, SourceItem, VerificationVerdict, WikiPage } from '../types';
import { proxyFetchUrl } from '../services/geminiService';

interface SourceBuilderPanelProps {
  sources: SourceItem[];
  pages: WikiPage[];
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

export const SourceBuilderPanel: React.FC<SourceBuilderPanelProps> = ({
  sources,
  pages,
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
  const [urlInput, setUrlInput] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setIsFetchingUrl(true);
    setFetchError(null);

    try {
      const text = await proxyFetchUrl(trimmed);
      const urlTitle = trimmed.split('/').pop()?.replace(/\.(md|html|txt)$/i, '') || 'Web Source';
      onAddSource({
        title: decodeURIComponent(urlTitle).slice(0, 60),
        kind: 'url',
        text,
        url: trimmed
      });
      setUrlInput('');
    } catch (e: any) {
      setFetchError(e.message || 'Failed to fetch link.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleAddPaste = () => {
    const text = pasteContent.trim();
    if (!text) return;
    onAddSource({
      title: pasteTitle.trim() || `Paste Source (${sources.length + 1})`,
      kind: 'paste',
      text
    });
    setPasteTitle('');
    setPasteContent('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      try {
        const text = await f.text();
        onAddSource({
          title: f.name,
          kind: 'file',
          text
        });
      } catch (err) {
        console.error('File read error:', err);
      }
    }
    e.target.value = '';
  };

  const totalSourceChars = sources.reduce((acc, s) => acc + s.text.length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-zinc-300 bg-[#0d1017]">
      {/* Intro info banner */}
      <div className="bg-[#141826] border border-[#232b40] rounded-xl p-3.5 space-y-1.5">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold">
          <Sparkles className="w-4 h-4" />
          <span>Ingest Game Design Sources & Auto-Verify</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Upload engine scripts, design documents, or GitHub raw markdown files. Then run{' '}
          <strong className="text-zinc-200">Build Wiki</strong> or use the self-healing{' '}
          <strong className="text-emerald-300">Auto-Verify & Fix Loop</strong> to converge on 100% factual accuracy.
        </p>
      </div>

      {/* Auto-Verify Convergence Active Status Banner */}
      {autoVerifyProgress.isRunning && (
        <div className="bg-gradient-to-r from-emerald-950/60 to-indigo-950/60 border border-emerald-500/40 rounded-xl p-3.5 space-y-2 shadow-lg animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
              <Zap className="w-4 h-4" />
              <span>
                Self-Healing Auto-Verify Loop (Pass {autoVerifyProgress.currentPass}/{autoVerifyProgress.maxPasses})
              </span>
            </div>
            <button
              onClick={onStopAutoVerify}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-1"
            >
              <Square className="w-2.5 h-2.5 fill-rose-300" />
              <span>Stop Loop</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-300">{autoVerifyProgress.statusMessage}</p>

          <div className="w-full bg-[#1b2133] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300"
              style={{
                width: `${
                  autoVerifyProgress.totalPagesCount > 0
                    ? Math.round(
                        (autoVerifyProgress.cleanPagesCount / autoVerifyProgress.totalPagesCount) * 100
                      )
                    : 0
                }%`
              }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>
              {autoVerifyProgress.cleanPagesCount} / {autoVerifyProgress.totalPagesCount} clean pages
            </span>
            <span>{autoVerifyProgress.issuesResolvedTotal} issues repaired so far</span>
          </div>
        </div>
      )}

      {/* Fetch Link */}
      <div className="bg-[#121622] border border-[#21273a] rounded-xl p-3 space-y-2">
        <label className="font-semibold text-zinc-200 flex items-center space-x-1.5 text-[11px]">
          <Link2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Link Remote Markdown URL (CORS-Free Proxy)</span>
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://raw.githubusercontent.com/.../Combat.md"
            className="flex-1 bg-[#0d0f17] border border-[#212638] rounded-lg px-2.5 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
          />
          <button
            onClick={handleFetchUrl}
            disabled={isFetchingUrl || !urlInput.trim()}
            className="bg-[#1e2436] hover:bg-[#273048] disabled:opacity-40 text-indigo-200 border border-indigo-500/30 px-3 py-1.5 rounded-lg font-medium transition shrink-0 flex items-center space-x-1"
          >
            {isFetchingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Fetch</span>}
          </button>
        </div>
        {fetchError && <p className="text-rose-400 text-[10px]">{fetchError}</p>}
      </div>

      {/* Upload Files */}
      <div className="bg-[#121622] border border-[#21273a] rounded-xl p-3 space-y-2">
        <label className="font-semibold text-zinc-200 flex items-center space-x-1.5 text-[11px]">
          <Upload className="w-3.5 h-3.5 text-purple-400" />
          <span>Upload Engine Scripts / Files (.md, .gd, .cs, .py, .ts, .json)</span>
        </label>
        <input
          type="file"
          multiple
          accept=".md,.markdown,.txt,.json,.csv,.gd,.cs,.py,.js,.ts"
          onChange={handleFileUpload}
          className="text-[11px] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer text-zinc-400"
        />
      </div>

      {/* Paste Text */}
      <div className="bg-[#121622] border border-[#21273a] rounded-xl p-3 space-y-2">
        <label className="font-semibold text-zinc-200 flex items-center space-x-1.5 text-[11px]">
          <ClipboardPaste className="w-3.5 h-3.5 text-amber-400" />
          <span>Paste Design Notes / GDD Excerpt</span>
        </label>
        <input
          type="text"
          value={pasteTitle}
          onChange={(e) => setPasteTitle(e.target.value)}
          placeholder="Paste title (optional)"
          className="w-full bg-[#0d0f17] border border-[#212638] rounded-lg px-2.5 py-1 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-xs"
        />
        <textarea
          value={pasteContent}
          onChange={(e) => setPasteContent(e.target.value)}
          placeholder="Paste raw mechanical formulas, game design notes..."
          rows={3}
          className="w-full bg-[#0d0f17] border border-[#212638] rounded-lg p-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono text-xs resize-none"
        />
        <button
          onClick={handleAddPaste}
          disabled={!pasteContent.trim()}
          className="bg-[#1b2031] hover:bg-[#232a40] disabled:opacity-40 text-zinc-200 border border-[#2d354e] px-3 py-1.5 rounded-lg font-medium transition text-[11px]"
        >
          Add as Source
        </button>
      </div>

      {/* Sources List */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[11px]">
          <span className="font-bold text-zinc-200 uppercase tracking-wider">
            Active Sources ({sources.length})
          </span>
          <span className="text-zinc-500 font-mono">
            ~{totalSourceChars.toLocaleString()} chars
          </span>
        </div>

        {sources.length === 0 ? (
          <div className="p-4 border border-dashed border-[#232a3c] rounded-xl text-center text-zinc-500 text-[11px]">
            No sources added yet. Add a link, upload files, or paste notes above.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {sources.map((s) => (
              <div
                key={s.id}
                className="bg-[#131622] border border-[#212739] rounded-lg p-2 flex items-center justify-between text-xs"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-zinc-200 block truncate">{s.title}</span>
                  <span className="text-[10px] text-zinc-500">
                    {s.kind} • {s.text.length.toLocaleString()} chars
                  </span>
                </div>
                <button
                  onClick={() => onRemoveSource(s.id)}
                  className="text-zinc-500 hover:text-rose-400 p-1 transition"
                  title="Remove source"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons: Build & Auto-Verify Loop */}
      <div className="pt-2 border-t border-[#232a3c] space-y-2.5">
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              className="rounded bg-[#1a1f30] border-[#2b334b] text-indigo-600 focus:ring-0"
            />
            <span>Replace existing pages on build (otherwise appends)</span>
          </label>
        </div>

        {/* 1. Build Wiki */}
        <button
          onClick={() => onBuildWiki(replaceMode)}
          disabled={isBuilding || sources.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 shadow-md shadow-indigo-600/20"
        >
          {isBuilding ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Building Wiki with Gemini 3.8 Flash...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Build Wiki from Sources</span>
            </>
          )}
        </button>

        {/* 2. Self-Healing Auto-Verify & Fix Loop Button (Highlighted Feature) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={onAutoVerifyAndFixLoop}
            disabled={autoVerifyProgress.isRunning || isVerifying || sources.length === 0 || pages.length === 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold py-2 px-2.5 rounded-lg transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
            title="Runs verify and auto-fix in a loop until 100% clean"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ Auto-Verify & Fix Loop</span>
          </button>

          <button
            onClick={onVerifyWiki}
            disabled={isVerifying || autoVerifyProgress.isRunning || sources.length === 0 || pages.length === 0}
            className="bg-[#1b2032] hover:bg-[#242b44] disabled:opacity-40 text-zinc-200 border border-[#2c3652] font-semibold py-2 px-2.5 rounded-lg transition flex items-center justify-center space-x-1.5"
            title="Inspect facts without auto-fixing"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verify Once</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Verification Verdicts Breakdown */}
      {verdicts.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#232a3c]">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-zinc-200 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Verification Report ({verdicts.filter((v) => v.status === 'ok').length}/{verdicts.length} Clean)
              </span>
            </span>
            <button
              onClick={onClearVerdicts}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {verdicts.map((v, i) => (
              <div
                key={i}
                className="bg-[#131622] border border-[#23293c] rounded-lg p-2.5 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    {v.status === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : v.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="font-bold text-zinc-200">{v.title}</span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      v.status === 'ok'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : v.status === 'error'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>

                {v.issues.length > 0 && (
                  <div className="text-[11px] text-zinc-400">
                    <strong className="text-zinc-300">Issues:</strong> {v.issues.join(' • ')}
                  </div>
                )}
                {v.unsupported.length > 0 && (
                  <div className="text-[11px] text-amber-300/80">
                    <strong>Unsupported:</strong> {v.unsupported.join(' • ')}
                  </div>
                )}
                {v.missing.length > 0 && (
                  <div className="text-[11px] text-zinc-400">
                    <strong>Missing in page:</strong> {v.missing.join(' • ')}
                  </div>
                )}

                {v.status !== 'ok' && (
                  <div className="pt-1">
                    <button
                      onClick={() => onApplyVerificationFix(v)}
                      className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[10px] font-semibold px-2.5 py-1 rounded-md transition flex items-center space-x-1"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>🔧 Auto-Fix This Page</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

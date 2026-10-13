import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Sparkles,
  Clock,
  Download,
  HelpCircle,
  History,
  FileCode,
  CheckCircle2,
  ChevronDown,
  Plus,
  Trash2,
  KeyRound
} from 'lucide-react';
import { ProjectData, TargetEngineId } from '../types';
import { TARGET_ENGINES } from '../data/initialData';

interface HeaderProps {
  currentProject: ProjectData;
  projectActionsDisabled?: boolean;
  durableStorage?: boolean;
  allProjects: ProjectData[];
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (name: string) => void;
  targetEngineId: TargetEngineId;
  onTargetEngineChange: (id: TargetEngineId) => void;
  autoSaveStatus: 'saved' | 'saving' | 'dirty';
  onOpenCompatibilityModal: () => void;
  onOpenExportModal: () => void;
  onOpenSnapshotsModal: () => void;
  onOpenApiKeyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  projectActionsDisabled = false,
  durableStorage = false,
  allProjects,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onRenameProject,
  targetEngineId,
  onTargetEngineChange,
  autoSaveStatus,
  onOpenCompatibilityModal,
  onOpenExportModal,
  onOpenSnapshotsModal,
  onOpenApiKeyModal
}) => {
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(currentProject.name);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRenameValue(currentProject.name);
  }, [currentProject.name]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
        setConfirmDeleteProjectId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectActionsDisabled && renameValue.trim()) {
      onRenameProject(renameValue.trim());
      setIsProjectMenuOpen(false);
    }
  };

  return (
    <header className="min-h-12 py-2 md:py-0 md:h-12 gap-2 flex-wrap md:flex-nowrap bg-[#11141d] border-b border-[#212638] px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Brand & Multi-Project Dropdown */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 px-2 py-1 rounded-lg">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-xs tracking-wider uppercase text-indigo-300 hidden md:inline">
            GameForge
          </span>
        </div>

        {/* Project Selector Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            disabled={projectActionsDisabled}
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center space-x-1.5 bg-[#181c29] px-2.5 py-1 rounded-lg border border-[#272e42] hover:border-[#384261] transition text-xs font-semibold text-zinc-100"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="max-w-[130px] sm:max-w-[200px] truncate">{currentProject.name}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {isProjectMenuOpen && !projectActionsDisabled && (
            <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#141826] border border-[#273048] rounded-xl shadow-2xl p-3 z-50 space-y-3">
              <form onSubmit={handleRenameSubmit} className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  Rename Current Project
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Project Title..."
                  className="w-full bg-[#0d0f17] border border-[#232a3e] rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </form>

              <div className="flex justify-between items-center pt-1 border-t border-[#232a3e]">
                <span className="text-[11px] font-bold text-zinc-400">All Projects ({allProjects.length})</span>
                <button
                  onClick={() => {
                    onNewProject();
                    setIsProjectMenuOpen(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold px-2 py-1 rounded-md transition flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Project</span>
                </button>
              </div>

              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {allProjects.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition ${
                      p.id === currentProject.id
                        ? 'bg-indigo-600/25 border border-indigo-500/40 text-white font-medium'
                        : 'hover:bg-[#1c2234] text-zinc-300'
                    }`}
                  >
                    <span
                      onClick={() => {
                        onSelectProject(p.id);
                        setIsProjectMenuOpen(false);
                      }}
                      className="truncate flex-1 pr-2"
                    >
                      {p.name}
                    </span>
                    {allProjects.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirmDeleteProjectId === p.id) {
                            onDeleteProject(p.id);
                            setConfirmDeleteProjectId(null);
                          } else {
                            setConfirmDeleteProjectId(p.id);
                            setTimeout(() => setConfirmDeleteProjectId((curr) => (curr === p.id ? null : curr)), 3500);
                          }
                        }}
                        className={`p-0.5 rounded transition ${
                          confirmDeleteProjectId === p.id
                            ? 'text-rose-400 bg-rose-500/20 px-1 text-[10px] font-bold'
                            : 'text-zinc-500 hover:text-rose-400'
                        }`}
                        title={confirmDeleteProjectId === p.id ? 'Click again to confirm delete' : `Delete project "${p.name}"`}
                      >
                        {confirmDeleteProjectId === p.id ? 'Confirm?' : <Trash2 className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auto-save status */}
        <div className="hidden lg:flex items-center space-x-1.5 text-[11px] text-zinc-400 bg-[#161a26] px-2 py-0.5 rounded-md border border-[#212638]">
          {autoSaveStatus === 'saving' ? (
            <>
              <Clock className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-300">Saving...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className={autoSaveStatus === 'dirty' ? 'text-amber-300' : 'text-emerald-400 font-medium'}>{autoSaveStatus === 'dirty' ? 'Save failed' : durableStorage ? 'Saved to server' : 'Saved in browser'}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Engine Selector, Snapshots, Export, Guide */}
      <div className="flex items-center space-x-2">
        {/* Target Engine Dropdown */}
        <div className="flex items-center space-x-1.5 bg-[#181c29] px-2 py-0.5 rounded-lg border border-[#272e42]">
          <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <select
            disabled={projectActionsDisabled}
            value={targetEngineId}
            onChange={(e) => onTargetEngineChange(e.target.value as TargetEngineId)}
            className="bg-[#121520] text-xs font-medium text-zinc-200 focus:outline-none rounded px-1.5 py-0.5 border border-[#2d344b] cursor-pointer hover:border-indigo-500/50 transition max-w-[140px] sm:max-w-none"
          >
            {TARGET_ENGINES.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.name}
              </option>
            ))}
          </select>
        </div>

        {/* Snapshots Button */}
        <button
          disabled={projectActionsDisabled}
          onClick={onOpenSnapshotsModal}
          className="bg-[#181c29] hover:bg-[#202638] text-zinc-300 border border-[#272e42] px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
          title="Version history checkpoints"
        >
          <History className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden xl:inline">Snapshots</span>
        </button>

        {/* Save & Export Button */}
        <button
          onClick={onOpenExportModal}
          className="bg-[#1e2436] hover:bg-[#273048] text-indigo-200 border border-indigo-500/30 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition shadow-sm"
          title="Export project to JSON, Markdown, or full Zip bundle"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span>Export</span>
        </button>

        {/* API Key (web-only deployments) */}
        <button
          onClick={onOpenApiKeyModal}
          className="bg-[#181c29] hover:bg-[#202638] text-zinc-300 border border-[#272e42] px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
          title="Configure your OpenAI API key for static (web-only) deployments"
        >
          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xl:inline">API Key</span>
        </button>

        {/* Compatibility Guide */}
        <button
          onClick={onOpenCompatibilityModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-md shadow-indigo-600/20"
          title="Learn how saving and compatibility work"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guide</span>
        </button>
      </div>
    </header>
  );
};


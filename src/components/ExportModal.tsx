import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileArchive,
  FileJson,
  FileText,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { ProjectData, TargetEngine, WikiPage } from '../types';
import { createProjectBackup } from '../utils/projectData';
import { downloadJsonFile, downloadMarkdownFile, exportFullProjectZip } from '../utils/exportUtils';

interface ExportModalProps {
  project: ProjectData;
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  pages: WikiPage[];
  notepad: string;
  targetEngine: TargetEngine;
  activeWikiPage: WikiPage | null;
  onImportProject: (importedData: any) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  isOpen,
  onClose,
  projectName,
  pages,
  notepad,
  targetEngine,
  activeWikiPage,
  onImportProject
}) => {
  const [copiedPage, setCopiedPage] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleZipExport = async () => {
    try {
      setIsZipping(true);
      await exportFullProjectZip(projectName, pages, notepad, targetEngine, project);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsZipping(false);
    }
  };

  const handleJsonExport = () => {
    const backupData = createProjectBackup(project);
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Game_Project';
    downloadJsonFile(`${safeName}_Backup.json`, backupData);
  };

  const handleDownloadActivePage = () => {
    if (!activeWikiPage) return;
    const safeTitle = activeWikiPage.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'wiki_page';
    downloadMarkdownFile(`${safeTitle}.md`, activeWikiPage.content);
  };

  const handleCopyActivePage = () => {
    if (!activeWikiPage) return;
    navigator.clipboard.writeText(activeWikiPage.content);
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.pages || !Array.isArray(parsed.pages)) {
          throw new Error('Invalid project file: missing pages array.');
        }
        onImportProject(parsed);
        onClose();
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse JSON file.');
      }
    };
    reader.onerror = () => setImportError('The backup file could not be read. Choose it again or restore another copy.');
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121624] border border-[#273048] rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#232a3e] flex items-center justify-between bg-[#151a2c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Save & Export Workspace
              </h2>
              <p className="text-xs text-zinc-400">
                Download your project in full fidelity or backup for safe keeping.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-[#20273c] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {importError && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center space-x-2 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {/* Option 1: Full Zip Bundle (Recommended) */}
          <div className="bg-[#161a2c] border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between hover:border-indigo-500/50 transition">
            <div className="space-y-1 pr-4">
              <div className="flex items-center space-x-2">
                <FileArchive className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-zinc-100">
                  Full Project GDD Bundle (.zip)
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Recommended
                </span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Contains all {pages.length} wiki pages as clean Markdown (<code className="text-indigo-300 font-mono">/docs</code>), private notes (<code className="text-indigo-300 font-mono">/notes</code>), starter scripts for <strong>{targetEngine.name}</strong> (<code className="text-indigo-300 font-mono">/starter_code</code>), and project manifest.
              </p>
            </div>
            <button
              onClick={handleZipExport}
              disabled={isZipping}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition shrink-0 flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
            >
              <Download className="w-4 h-4" />
              <span>{isZipping ? 'Generating...' : 'Download .zip'}</span>
            </button>
          </div>

          {/* Option 2: Full State JSON */}
          <div className="bg-[#141828] border border-[#262f48] rounded-xl p-4 flex items-center justify-between hover:border-[#384469] transition">
            <div className="space-y-1 pr-4">
              <div className="flex items-center space-x-2">
                <FileJson className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-zinc-100">
                  Project Backup File (.json)
                </span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Portable single-file backup. Useful for restoring state into GameForge on any device or version control.
              </p>
            </div>
            <button
              onClick={handleJsonExport}
              className="bg-[#1f2538] hover:bg-[#28314a] text-zinc-200 border border-[#303a58] font-semibold px-4 py-2 rounded-lg transition shrink-0 flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export .json</span>
            </button>
          </div>

          {/* Option 3: Active Page Markdown */}
          {activeWikiPage && (
            <div className="bg-[#141828] border border-[#262f48] rounded-xl p-4 flex items-center justify-between hover:border-[#384469] transition">
              <div className="space-y-1 pr-4">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-zinc-100">
                    Current Page: "{activeWikiPage.title}" (.md)
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Export just the currently open GDD page as an isolated Markdown file.
                </p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleCopyActivePage}
                  className="bg-[#1f2538] hover:bg-[#28314a] text-zinc-200 border border-[#303a58] font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5"
                >
                  {copiedPage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPage ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadActivePage}
                  className="bg-[#1f2538] hover:bg-[#28314a] text-zinc-200 border border-[#303a58] font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>
          )}

          {/* Restore / Import */}
          <div className="pt-2 border-t border-[#232a3e] flex items-center justify-between">
            <div>
              <span className="font-semibold text-zinc-200">Need to restore a saved project?</span>
              <p className="text-zinc-500 text-[11px]">Upload a previously exported project JSON backup.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1b2032] hover:bg-[#232a42] text-zinc-300 border border-[#2b3552] text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Import Project (.json)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#232a3e] bg-[#151a2c] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1e2436] hover:bg-[#273048] text-zinc-300 text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


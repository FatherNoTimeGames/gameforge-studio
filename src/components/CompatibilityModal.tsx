import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  HardDrive,
  Cpu,
  FileText,
  Boxes,
  Code2,
  CheckCircle2,
  Sparkles,
  Database
} from 'lucide-react';
import { COMPATIBILITY_GUIDES } from '../data/initialData';

interface CompatibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatgptMode?: boolean;
}

export const CompatibilityModal: React.FC<CompatibilityModalProps> = ({
  isOpen,
  onClose,
  chatgptMode = false
}) => {
  const [activeTab, setActiveTab] = useState<'saving' | 'engines' | 'docs' | 'workflow'>('saving');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121624] border border-[#273048] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#232a3e] flex items-center justify-between bg-[#151a2c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                How It Works: Saving & Compatibility Guide
              </h2>
              <p className="text-xs text-zinc-400">
                Complete guide to local persistence, game engine export, and markdown portability.
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#232a3e] bg-[#111422] px-6">
          <button
            onClick={() => setActiveTab('saving')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'saving'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>How Saving Works</span>
          </button>
          <button
            onClick={() => setActiveTab('engines')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'engines'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Engine Compatibility Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'docs'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Markdown & Obsidian Portability</span>
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'workflow'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Grounding Pipeline</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-zinc-300 leading-relaxed">
          {activeTab === 'saving' && (
            <div className="space-y-5">
              <div className="bg-[#171c2c] border border-indigo-500/20 rounded-xl p-4 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-zinc-100 mb-1">
                    Save, Restore, and Back Up Your Work
                  </h3>
                  <p className="text-zinc-300">
                    Auto-save, snapshots, and full exports help protect your work. Keep downloaded backups for important milestones.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#151928] border border-[#262f48] rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                    <Database className="w-4 h-4" />
                    <h4>1. Instant Auto-Save</h4>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Your GDD wiki and notes save automatically. With cloud storage, phone and tablet edits update the latest workspace without a device-conflict warning. Unrelated edits stay intact; the last submitted edit wins on the same field. Open devices refresh about every two seconds, preserving unsent typing. Pending changes stay in this browser and retry on reconnecting. Wait for the saved indicator before closing the app.
                  </p>
                </div>

                <div className="bg-[#151928] border border-[#262f48] rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                    <HardDrive className="w-4 h-4" />
                    <h4>2. Named Snapshots</h4>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Create named version checkpoints (e.g. <em>"v0.3 before boss rework"</em>) directly in the app. Revert to any prior snapshot with one click if an experiment doesn't pan out.
                  </p>
                </div>

                <div className="bg-[#151928] border border-[#262f48] rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <Boxes className="w-4 h-4" />
                    <h4>3. Complete Export</h4>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Export a standalone <code className="text-emerald-300 font-mono">.zip</code> containing standard Markdown files, starter code, and a JSON manifest. Zero vendor lock-in.
                  </p>
                </div>
              </div>

              <div className="bg-[#141827] border border-[#242c44] rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-zinc-100">Backup & Restore Instructions</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                  <li>Click <strong>Save & Export</strong> in the top header.</li>
                  <li>Click <strong>Download Full Project (.zip)</strong> to get all GDD markdown files and starter code.</li>
                  <li>Click <strong>Export Project (.json)</strong> to get a portable raw state file that you can restore anywhere using <strong>Import Project</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'engines' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-bold text-sm text-zinc-100 mb-1">
                  Engine-Specific Code Generation
                </h3>
                <p className="text-zinc-400">
                  When you ask the <strong>Code Teacher</strong> to generate code, it adapts its patterns to modern best practices for your selected target engine:
                </p>
              </div>

              <div className="space-y-4">
                {COMPATIBILITY_GUIDES.map((guide, idx) => (
                  <div key={idx} className="bg-[#151928] border border-[#262f48] rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-zinc-200 text-sm flex items-center space-x-2">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      <span>{guide.feature}</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-[#0e1018] p-3 rounded-lg border border-[#20273c]">
                        <span className="text-indigo-400 font-bold block mb-1">Godot 4 (GDScript 2.0)</span>
                        <pre className="text-zinc-300 whitespace-pre-wrap">{guide.godot4}</pre>
                      </div>

                      <div className="bg-[#0e1018] p-3 rounded-lg border border-[#20273c]">
                        <span className="text-purple-400 font-bold block mb-1">Unity (C# .NET)</span>
                        <pre className="text-zinc-300 whitespace-pre-wrap">{guide.unity}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-[#151928] border border-[#262f48] rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-sm text-zinc-100">
                  Universal Markdown Compatibility (Obsidian, Notion, Git)
                </h3>
                <p className="text-zinc-300 leading-relaxed">
                  Every wiki page in GameForge is pure <strong>GitHub Flavored Markdown (GFM)</strong> with standard YAML frontmatter.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#141827] border border-[#242c44] rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-zinc-200 flex items-center space-x-2">
                    <Boxes className="w-4 h-4 text-indigo-400" />
                    <span>Drop into Obsidian</span>
                  </h4>
                  <p className="text-zinc-400 text-xs">
                    Export the ZIP bundle and extract the <code className="text-indigo-300 font-mono">/docs</code> folder right into your Obsidian vault. All headings, tables, formulas, and checklists render natively.
                  </p>
                </div>

                <div className="bg-[#141827] border border-[#242c44] rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-zinc-200 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>Drop into Godot / Unity Docs</span>
                  </h4>
                  <p className="text-zinc-400 text-xs">
                    Drop the folder into <code className="text-purple-300 font-mono">res://docs/</code> in Godot or commit it to your team's Git repository. Keeps design documentation in sync with codebase version control.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div className="bg-[#151928] border border-[#262f48] rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-sm text-zinc-100">
                  How Grounding Works
                </h3>
                <p className="text-zinc-300 leading-relaxed">
                  {chatgptMode ? 'GameForge saves relevant wiki pages and summaries with each task. Copy its instruction into ChatGPT with the GameForge plugin connected, then return here for the reply. Your ChatGPT conversation controls the model and reasoning setting.' : 'GameForge sends relevant wiki pages and summaries as project context to GPT-6.1 Sol with high reasoning and standard processing.'} AI verification still requires your review.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-[#131624] rounded-lg border border-[#21273c]">
                  <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <div>
                    <strong className="text-zinc-200">GDD Ground Truth Injection:</strong> All wiki pages are concatenated with structured page headers and token estimates.
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-[#131624] rounded-lg border border-[#21273c]">
                  <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <div>
                    <strong className="text-zinc-200">Context Size Estimation:</strong> Token figures estimate wiki text size. Requests use relevant pages, summaries and recent chat. Available context depends on the selected model; the estimate does not guarantee that a request fits.
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-[#131624] rounded-lg border border-[#21273c]">
                  <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <div>
                    <strong className="text-zinc-200">1-Click Merge:</strong> When the Code Teacher or Concept Assistant proposes an improvement, click <em>Append to Page</em> to instantly fold it into your GDD wiki.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#232a3e] bg-[#151a2c] flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 py-2 rounded-lg transition"
          >
            Got it, Let's Build
          </button>
        </div>
      </div>
    </div>
  );
};


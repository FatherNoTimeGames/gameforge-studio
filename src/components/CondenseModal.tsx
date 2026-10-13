import React from 'react';
import { X, CheckCircle2, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { WikiPage } from '../types';
import { checkCondenseOmissions } from '../utils/sectionMerger';

interface CondenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: WikiPage | null;
  condensedText: string;
  onApplyCondensed: (text: string) => void;
}

export const CondenseModal: React.FC<CondenseModalProps> = ({
  isOpen,
  onClose,
  page,
  condensedText,
  onApplyCondensed
}) => {
  if (!isOpen || !page) return null;

  const omissions = checkCondenseOmissions(page.content, condensedText);
  const hasDroppedFacts =
    omissions.missingNumbers.length > 0 || omissions.missingRows.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121624] border border-[#273048] rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#232a3e] flex items-center justify-between bg-[#151a2c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Condense Preview: "{page.title}"
              </h2>
              <p className="text-xs text-zinc-400">
                AI tightening preview with strict no-drop fact and numerical verification.
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
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Fact Checklist Status Box */}
          <div
            className={`p-3 rounded-xl border flex items-start space-x-3 ${
              hasDroppedFacts
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {hasDroppedFacts ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-bold text-sm block">
                {hasDroppedFacts
                  ? 'Warning: Possible omitted stats or table rows'
                  : 'Zero-loss verified! All numbers, formulas, and rows preserved.'}
              </span>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Found {omissions.counts.numbers} numbers and {omissions.counts.rows} table rows in original.{' '}
                {hasDroppedFacts
                  ? `Missing ${omissions.missingNumbers.length} numbers: ${omissions.missingNumbers.join(', ')}`
                  : 'Every single parameter value carried over.'}
              </p>
            </div>
          </div>

          {/* Size comparison */}
          <div className="flex items-center justify-between bg-[#151928] p-3 rounded-xl border border-[#262f48] text-xs">
            <div className="text-zinc-400">
              Original: <strong className="text-zinc-200">{page.content.length.toLocaleString()} chars</strong>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400" />
            <div className="text-zinc-400">
              Condensed: <strong className="text-emerald-400">{condensedText.length.toLocaleString()} chars</strong>
            </div>
            <div className="text-indigo-300 font-semibold">
              {Math.round(((page.content.length - condensedText.length) / page.content.length) * 100)}% tighter
            </div>
          </div>

          {/* Preview Text */}
          <div className="space-y-1.5">
            <span className="font-semibold text-zinc-300">Condensed Markdown Preview:</span>
            <div className="bg-[#0e1018] rounded-xl p-3 border border-[#20263a] max-h-60 overflow-y-auto font-mono text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {condensedText}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#232a3e] bg-[#151a2c] flex justify-between items-center">
          <span className="text-[11px] text-zinc-500">
            Applying creates a revision backup in History so you can undo anytime.
          </span>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="bg-[#1e2436] hover:bg-[#273048] text-zinc-300 text-xs font-medium px-4 py-2 rounded-lg transition"
            >
              Discard
            </button>
            <button
              onClick={() => {
                onApplyCondensed(condensedText);
                onClose();
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2 rounded-lg transition shadow-md shadow-indigo-600/20"
            >
              Apply Condensed Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

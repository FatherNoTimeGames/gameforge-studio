import React, { useMemo } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { WikiPage } from '../types';
import { mergeSections, parseWikiEditBlocks } from '../utils/sectionMerger';

interface SectionApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawAssistantText: string;
  pages: WikiPage[];
  onApplyPlan: (plan: { pageId: string; title: string; newContent: string; isNew: boolean }[]) => void;
}

export const SectionApplyModal: React.FC<SectionApplyModalProps> = ({
  isOpen,
  onClose,
  rawAssistantText,
  pages,
  onApplyPlan
}) => {
  const editBlocks = useMemo(() => {
    return parseWikiEditBlocks(rawAssistantText);
  }, [rawAssistantText]);

  const plans = useMemo(() => {
    return editBlocks.map((block) => {
      const existing = pages.find((p) => p.title.toLowerCase() === block.title.toLowerCase());
      if (!existing) {
        return {
          title: block.title,
          isNew: true,
          pageId: `page-${crypto.randomUUID()}`,
          mergedContent: block.body,
          replacedSections: [],
          addedSections: ['Full Page']
        };
      }

      const mergeResult = mergeSections(existing.content, block.body);
      return {
        title: existing.title,
        isNew: false,
        pageId: existing.id,
        mergedContent: mergeResult.merged,
        replacedSections: mergeResult.replaced,
        addedSections: mergeResult.added
      };
    });
  }, [editBlocks, pages]);

  if (!isOpen) return null;

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
                Apply Section-Level Wiki Updates
              </h2>
              <p className="text-xs text-zinc-400">
                Preview exact section merges before updating your GDD library.
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
          {plans.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 border border-dashed border-[#232a3c] rounded-xl">
              <p>No parseable wiki page blocks found in this message.</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Make sure the assistant output starts with "# Title" or includes "Paste into: Page Title".
              </p>
            </div>
          ) : (
            plans.map((pl, idx) => (
              <div
                key={idx}
                className="bg-[#141827] border border-[#242c44] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-zinc-100 text-sm">{pl.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        pl.isNew
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {pl.isNew ? 'New Page' : 'Existing Page Update'}
                    </span>
                  </div>
                </div>

                {!pl.isNew && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {pl.replacedSections.length > 0 && (
                      <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Replaced: {pl.replacedSections.join(', ')}
                      </span>
                    )}
                    {pl.addedSections.length > 0 && (
                      <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Added: {pl.addedSections.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                <div className="bg-[#0e1018] rounded-xl p-3 border border-[#20263a] max-h-48 overflow-y-auto font-mono text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {pl.mergedContent}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#232a3e] bg-[#151a2c] flex justify-between items-center">
          <span className="text-[11px] text-zinc-500">
            Existing text is preserved in page revision history.
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
                onApplyPlan(
                  plans.map((p) => ({
                    pageId: p.pageId,
                    title: p.title,
                    newContent: p.mergedContent,
                    isNew: p.isNew
                  }))
                );
                onClose();
              }}
              disabled={plans.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs px-5 py-2 rounded-lg transition shadow-md shadow-indigo-600/20 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply {plans.length} Page Update(s)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


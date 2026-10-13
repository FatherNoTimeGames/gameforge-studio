import React from 'react';
import { X, Clock, RotateCcw, FileText } from 'lucide-react';
import { PageHistoryItem, WikiPage } from '../types';

interface PageHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: WikiPage | null;
  onRestoreHistory: (item: PageHistoryItem) => void;
}

export const PageHistoryModal: React.FC<PageHistoryModalProps> = ({
  isOpen,
  onClose,
  page,
  onRestoreHistory
}) => {
  if (!isOpen || !page) return null;

  const history = page.history || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121624] border border-[#273048] rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#232a3e] flex items-center justify-between bg-[#151a2c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Revision History: "{page.title}"
              </h2>
              <p className="text-xs text-zinc-400">
                Earlier revisions are automatically preserved whenever this page is overwritten or edited.
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

        {/* List of Revisions */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {history.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 border border-dashed border-[#232a3c] rounded-xl">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No earlier revisions recorded yet for this page.</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Saving changes, applying AI edits, or building will store prior states here.
              </p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#141827] border border-[#242c44] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-zinc-200">Revision #{history.length - idx}</span>
                    <span className="text-zinc-500 text-[11px]">
                      {new Date(item.at).toLocaleString()}
                    </span>
                    <span className="text-zinc-500 text-[11px] font-mono">
                      ({item.content.length.toLocaleString()} chars)
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onRestoreHistory(item);
                      onClose();
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 text-xs shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore this Revision</span>
                  </button>
                </div>

                <div className="bg-[#0e1018] rounded-lg p-3 border border-[#20263a] max-h-40 overflow-y-auto font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {item.content.slice(0, 1500)}
                  {item.content.length > 1500 && '... [truncated]'}
                </div>
              </div>
            ))
          )}
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

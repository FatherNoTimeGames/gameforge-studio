import React, { useState } from 'react';
import {
  X,
  History,
  Plus,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { Snapshot } from '../types';

interface SnapshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: Snapshot[];
  onCreateSnapshot: (name: string) => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

export const SnapshotsModal: React.FC<SnapshotsModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot
}) => {
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapshotName.trim()) return;
    onCreateSnapshot(newSnapshotName.trim());
    setNewSnapshotName('');
  };

  const handleRestore = (snap: Snapshot) => {
    if (confirmRestoreId === snap.id) {
      onRestoreSnapshot(snap);
      setRestoredId(snap.id);
      setConfirmRestoreId(null);
      setTimeout(() => setRestoredId(null), 1500);
    } else {
      setConfirmRestoreId(snap.id);
      setConfirmDeleteId(null);
      setTimeout(() => setConfirmRestoreId((curr) => (curr === snap.id ? null : curr)), 4000);
    }
  };

  const handleDelete = (snapId: string) => {
    if (confirmDeleteId === snapId) {
      onDeleteSnapshot(snapId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(snapId);
      setConfirmRestoreId(null);
      setTimeout(() => setConfirmDeleteId((curr) => (curr === snapId ? null : curr)), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121624] border border-[#273048] rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#232a3e] flex items-center justify-between bg-[#151a2c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Version History & Snapshots
              </h2>
              <p className="text-xs text-zinc-400">
                Create milestone checkpoints to experiment fearlessly with your game mechanics.
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
        <div className="p-6 space-y-5 text-xs">
          {/* Create new snapshot */}
          <form onSubmit={handleCreate} className="flex items-center space-x-2">
            <input
              type="text"
              value={newSnapshotName}
              onChange={(e) => setNewSnapshotName(e.target.value)}
              placeholder="e.g. 'v0.2 Before boss rework', 'Stamina cost overhaul'..."
              className="flex-1 bg-[#0d0f17] border border-[#232a3e] rounded-lg px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!newSnapshotName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Snapshot</span>
            </button>
          </form>

          {/* List of snapshots */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 border border-dashed border-[#242c44] rounded-xl p-6">
                <Bookmark className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No snapshots created yet. Create a checkpoint anytime before overhauling major systems.</p>
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="bg-[#151928] border border-[#242c42] rounded-xl p-3 flex items-center justify-between hover:border-[#333d5e] transition"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-zinc-100 text-xs block">
                      {snap.name}
                    </span>
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{new Date(snap.timestamp).toLocaleString()}</span>
                      </span>
                      <span>•</span>
                      <span>{snap.pageCount} pages</span>
                    </div>
                  </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => handleRestore(snap)}
                      className={`px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 cursor-pointer text-xs ${
                        confirmRestoreId === snap.id
                          ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
                          : 'bg-[#1f263a] hover:bg-[#28324e] text-zinc-200 border border-[#2e3957]'
                      }`}
                      title="Revert project to this snapshot"
                    >
                      {restoredId === snap.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Restored</span>
                        </>
                      ) : confirmRestoreId === snap.id ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span className="text-amber-300 font-semibold">Confirm Revert?</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                          <span>Revert</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(snap.id)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        confirmDeleteId === snap.id
                          ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50 text-[10px] px-2 font-bold'
                          : 'text-zinc-500 hover:text-rose-400'
                      }`}
                      title="Delete snapshot"
                    >
                      {confirmDeleteId === snap.id ? 'Delete?' : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#232a3e] bg-[#151a2c] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1e2436] hover:bg-[#273048] text-zinc-300 text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

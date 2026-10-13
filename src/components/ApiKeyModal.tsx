import React, { useState } from 'react';
import { KeyRound, ExternalLink, CheckCircle2, X, Trash2 } from 'lucide-react';
import { getLocalApiKey, setLocalApiKey } from '../services/config';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ open, onClose }) => {
  const [value, setValue] = useState(() => getLocalApiKey());
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    setLocalApiKey(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setLocalApiKey('');
    setValue('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#161a26] border border-[#2d344b] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">OpenAI API Key (Web-only mode)</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          When this app is deployed as a static website (no server), your key is used directly from
          this browser and stored only in <span className="text-zinc-200">localStorage</span>. Server hosting should use its secret settings instead. API usage is billed separately from ChatGPT; create a key here:
        </p>

        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
        >
          <span>OpenAI Platform — Create API key</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-..."
          className="w-full bg-[#121520] border border-[#2d344b] focus:border-indigo-500/60 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {saved && (
              <span className="flex items-center space-x-1 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved locally</span>
              </span>
            )}
            {getLocalApiKey() && !saved && (
              <button
                onClick={handleClear}
                className="flex items-center space-x-1 text-[11px] text-rose-400 hover:text-rose-300 transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear key</span>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-[#1e2436] hover:bg-[#273048] border border-[#272e42] transition"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
            >
              Save key
            </button>
          </div>
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed border-t border-[#212638] pt-3">
          Note: if the app is deployed with a server proxy (Express / Vercel / Netlify functions) and a
          server-side OPENAI_API_KEY is configured, the proxy is always preferred and no browser key is
          needed.
        </p>
      </div>
    </div>
  );
};


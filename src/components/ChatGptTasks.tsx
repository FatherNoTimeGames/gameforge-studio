import { useCallback, useEffect, useState } from 'react';
import { REQUEST_EVENT, requestApi, requestInstruction, stopWaiting, type ChatGptJob } from '../services/chatgptBridge';

export function ChatGptTasks() {
  const [jobs, setJobs] = useState<ChatGptJob[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reply, setReply] = useState('');
  const refresh = useCallback(async () => {
    try { setJobs((await requestApi('')).requests); setError(''); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 15_000);
    const onRequest = (event: Event) => {
      const id = (event as CustomEvent).detail;
      if (id) { setSelected(id); setOpen(true); setReply(''); setNotice(''); }
      void refresh();
    };
    window.addEventListener(REQUEST_EVENT, onRequest);
    return () => { clearInterval(timer); window.removeEventListener(REQUEST_EVENT, onRequest); };
  }, [refresh]);
  const run = async (action: () => Promise<void>) => {
    try { await action(); setError(''); await refresh(); } catch (e: any) { setError(e.message); }
  };
  const current = jobs.find((j) => j.id === selected);
  const pending = jobs.filter((j) => j.state === 'pending').length;
  return <>
    <div className="shrink-0 px-3 py-1.5 bg-indigo-950 text-indigo-100 text-xs flex gap-3 items-center">
      <span className="flex-1">AI runs in your connected ChatGPT conversation.</span>
      <button className="underline" onClick={() => { setOpen(true); void refresh(); }}>ChatGPT tasks{pending ? ` (${pending})` : ''}</button>
      <a className="underline" href="/signout-with-chatgpt?return_to=/" target="_top">Sign out</a>
    </div>
    {open && <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3">
      <section role="dialog" aria-modal="true" aria-label="ChatGPT tasks" className="bg-[#141827] text-zinc-100 border border-indigo-500/30 rounded-xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4">
        <div className="flex justify-between gap-4 mb-3"><h2 className="font-semibold">ChatGPT tasks</h2><button aria-label="Close ChatGPT tasks" onClick={() => setOpen(false)}>Close</button></div>
        <p className="text-sm text-zinc-300 mb-3">Copy the instruction below, open ChatGPT with the GameForge plugin connected, and send it. Return here to pick up the reply. Choose your model and reasoning setting in ChatGPT.</p>
        <p className="text-xs text-zinc-400 mb-3">Keep this page open during an action. If you close it, return to the same project and retry the same action. Some workflows create several tasks, one at a time.</p>
        {error && <p role="alert" className="text-amber-300 mb-3">{error}</p>}
        {notice && <p role="status" className="text-emerald-300 mb-3">{notice}</p>}
        <label className="block text-xs mb-1" htmlFor="chatgpt-task">Saved task</label>
        <select id="chatgpt-task" className="w-full bg-zinc-900 p-2 rounded mb-3" value={selected} onChange={(e) => { setSelected(e.target.value); setReply(''); setNotice(''); }}>
          <option value="">Select a task</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{new Date(j.created_at).toLocaleString()} — {j.state} — {j.id.slice(0, 8)}</option>)}
        </select>
        {selected && <>
          <textarea aria-label="Instruction to send in ChatGPT" readOnly value={requestInstruction(selected)} className="w-full bg-zinc-900 p-2 text-xs rounded h-28 mb-2" />
          <div className="flex gap-3 flex-wrap text-sm mb-4">
            <button className="bg-indigo-600 px-3 py-2 rounded" onClick={() => void run(async () => { await navigator.clipboard.writeText(requestInstruction(selected)); setNotice('Instruction copied. Paste it into ChatGPT.'); })}>Copy instruction</button>
            <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="bg-zinc-700 px-3 py-2 rounded">Open ChatGPT</a>
            {current?.state === 'pending' && <button className="underline" onClick={() => { stopWaiting(selected); setNotice('Task kept. Retry the same action to resume.'); }}>Stop waiting</button>}
            {current?.state !== 'pending' && <>
              <button className="underline" onClick={() => void run(async () => { setReply((await requestApi(`/${selected}`)).text ?? ''); })}>View saved reply</button>
              <button className="underline" onClick={() => void run(async () => { await requestApi(`/${selected}/recover`, { method: 'POST', body: '{}' }); setNotice('Reply ready again. Retry the same action in the same project to apply it.'); })}>Recover reply</button>
            </>}
            <button className="text-red-300 underline" onClick={() => { if (window.confirm('Delete this saved task and its reply?')) void run(async () => { stopWaiting(selected); await requestApi(`/${selected}`, { method: 'DELETE' }); setSelected(''); setReply(''); }); }}>Delete task</button>
          </div>
          {reply && <textarea readOnly aria-label="Saved ChatGPT reply" value={reply} className="w-full bg-zinc-900 p-2 text-xs rounded h-52" />}
        </>}
        {!jobs.length && <p className="text-sm text-zinc-400">Use any AI action in the app to create your first task.</p>}
      </section>
    </div>}
  </>;
}

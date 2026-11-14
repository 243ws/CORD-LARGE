import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Users, ImagePlus, FileText, Clock, CheckCircle2, X, Trash2 } from 'lucide-react';

type Contact = { id: string; username: string; discriminator?: string; avatar?: string | null };
type Draft = {
  id: string;
  recipient: Contact;
  message: string;
  image: File | null;
  imageName: string;
  createdAt: number;
};

type Props = { contacts: Contact[] };

export default function MassDmComposer({ contacts }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [preview, setPreview] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [notice, setNotice] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contacts.filter(contact =>
      !term || contact.username.toLowerCase().includes(term) || contact.id.includes(term)
    );
  }, [contacts, query]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(contact => selected.includes(contact.id));

  const toggle = (id: string) => {
    setSelected(previous => previous.includes(id)
      ? previous.filter(value => value !== id)
      : [...previous, id]
    );
  };

  const toggleVisible = () => {
    setSelected(previous => allVisibleSelected
      ? previous.filter(id => !filtered.some(contact => contact.id === id))
      : Array.from(new Set([...previous, ...filtered.map(contact => contact.id)]))
    );
  };

  const cancelPreparation = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(0);
    setNotice('Draft preparation cancelled.');
  };

  const prepareDrafts = () => {
    if ((!message.trim() && !image) || !selected.length || countdown > 0) return;
    setNotice('');
    setCountdown(3);
    let remaining = 3;

    timerRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;

        const chosen = contacts.filter(contact => selected.includes(contact.id));
        const now = Date.now();
        setDrafts(previous => [
          ...previous,
          ...chosen.map((recipient, index) => ({
            id: `${recipient.id}:${now}:${index}`,
            recipient,
            message: message.trim(),
            image,
            imageName: image?.name || '',
            createdAt: now,
          })),
        ]);
        setPreview(false);
        setNotice(`${chosen.length} local draft(s) prepared. Nothing was sent.`);
      }
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 gap-3">
        <div>
          <h2 className="text-xl font-bold italic font-display text-red-500">Message Draft Builder</h2>
          <p className="text-xs text-white/40 mt-1">Create separate local drafts for contacts already loaded in the app. No messages are sent.</p>
        </div>
        <span className="text-xs rounded-full border border-white/10 px-3 py-1 text-white/60 whitespace-nowrap">{selected.length} selected</span>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Users size={15}/> Loaded DM contacts</h3>
          <button type="button" onClick={toggleVisible} disabled={!filtered.length}
            className="text-xs text-red-300 hover:text-red-200 disabled:opacity-40">
            {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search loaded contacts by username or ID..."
            className="w-full rounded-xl bg-black/40 border border-white/10 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-red-500/50"/>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
          {filtered.length ? filtered.map(contact => (
            <label key={contact.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
              <input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggle(contact.id)} className="accent-red-500"/>
              <img src={contact.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} alt=""
                className="w-8 h-8 rounded-full"/>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-white truncate">{contact.username}</span>
                <span className="block text-[10px] text-white/30">{contact.id}</span>
              </span>
              {selected.includes(contact.id) && <CheckCircle2 size={15} className="text-red-400"/>}
            </label>
          )) : <p className="p-5 text-center text-xs text-white/30">No loaded contacts match. Refresh the Channels tab to update this list.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Message content</h3>
        <textarea value={message} onChange={event => setMessage(event.target.value)} rows={4} maxLength={2000}
          placeholder="Write a message to save as individual drafts..."
          className="w-full resize-y rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-red-500/50"/>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 p-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-white/60 cursor-pointer hover:text-white">
            <ImagePlus size={16}/>
            <span className="truncate">{image ? image.name : 'Attach an image to each draft'}</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={event => setImage(event.target.files?.[0] || null)}/>
          </label>
          {image && <button type="button" onClick={() => setImage(null)} aria-label="Remove image"
            className="text-white/50 hover:text-red-300"><X size={15}/></button>}
        </div>
        {image && <p className="text-[11px] text-white/40">Attached file: {image.name} · {(image.size / 1024 / 1024).toFixed(2)} MB</p>}
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <Clock size={13}/> A 3-second confirmation countdown runs before local drafts are created. No typing simulation or automated delivery.
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!selected.length || (!message.trim() && !image)}
            onClick={() => { setNotice(''); setPreview(true); }}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Review {selected.length} draft(s)
          </button>
          <button type="button" onClick={() => { setSelected([]); setMessage(''); setImage(null); setPreview(false); }}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60">Clear composer</button>
        </div>
      </section>

      {notice && <p role="status" className="text-xs text-emerald-300/80">{notice}</p>}

      {preview && <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Review before preparing</p>
        <p className="text-xs text-white/60">{selected.length} separate local drafts will be added to the queue. No recipient will be contacted.</p>
        <p className="text-xs text-white/40 whitespace-pre-wrap break-words">Message: {message.trim() || '(image only)'}{image ? ` · Image: ${image.name}` : ''}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={prepareDrafts} disabled={countdown > 0}
            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {countdown > 0 ? `Preparing in ${countdown}...` : 'Create local drafts (3s)'}
          </button>
          {countdown > 0 && <button type="button" onClick={cancelPreparation}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Cancel</button>}
          <button type="button" onClick={() => setPreview(false)}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Back</button>
        </div>
      </div>}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><FileText size={15}/> Local draft queue</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">{drafts.length} drafts</span>
            {drafts.length > 0 && <button type="button" onClick={() => setDrafts([])}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-red-300"><Trash2 size={12}/> Clear queue</button>}
          </div>
        </div>
        {drafts.length === 0 ? <p className="rounded-xl border border-white/10 p-4 text-xs text-white/30">No drafts prepared yet.</p> :
          <div className="max-h-56 overflow-y-auto space-y-2">
            {drafts.map(draft => (
              <div key={draft.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white">{draft.recipient.username}</p>
                  <p className="text-[10px] text-white/40 truncate">{draft.message || 'Image attachment'}{draft.imageName ? ` · ${draft.imageName}` : ''}</p>
                </div>
                <button type="button" onClick={() => setDrafts(previous => previous.filter(item => item.id !== draft.id))}
                  className="text-[10px] text-white/40 hover:text-red-300">Remove</button>
              </div>
            ))}
          </div>}
      </section>
    </div>
  );
}

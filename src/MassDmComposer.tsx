import React, { useMemo, useState } from 'react';
import { Search, Users, ImagePlus, FileText, Clock, CheckCircle2, X } from 'lucide-react';

type Contact = { id: string; username: string; discriminator?: string; avatar?: string | null };
type Draft = { id: string; recipient: Contact; message: string; image: File | null; imageName: string; createdAt: number };

type Props = { contacts: Contact[] };

export default function MassDmComposer({ contacts }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [preview, setPreview] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const filtered = useMemo(() => contacts.filter(c =>
    c.username.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query)
  ), [contacts, query]);

  const toggle = (id: string) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.includes(c.id));

  const prepareDrafts = () => {
    if ((!message.trim() && !image) || !selected.length || countdown > 0) return;
    setCountdown(3);
    let remaining = 3;
    const timer = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        const chosen = contacts.filter(c => selected.includes(c.id));
        const now = Date.now();
        setDrafts(prev => [...prev, ...chosen.map(recipient => ({
          id: recipient.id + ':' + now + ':' + Math.random().toString(36).slice(2),
          recipient, message: message.trim(), image, imageName: image?.name || '', createdAt: now
        }))]);
        setPreview(false);
      }
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold italic font-display text-red-500">Message Draft Builder</h2>
          <p className="text-xs text-white/40 mt-1">Prepare individual drafts for contacts you choose. Nothing is sent automatically.</p>
        </div>
        <span className="text-xs rounded-full border border-white/10 px-3 py-1 text-white/60">{selected.length} selected</span>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Users size={15}/> Existing DM contacts</h3>
          <button onClick={() => setSelected(allVisibleSelected ? selected.filter(id => !filtered.some(c => c.id === id)) : Array.from(new Set([...selected, ...filtered.map(c => c.id)]))}
            className="text-xs text-red-300 hover:text-red-200">
            {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search username or user ID..."
            className="w-full rounded-xl bg-black/40 border border-white/10 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-red-500/50"/>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
          {filtered.length ? filtered.map(contact => (
            <label key={contact.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
              <input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggle(contact.id)} className="accent-red-500"/>
              <img src={contact.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="w-8 h-8 rounded-full"/>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-white truncate">{contact.username}</span>
                <span className="block text-[10px] text-white/30">{contact.id}</span>
              </span>
              {selected.includes(contact.id) && <CheckCircle2 size={15} className="text-red-400"/>}
            </label>
          )) : <p className="p-5 text-center text-xs text-white/30">No contacts match. Refresh the Channels tab first.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Message content</h3>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={2000}
          placeholder="Write a message to prepare as individual drafts..."
          className="w-full resize-y rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-red-500/50"/>
        <label className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 p-3 text-xs text-white/60 cursor-pointer hover:bg-white/5">
          <ImagePlus size={16}/> {image ? image.name : 'Attach an image to include with each draft'}
          <input type="file" accept="image/*" className="hidden" onChange={e => setImage(e.target.files?.[0] || null)}/>
          {image && <button type="button" onClick={e => { e.preventDefault(); setImage(null); }} className="ml-auto"><X size={14}/></button>}
        </label>
        <div className="flex items-center gap-2 text-[11px] text-white/40"><Clock size={13}/> 3-second review countdown before drafts are created. No typing simulation or automated sending.</div>
        <div className="flex flex-wrap gap-2">
          <button disabled={!selected.length || (!message.trim() && !image)} onClick={() => setPreview(true)}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Review {selected.length} draft(s)</button>
          <button onClick={() => { setSelected([]); setMessage(''); setImage(null); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60">Clear</button>
        </div>
      </section>

      {preview && <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Review before preparing</p>
        <p className="text-xs text-white/60">{selected.length} separate drafts will be added to the local draft queue. No recipient will be contacted.</p>
        <p className="text-xs text-white/40">Message: {message.trim() || '(image only)'} {image ? ' · Image: ' + image.name : ''}</p>
        <div className="flex gap-2">
          <button onClick={prepareDrafts} disabled={countdown > 0} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{countdown > 0 ? `Preparing in ${countdown}...` : 'Create drafts (3s delay)'}</button>
          <button onClick={() => setPreview(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Back</button>
        </div>
      </div>}

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><FileText size={15}/> Local draft queue</h3><span className="text-xs text-white/40">{drafts.length} drafts</span></div>
        {drafts.length === 0 ? <p className="rounded-xl border border-white/10 p-4 text-xs text-white/30">No drafts prepared yet.</p> :
          <div className="max-h-56 overflow-y-auto space-y-2">{drafts.map(d => <div key={d.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
            <div className="min-w-0 flex-1"><p className="text-xs text-white">{d.recipient.username}</p><p className="text-[10px] text-white/40 truncate">{d.message || 'Image attachment'} {d.imageName ? ' · ' + d.imageName : ''}</p></div>
            <button onClick={() => setDrafts(prev => prev.filter(x => x.id !== d.id))} className="text-[10px] text-white/40 hover:text-red-300">Remove</button>
          </div>)}</div>}
      </section>
    </div>
  );
}

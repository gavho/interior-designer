// Catalogue overlay: search and browse every piece, then drop it into a hotbar slot.
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { Glass, Kbd } from './ui.jsx';

export default function Catalog({ I, sb }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState(() => (I.categories.includes('My picks') ? 'My picks' : 'All')), [slot, setSlot] = useState(sb.slot);
  const all = useMemo(() => I.catalog(), []);
  const cats = useMemo(() => ['All', ...I.categories.filter(c => all.some(d => d.cat === c))], []);
  const list = all.filter(d => (q ? `${d.name} ${d.cat}`.toLowerCase().includes(q.toLowerCase()) : cat === 'All' || d.cat === cat));
  const close = () => I.sandbox.setPanel(null);
  const choose = id => { I.sandbox.setSlotType(slot, id); I.sandbox.setSlot(slot); close(); };
  return (
    <Panel onClose={close} title="Catalogue" hint="Pick a piece for the highlighted slot">
      <div className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2">
        <Search size={15} className="text-white/50" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${all.length} pieces…`} className="w-full text-sm text-white placeholder:text-white/40" />
      </div>
      {!q && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-[12px] transition-colors ${cat === c ? 'bg-white text-slate-900' : 'bg-white/8 text-white/75 hover:bg-white/15'}`}>{c}</button>
          ))}
        </div>
      )}
      <div className="mt-3 grid max-h-[46vh] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 overflow-y-auto pr-1">
        {list.map(d => (
          <button key={d.id} onClick={() => choose(d.id)} title={d.note || d.name}
            className="group flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-2 text-center transition-colors hover:bg-white/12">
            <img src={I.thumb(d.id)} alt="" className="h-16 w-16 rounded-lg bg-white/90 object-contain transition-transform group-hover:scale-105" />
            <span className="line-clamp-2 text-[11.5px] leading-tight text-white/90">{d.name}</span>
            <span className="text-[10px] text-white/45">{I.fmtLen(d.w)} × {I.fmtLen(d.d)}</span>
          </button>
        ))}
        {!list.length && <div className="col-span-full py-8 text-center text-sm text-white/50">Nothing matches “{q}”.</div>}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[11.5px] text-white/60">
        Slot
        {sb.bar.map((t, i) => (
          <button key={i} onClick={() => setSlot(i)} title={I.getDef(t).name}
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${slot === i ? 'ring-2 ring-accent bg-accent/25' : 'bg-white/6 hover:bg-white/12'}`}>
            <img src={I.thumb(t)} alt="" className="h-7 w-7 rounded bg-white/90 object-contain" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** Centred frosted panel; Esc or the × closes it. */
export function Panel({ title, hint, onClose, children, width = 'w-[min(760px,92vw)]' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.16 }}
      className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-auto" onMouseDown={e => e.target === e.currentTarget && onClose()}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); } }}>
      <Glass className={`${width} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <div><div className="text-[15px] font-semibold">{title}</div>{hint && <div className="text-[11.5px] text-white/55">{hint}</div>}</div>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"><Kbd>Esc</Kbd><X size={16} /></button>
        </div>
        {children}
      </Glass>
    </motion.div>
  );
}

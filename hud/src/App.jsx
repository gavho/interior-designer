// Walk HUD: mode bar, crosshair read-out, hotbar, minimap, and the catalogue / paint / settings panels.
import { useEffect, useReducer, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Hammer, Hand, Paintbrush, LayoutGrid, Settings as Cog, LogOut, MousePointerClick, Package } from 'lucide-react';
import { Glass, Kbd, Segmented, IconBtn } from './ui.jsx';
import Minimap from './Minimap.jsx';
import Catalog from './Catalog.jsx';
import Paint from './Paint.jsx';
import Settings from './Settings.jsx';
import Sun from './Sun.jsx';

export default function App({ I, pane }) {
  const [, redraw] = useReducer(x => x + 1, 0);
  const [locked, setLocked] = useState(false);
  const [photo, setPhoto] = useState(false);
  useEffect(() => {
    for (const ev of ['walk', 'sb', 'doc', 'prefs']) I.on(ev, redraw);
    I.on('walklock', v => setLocked(v));
    I.on('sbphoto', () => setPhoto(p => !p));
  }, []);
  const sb = I.sandbox.sb, walking = I.S.walk, on = walking && sb.hud;
  useEffect(() => { pane.classList.toggle('hud-on', on); pane.classList.toggle('photo', walking && photo); }, [on, walking, photo]);
  if (!walking) return null;
  if (!sb.hud) return <Glass className="absolute right-3 top-3 px-3 py-1.5 text-xs text-white/70">HUD hidden · <Kbd>Tab</Kbd></Glass>;
  const S = I.sandbox;

  return (
    <>
      {/* top: modes and tools */}
      <div className="absolute inset-x-0 top-3 flex justify-center">
        <Glass className="flex items-center gap-2 p-1.5">
          <Segmented id="mode" value={sb.mode} onChange={S.setMode} options={[
            { value: 'build', label: 'Build', kbd: 'B', icon: <Hammer size={14} /> },
            { value: 'edit', label: 'Move', kbd: 'E', icon: <Hand size={14} /> },
            { value: 'paint', label: 'Paint', kbd: 'P', icon: <Paintbrush size={14} /> },
          ]} />
          <div className="mx-1 h-6 w-px bg-white/15" />
          <IconBtn title={sb.mode === 'paint' ? 'Palette (T)' : 'Catalogue (T)'} active={sb.panel === 'catalog'} onClick={() => S.setPanel(sb.panel === 'catalog' ? null : 'catalog')}><LayoutGrid size={17} /></IconBtn>
          <IconBtn title="Settings (O)" active={sb.panel === 'settings'} onClick={() => S.setPanel(sb.panel === 'settings' ? null : 'settings')}><Cog size={17} /></IconBtn>
          <IconBtn title="Leave walk mode (Esc)" onClick={() => I.api3d.setWalk(false)}><LogOut size={17} /></IconBtn>
        </Glass>
      </div>

      <div className="absolute right-3 top-3"><Minimap I={I} locked={locked} /></div>
      <div className="absolute right-3 top-[204px]"><Sun I={I} /></div>

      <Readout I={I} sb={sb} />

      {/* click-to-capture prompt */}
      <AnimatePresence>
        {!locked && !sb.panel && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[38%] -translate-x-1/2">
            <Glass className="pointer-events-none flex items-center gap-2 px-4 py-2 text-sm text-white/85"><MousePointerClick size={16} /> Click the view to look around · <Kbd>Esc</Kbd> frees the mouse</Glass>
          </motion.div>
        )}
      </AnimatePresence>

      <Hotbar I={I} sb={sb} />
      <Hints sb={sb} />

      <AnimatePresence>
        {sb.panel === 'catalog' && (sb.mode === 'paint' ? <Paint key="p" I={I} sb={sb} /> : <Catalog key="c" I={I} sb={sb} />)}
        {sb.panel === 'settings' && <Settings key="s" I={I} />}
      </AnimatePresence>
    </>
  );
}

/** Under the crosshair: what you are looking at, or what you are carrying. */
function Readout({ I, sb }) {
  const h = sb.hover, carry = sb.carry && I.S.doc.items.find(i => i.id === sb.carry.id);
  let title = '', sub = '';
  if (carry) { title = `Carrying ${carry.name || I.getDef(carry.type).name}`; sub = 'Click to put down · R rotate · right-click cancels'; }
  else if (h?.k === 'item') { const it = I.S.doc.items.find(i => i.id === h.id); if (it) { title = it.name || I.getDef(it.type).name; sub = `${I.fmtLen(it.w)} × ${I.fmtLen(it.d)} × ${I.fmtLen(it.h)}${it.locked ? ' · locked' : ''}`; } }
  else if (h?.k === 'wall') { title = 'Wall'; sub = `${h.side === 'n' ? 'Side A' : 'Side B'} · ${I.fmtLen(h.dist)} away`; }
  else if (h?.k === 'floor') { const r = I.S.rooms.find(r => r.id === h.id); title = r?.meta.name || 'Floor'; sub = r ? `${I.getFloor(r.meta.floor).name} floor` : ''; }
  if (!title) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 mt-6 -translate-x-1/2 text-center">
      <div className="rounded-lg bg-black/45 px-2.5 py-1 backdrop-blur-md">
        <div className="text-[13px] font-semibold">{title}</div>
        {sub && <div className="text-[11px] text-white/70">{sub}</div>}
      </div>
    </div>
  );
}

function Hotbar({ I, sb }) {
  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center">
      <Glass className="flex gap-1.5 p-1.5">
        {sb.bar.map((type, i) => {
          const d = I.getDef(type), on = sb.mode === 'build' && sb.slot === i;
          return (
            <button key={i} title={d.name} onClick={() => I.sandbox.setSlot(i)}
              className={`relative flex h-14 w-14 items-center justify-center rounded-xl transition-all ${on ? 'bg-accent/30 ring-2 ring-accent' : 'bg-white/5 hover:bg-white/10'}`}>
              {type ? <img src={I.thumb(type)} alt="" className="h-11 w-11 rounded-md bg-white/90 object-contain" /> : <Package size={18} className="text-white/40" />}
              <span className="absolute left-1 top-0.5 text-[10px] font-bold text-white/70">{i + 1}</span>
              {on && <motion.span layoutId="slotname" className="absolute -top-7 whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium">{d.name}</motion.span>}
            </button>
          );
        })}
      </Glass>
    </div>
  );
}

function Hints({ sb }) {
  const keys = sb.carry ? [['Click', 'drop'], ['R', 'rotate'], ['Right-click', 'cancel']]
    : { build: [['Click', 'place'], ['R', 'rotate (⇧ 90°)'], ['1–9 / wheel', 'piece'], ['Right-click', 'copy what you see'], ['T', 'catalogue']],
        edit: [['Click', 'pick up'], ['F', 'duplicate'], ['X', 'delete'], ['R', 'rotate'], ['Ctrl+Z', 'undo']],
        paint: [['Click', 'paint wall / floor'], ['Right-click', 'sample colour'], ['T', 'palette']] }[sb.mode];
  return (
    <div className="pointer-events-none absolute bottom-24 left-3 hidden flex-col gap-1 text-[11.5px] text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)] lg:flex">
      {keys.map(([k, v]) => <div key={k} className="flex items-center gap-2"><Kbd>{k}</Kbd>{v}</div>)}
      <div className="mt-1 flex items-center gap-2 text-white/55"><Kbd>WASD</Kbd> move <Kbd>⇧</Kbd> run <Kbd>C</Kbd> crouch <Kbd>N</Kbd> fly <Kbd>Tab</Kbd> HUD <Kbd>F1</Kbd> photo</div>
    </div>
  );
}

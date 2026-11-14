// Walk settings: look feel, field of view, picture quality, and the full key list.
import { useState } from 'react';
import { Panel } from './Catalog.jsx';
import { Kbd } from './ui.jsx';

const KEYS = [['W A S D', 'Move'], ['Shift', 'Run'], ['C', 'Crouch (fly: down)'], ['N', 'Fly on / off'], ['Space', 'Fly: up'], ['Wheel', 'Speed (Build: next piece)'],
  ['B / E / P', 'Build / Move / Paint'], ['1–9', 'Hotbar slot'], ['R', 'Rotate 15° (Shift 90°)'], ['F', 'Duplicate'], ['X / Del', 'Delete'], ['G', 'Grid snap'],
  ['T', 'Catalogue / palette'], ['O', 'Settings'], ['Tab', 'Hide HUD'], ['F1', 'Photo mode'], ['F3', 'Performance'], ['Ctrl+Z / Y', 'Undo / redo'], ['Esc', 'Free mouse, then leave']];

// outside the component, so inputs keep their identity (and a slider drag) across re-renders
const Row = ({ label, children }) => <label className="flex items-center justify-between gap-4 py-1.5 text-[12.5px] text-white/85"><span>{label}</span><span className="flex items-center gap-2">{children}</span></label>;

export default function Settings({ I }) {
  const P = I.S.prefs, [q, setQ] = useState('standard');
  const pref = (k, v) => I.setPref(k, v);
  return (
    <Panel title="Walk settings" onClose={() => I.sandbox.setPanel(null)} width="w-[min(640px,92vw)]">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Row label="Look sensitivity"><input type="range" min="0.3" max="3" step="0.1" value={P.walkSens || 1} onChange={e => pref('walkSens', +e.target.value)} /><span className="w-8 text-right text-white/55">{(P.walkSens || 1).toFixed(1)}</span></Row>
          <Row label="Field of view"><input type="range" min="55" max="100" step="1" value={P.walkFov || 70} onChange={e => { pref('walkFov', +e.target.value); I.api3d.setFov(+e.target.value); }} /><span className="w-8 text-right text-white/55">{P.walkFov || 70}°</span></Row>
          <Row label="Invert mouse Y"><input type="checkbox" checked={!!P.walkInvertY} onChange={e => pref('walkInvertY', e.target.checked)} /></Row>
          <Row label="Snap to grid"><input type="checkbox" checked={!!P.snapGrid} onChange={e => pref('snapGrid', e.target.checked)} /></Row>
          <Row label="Snap to walls"><input type="checkbox" checked={P.magnet !== false} onChange={e => pref('magnet', e.target.checked)} /></Row>
          <div className="mt-3 text-[12px] font-medium text-white/70">Picture</div>
          <Row label="Quality">
            {['standard', 'high'].map(v => <button key={v} onClick={() => { setQ(v); I.api3d.setQuality(v); }} className={`rounded-lg px-2.5 py-1 text-[12px] ${q === v ? 'bg-accent text-white' : 'bg-white/8 hover:bg-white/15'}`}>{v === 'high' ? 'High' : 'Standard'}</button>)}
          </Row>
          <Row label="Lower resolution when slow"><input type="checkbox" checked={P.adaptiveRes !== false} onChange={e => pref('adaptiveRes', e.target.checked)} /></Row>
          <Row label="Performance read-out"><button onClick={() => I.api3d.togglePerf()} className="rounded-lg bg-white/8 px-2.5 py-1 text-[12px] hover:bg-white/15">Toggle <Kbd>F3</Kbd></button></Row>
        </div>
        <div className="max-h-[52vh] overflow-y-auto">
          <div className="mb-1 text-[12px] font-medium text-white/70">Keys</div>
          {KEYS.map(([k, v]) => <div key={k} className="flex items-center justify-between py-1 text-[12px] text-white/80"><span>{v}</span><Kbd>{k}</Kbd></div>)}
        </div>
      </div>
    </Panel>
  );
}

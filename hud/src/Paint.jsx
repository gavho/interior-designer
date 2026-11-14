// Paint palette: the colour walls get and the finish floors get when you click them in Paint mode.
import { Panel } from './Catalog.jsx';

export default function Paint({ I, sb }) {
  const p = sb.paint, set = I.sandbox.setPaint, close = () => I.sandbox.setPanel(null);
  return (
    <Panel title="Paint" hint="Click a wall to paint that side, or a floor to change its finish. Right-click a wall to pick up its colour." onClose={close} width="w-[min(560px,92vw)]">
      <div className="text-[12px] font-medium text-white/70">Wall colour</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {I.swatches.map(c => (
          <button key={c} onClick={() => set({ color: c })} title={c} style={{ background: c }}
            className={`h-8 w-8 rounded-lg border border-white/20 transition-transform hover:scale-110 ${p.color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-black/40' : ''}`} />
        ))}
        <input type="color" value={p.color} onChange={e => set({ color: e.target.value })} title="Any colour" />
      </div>
      <div className="mt-4 text-[12px] font-medium text-white/70">Floor finish</div>
      <div className="mt-2 grid max-h-[30vh] grid-cols-3 gap-1.5 overflow-y-auto">
        {I.floors.map(f => (
          <button key={f.id} onClick={() => set({ floor: f.id })}
            className={`rounded-lg px-2.5 py-1.5 text-left text-[12px] ${p.floor === f.id ? 'bg-accent text-white' : 'bg-white/6 text-white/80 hover:bg-white/12'}`}>{f.name}</button>
        ))}
      </div>
    </Panel>
  );
}

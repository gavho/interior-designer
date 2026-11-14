// Small building blocks in the cult/ui + Watermelon style: frosted glass panels, key caps, an animated segmented control.
import { motion } from 'motion/react';

export const Glass = ({ className = '', children, ...p }) => (
  <div className={`pointer-events-auto rounded-2xl border border-hud-line bg-hud shadow-[0_10px_40px_-10px_rgb(0_0_0/0.55)] backdrop-blur-xl ${className}`} {...p}>{children}</div>
);

export const Kbd = ({ children }) => (
  <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-white/20 bg-white/10 px-1.5 text-[10.5px] font-semibold leading-5 text-white/85 shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]">{children}</kbd>
);

/** Segmented control whose highlight glides between options (shared layout animation). */
export function Segmented({ id, value, options, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-black/25 p-1">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} title={o.title}
          className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${value === o.value ? 'text-white' : 'text-white/60 hover:text-white/90'}`}>
          {value === o.value && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-accent shadow-[0_0_18px_-2px_rgb(79_141_255/0.7)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative flex items-center gap-1.5">{o.icon}{o.label}{o.kbd && <Kbd>{o.kbd}</Kbd>}</span>
        </button>
      ))}
    </div>
  );
}

export const IconBtn = ({ title, onClick, children, active }) => (
  <button title={title} onClick={onClick}
    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${active ? 'bg-accent text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>{children}</button>
);

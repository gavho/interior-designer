// Time-of-day widget: real sun for the site; [ and ] step half an hour, the slider scrubs the day (with the mouse free).
import { useEffect, useState } from 'react';
import { Sun as SunIcon, Moon } from 'lucide-react';
import { Glass, Kbd } from './ui.jsx';

const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export default function Sun({ I }) {
  const [t, setT] = useState(() => I.api3d.getSunTime());
  useEffect(() => {
    I.on('sun', p => setT({ ...p }));
    const key = e => {
      if (!I.S.walk || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const now = I.api3d.getSunTime();
        I.api3d.setSunTime({ minutes: (now.minutes + (e.code === 'BracketRight' ? 30 : -30) + 1440) % 1440 });
        e.preventDefault();
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  const up = t.el > 0;
  return (
    <Glass className="flex items-center gap-2.5 px-3 py-2 text-[12px]">
      {up ? <SunIcon size={16} className="text-amber-300" /> : <Moon size={15} className="text-indigo-200" />}
      <div className="leading-tight">
        <div className="font-semibold tabular-nums">{hhmm(t.minutes)} <span className="font-normal text-white/55">{t.date}</span></div>
        <div className="text-[10.5px] text-white/60">{up ? `${Math.round(t.el)}° up · ${COMPASS[Math.round(t.az / 45) % 8]}` : 'After dark'}</div>
      </div>
      <input type="range" min="0" max="1435" step="5" value={t.minutes} onChange={e => I.api3d.setSunTime({ minutes: +e.target.value })} className="w-28" title="Time of day" />
      <span className="hidden items-center gap-1 text-white/50 xl:flex"><Kbd>[</Kbd><Kbd>]</Kbd></span>
    </Glass>
  );
}

// Plan minimap: rooms, walls, furniture outlines and you (with your view cone). Click it, with the mouse free, to jump there.
import { useEffect, useRef } from 'react';
import { Glass } from './ui.jsx';

const SIZE = 176;
export default function Minimap({ I, locked }) {
  const ref = useRef(null), view = useRef(null);
  useEffect(() => {
    let raf = 0, last = 0;
    const draw = t => {
      raf = requestAnimationFrame(draw);
      if (t - last < 66) return; last = t; // ~15 fps is plenty
      const cv = ref.current; if (!cv || !I.S.walk) return;
      const g = cv.getContext('2d'), dpr = devicePixelRatio || 1, b = I.bounds(), pad = 0.6;
      if (cv.width !== SIZE * dpr) { cv.width = cv.height = SIZE * dpr; }
      const w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2, s = (SIZE * dpr) / Math.max(w, h);
      const ox = (SIZE * dpr - w * s) / 2 - (b.x0 - pad) * s, oy = (SIZE * dpr - h * s) / 2 - (b.y0 - pad) * s;
      view.current = { s, ox, oy, dpr };
      const X = x => x * s + ox, Y = y => y * s + oy;
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (const r of I.S.rooms) { g.beginPath(); r.poly.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = dpr;
      for (const it of I.S.doc.items) {
        if (I.getDef(it.type).flat) continue;
        g.save(); g.translate(X(it.x), Y(it.y)); g.rotate((it.rot || 0) * Math.PI / 180); g.strokeRect(-it.w / 2 * s, -it.d / 2 * s, it.w * s, it.d * s); g.restore();
      }
      g.strokeStyle = 'rgba(240,244,250,0.9)'; g.lineCap = 'round';
      for (const wl of I.S.doc.walls) { g.lineWidth = Math.max(1.5 * dpr, wl.thickness * s); g.beginPath(); g.moveTo(X(wl.a.x), Y(wl.a.y)); g.lineTo(X(wl.b.x), Y(wl.b.y)); g.stroke(); }
      const p = I.api3d.playerPose(), dir = -p.yaw - Math.PI / 2, R = 30 * dpr;
      const cone = g.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), R);
      cone.addColorStop(0, 'rgba(79,141,255,0.55)'); cone.addColorStop(1, 'rgba(79,141,255,0)');
      g.fillStyle = cone; g.beginPath(); g.moveTo(X(p.x), Y(p.y)); g.arc(X(p.x), Y(p.y), R, dir - 0.6, dir + 0.6); g.closePath(); g.fill();
      g.fillStyle = '#4f8dff'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.arc(X(p.x), Y(p.y), 4.5 * dpr, 0, 7); g.fill(); g.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const jump = e => {
    const v = view.current; if (!v || locked) return;
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) * v.dpr, y = (e.clientY - r.top) * v.dpr;
    I.api3d.teleport((x - v.ox) / v.s, (y - v.oy) / v.s);
  };
  return (
    <Glass className="overflow-hidden p-1">
      <canvas ref={ref} onClick={jump} title="Click to jump there" style={{ width: SIZE, height: SIZE, cursor: locked ? 'default' : 'crosshair' }} />
    </Glass>
  );
}

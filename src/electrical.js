// Electrical layer: outlets, jacks and switches (points) and the cable runs between them and the furniture they power.
// Lengths are worked out in 3D: the drop from each end down (or up) to the route height plus the horizontal path.
import { S } from './state.js';
import { dist, add, sub, mul, rot, clamp } from './util.js';
import { getDef } from './catalog.js';

export const POINT_KINDS = {
  outlet:    { name: 'Duplex outlet',      z: 0.3,  wall: true,  color: '#f6f5f2', sym: 'outlet' },
  usb:       { name: 'USB / power outlet', z: 0.3,  wall: true,  color: '#f6f5f2', sym: 'outlet' },
  gfci:      { name: 'GFCI outlet',        z: 1.07, wall: true,  color: '#f6f5f2', sym: 'outlet' },
  floorbox:  { name: 'Floor box',          z: 0.0,  wall: false, color: '#b9bdc3', sym: 'square' },
  strip:     { name: 'Power strip',        z: 0.02, wall: false, color: '#2b2d31', sym: 'strip' },
  data:      { name: 'Ethernet / data jack', z: 0.3, wall: true, color: '#f6f5f2', sym: 'triangle' },
  coax:      { name: 'TV / coax plate',    z: 0.3,  wall: true,  color: '#f6f5f2', sym: 'triangle' },
  hdmi:      { name: 'HDMI wall plate',    z: 0.3,  wall: true,  color: '#f6f5f2', sym: 'triangle' },
  switch:    { name: 'Light switch',       z: 1.2,  wall: true,  color: '#f6f5f2', sym: 'switch' },
  ceiling:   { name: 'Ceiling box',        z: 2.55, wall: false, color: '#f6f5f2', sym: 'circle' },
};

export const CABLE_KINDS = {
  power:    { name: 'Power / extension', color: '#e0662f', sizesFt: [3, 6, 9, 12, 15, 25, 50] },
  hdmi:     { name: 'HDMI',              color: '#7a52c7', sizesFt: [3, 6, 10, 15, 25, 35, 50] },
  ethernet: { name: 'Ethernet',          color: '#2f8fd8', sizesFt: [3, 5, 7, 10, 14, 25, 50, 75, 100] },
  usb:      { name: 'USB',               color: '#3aa36a', sizesFt: [1, 3, 6, 10, 15] },
  speaker:  { name: 'Speaker wire',      color: '#c23b55', sizesFt: null }, // sold by the foot / spool
  audio:    { name: 'Audio (XLR / TRS)', color: '#b38a1b', sizesFt: [3, 6, 10, 15, 20, 25, 50] },
  other:    { name: 'Other',             color: '#6b7380', sizesFt: null },
};

export const ROUTES = { floor: 'Along the floor', surface: 'Across a surface (desk)', direct: 'Straight line' };

const FT = 0.3048, FLOOR = 0.02;
export const elec = () => (S.doc.elec ??= { points: [], cables: [] });

/** Where a cable meets an end: plan position (on the edge of a piece of furniture facing the cable) and height. */
export function endInfo(end, toward) {
  if (!end) return null;
  if (end.point) {
    const p = elec().points.find(q => q.id === end.point);
    return p && { x: p.x, y: p.y, z: p.z, label: p.label || POINT_KINDS[p.kind]?.name || 'Point' };
  }
  if (end.item) {
    const it = S.doc.items.find(i => i.id === end.item);
    if (!it) return null;
    // leave the footprint where the run heads off, so lengths are measured to the piece's edge rather than its centre
    let at = { x: it.x, y: it.y };
    if (toward) {
      const l = rot(sub(toward, it), -it.rot), k = Math.min(1, Math.min(it.w / 2 / Math.max(1e-6, Math.abs(l.x)), it.d / 2 / Math.max(1e-6, Math.abs(l.y))));
      at = add(it, rot(mul(l, k), it.rot));
    }
    const z = end.z ?? (it.elev || 0) + (getDef(it.type).on ? 0.01 : Math.min(0.15, it.h / 2)); // port height: near the base
    return { ...at, z, label: it.name };
  }
  return end.x != null ? { x: end.x, y: end.y, z: end.z ?? FLOOR, label: 'Loose end' } : null;
}

/** Plan path of a cable: start end, bends, finish end. */
export function cablePath(c) {
  const mid = c.path || [];
  const a = endInfo(c.from, mid[0] || (c.to && endInfo(c.to))), b = endInfo(c.to, mid[mid.length - 1] || a);
  if (!a || !b) return null;
  return { a, b, pts: [a, ...mid, b] };
}

/** Measured length (m) and the recommended size to buy. */
export function cableLength(c) {
  const P = cablePath(c); if (!P) return null;
  let horiz = 0;
  for (let i = 1; i < P.pts.length; i++) horiz += dist(P.pts[i - 1], P.pts[i]);
  const route = c.route || 'floor';
  let len;
  if (route === 'direct') len = Math.hypot(horiz, P.a.z - P.b.z);
  else if (route === 'surface') len = horiz + Math.abs(P.a.z - P.b.z);
  else len = Math.max(0, P.a.z - FLOOR) + horiz + Math.max(0, P.b.z - FLOOR);
  const slack = c.slack ?? 0.15, need = len * (1 + slack);
  const sizes = CABLE_KINDS[c.kind]?.sizesFt;
  const buyFt = sizes ? sizes.find(s => s * FT >= need) ?? null : Math.ceil(need / FT);
  return { measured: len, need, buyFt, horiz, a: P.a, b: P.b, pts: P.pts };
}

/** 3D polyline of a cable (x, height, y) for drawing. */
export function cable3d(c) {
  const L = cableLength(c); if (!L) return null;
  const route = c.route || 'floor', pts = L.pts, out = [];
  if (route === 'direct') return pts.map((p, i) => ({ x: p.x, y: p.y, z: i === 0 ? L.a.z : i === pts.length - 1 ? L.b.z : L.a.z + (L.b.z - L.a.z) * (i / (pts.length - 1)) }));
  const h = route === 'surface' ? Math.min(L.a.z, L.b.z) : FLOOR;
  out.push({ ...pts[0], z: L.a.z });
  for (const p of pts) out.push({ x: p.x, y: p.y, z: h });
  out.push({ ...pts[pts.length - 1], z: L.b.z });
  return out;
}

export const fmtFt = m => { const inches = Math.round(m / 0.0254); return `${Math.floor(inches / 12)}' ${inches % 12}"`; };

/** Cable schedule rows (for the Power tab and CSV export). */
export function schedule() {
  return elec().cables.map(c => {
    const L = cableLength(c), k = CABLE_KINDS[c.kind] || CABLE_KINDS.other;
    return { c, kind: k.name, color: k.color, from: L?.a.label ?? '?', to: L?.b.label ?? '?', route: ROUTES[c.route || 'floor'], L };
  });
}

/** Snap a plan point to the nearest wall face for wall-mounted points: returns { x, y, rot, wallId } or null. */
export function wallFace(p, reach = 0.6) {
  // a window ledge (knee wall) stands in front of its wall: points over one go on its front face, like the built-in ledge outlets
  for (const it of S.doc.items.filter(i => i.type === 'window_ledge')) {
    const l = rot(sub(p, it), -it.rot);
    if (Math.abs(l.x) > it.w / 2 + 0.05 || Math.abs(l.y) > it.d / 2 + 0.15) continue;
    const f = add(it, rot({ x: clamp(l.x, -it.w / 2 + 0.05, it.w / 2 - 0.05), y: it.d / 2 + 0.004 }, it.rot));
    return { x: f.x, y: f.y, rot: it.rot, dd: 0 };
  }
  let best = null;
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id); if (!g || g.len < 0.2) continue;
    const v = sub(p, w.a), along = clamp(v.x * g.dir.x + v.y * g.dir.y, 0.05, g.len - 0.05), off = v.x * g.n.x + v.y * g.n.y;
    const d = Math.abs(off - 0) ; if (d > reach + w.thickness / 2) continue;
    const side = off >= 0 ? 1 : -1, face = add(add(w.a, mul(g.dir, along)), mul(g.n, side * (w.thickness / 2 + 0.004)));
    const dd = dist(p, face);
    if (!best || dd < best.dd) best = { x: face.x, y: face.y, rot: Math.atan2(g.n.y * side, g.n.x * side) * 180 / Math.PI - 90, wallId: w.id, dd };
  }
  return best;
}

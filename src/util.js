// Math, geometry, unit and DOM helpers shared by every module.

export const uid = (p = 'o') => p + Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rad = d => (d * Math.PI) / 180;
export const deg = r => (r * 180) / Math.PI;
export const normDeg = a => ((a % 360) + 360) % 360;

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = a => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
export const perp = a => ({ x: -a.y, y: a.x });
export const rot = (p, d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };

export function projectOnSegment(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab) || 1e-12;
  const raw = dot(sub(p, a), ab) / l2, t = clamp(raw, 0, 1);
  const point = add(a, mul(ab, t));
  return { t, raw, point, dist: dist(p, point) };
}

export function lineIntersect(p1, d1, p2, d2) {
  const c = cross(d1, d2);
  if (Math.abs(c) < 1e-9) return null;
  const t = cross(sub(p2, p1), d2) / c;
  return { point: add(p1, mul(d1, t)), t, u: cross(sub(p2, p1), d1) / c };
}

export function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}

export function polyPerimeter(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
  return s;
}

export function pointInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polyBBox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

const distToPolyEdges = (p, pts) => {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) d = Math.min(d, projectOnSegment(p, pts[i], pts[(i + 1) % pts.length]).dist);
  return d;
};

// Interior point furthest from the edges (coarse "pole of inaccessibility") - a good spot for labels.
export function polyLabelPoint(pts) {
  const b = polyBBox(pts);
  let best = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, bd = -1;
  const N = 14;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = { x: b.x0 + (b.w * (i + 0.5)) / (N + 1), y: b.y0 + (b.h * (j + 0.5)) / (N + 1) };
    if (!pointInPoly(p, pts)) continue;
    const d = distToPolyEdges(p, pts);
    if (d > bd) { bd = d; best = p; }
  }
  return best;
}

// ---- oriented boxes (furniture footprints) ----
export function obbCorners(o, grow = 0) {
  const hw = o.w / 2 + grow, hd = o.d / 2 + grow;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => add(o, rot({ x, y }, o.rot || 0)));
}

export function convexOverlap(A, B) {
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const ax = perp(sub(poly[(i + 1) % poly.length], poly[i]));
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const p of A) { const v = dot(p, ax); a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
      for (const p of B) { const v = dot(p, ax); b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
      const l = len(ax) || 1;
      if (a1 - b0 < 1e-3 * l || b1 - a0 < 1e-3 * l) return false;
    }
  }
  return true;
}

// ---- rooms: planar faces of the wall graph ----
export function computeRooms(walls) {
  const EPS = 0.012, nodes = [];
  const nodeId = p => {
    for (let i = 0; i < nodes.length; i++) if (Math.abs(nodes[i].x - p.x) < EPS && Math.abs(nodes[i].y - p.y) < EPS) return i;
    nodes.push({ x: p.x, y: p.y, adj: [] });
    return nodes.length - 1;
  };
  const segs = walls.filter(w => dist(w.a, w.b) > EPS).map(w => ({ a: w.a, b: w.b, ts: [0, 1] }));
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    for (const [u, v] of [[s, t], [t, s]]) for (const e of [v.a, v.b]) {
      const pr = projectOnSegment(e, u.a, u.b);
      if (pr.dist < EPS) u.ts.push(pr.t);
    }
    const hit = lineIntersect(s.a, sub(s.b, s.a), t.a, sub(t.b, t.a));
    if (hit && hit.t > 0 && hit.t < 1 && hit.u > 0 && hit.u < 1) { s.ts.push(hit.t); t.ts.push(hit.u); }
  }
  const edges = new Set();
  for (const s of segs) {
    const ids = s.ts.sort((a, b) => a - b).map(t => nodeId(add(s.a, mul(sub(s.b, s.a), t))));
    for (let i = 1; i < ids.length; i++) {
      const u = ids[i - 1], v = ids[i];
      if (u === v) continue;
      const k = u < v ? u + '_' + v : v + '_' + u;
      if (edges.has(k)) continue;
      edges.add(k); nodes[u].adj.push(v); nodes[v].adj.push(u);
    }
  }
  nodes.forEach(n => n.adj.sort((p, q) => Math.atan2(nodes[p].y - n.y, nodes[p].x - n.x) - Math.atan2(nodes[q].y - n.y, nodes[q].x - n.x)));
  const seen = new Set(), rooms = [];
  nodes.forEach((n, u0) => n.adj.forEach(v0 => {
    if (seen.has(u0 + '>' + v0)) return;
    let u = u0, v = v0, guard = 0;
    const path = [];
    do {
      seen.add(u + '>' + v); path.push(u);
      const adj = nodes[v].adj, w = adj[(adj.indexOf(u) - 1 + adj.length) % adj.length];
      u = v; v = w;
    } while ((u !== u0 || v !== v0) && ++guard < 5000);
    // drop zero-width spurs left by dead-end walls
    for (let i = 0; path.length > 2 && i < path.length;) {
      const n2 = path.length, prev = path[(i - 1 + n2) % n2], next = path[(i + 1) % n2];
      if (prev === next) { path.splice(i, 1); path.splice(i % path.length, 1); i = Math.max(0, i - 2); } else i++;
    }
    if (path.length < 3) return;
    const poly = path.map(i => ({ x: nodes[i].x, y: nodes[i].y }));
    if (polyArea(poly) > 0.15) rooms.push(poly);
  }));
  return rooms;
}

// ---- walls: mitred outlines so corners join cleanly in 2D and 3D ----
export function computeWallGeom(walls) {
  const EPS = 0.012, ends = [], out = new Map();
  for (const w of walls) {
    const dir = norm(sub(w.b, w.a));
    out.set(w.id, { dir, n: perp(dir), len: dist(w.a, w.b), a: {}, b: {} });
    ends.push({ w, e: 'a', p: w.a, d: dir }, { w, e: 'b', p: w.b, d: mul(dir, -1) });
  }
  ends.forEach(e => (e.ang = Math.atan2(e.d.y, e.d.x)));
  const done = new Set();
  ends.forEach((e0, i0) => {
    if (done.has(i0)) return;
    const g = ends.filter((e, i) => !done.has(i) && dist(e.p, e0.p) < EPS && (done.add(i), true));
    if (g.length < 2) return;
    g.sort((p, q) => p.ang - q.ang);
    g.forEach((cur, i) => {
      const ccw = g[(i + 1) % g.length], cw = g[(i - 1 + g.length) % g.length];
      const nl = perp(cur.d), t = cur.w.thickness / 2, lim = 3 * Math.max(cur.w.thickness, ccw.w.thickness, cw.w.thickness);
      const miter = (side, o) => {
        const hit = lineIntersect(add(cur.p, mul(nl, side * t)), cur.d, add(cur.p, mul(perp(o.d), (-side * o.w.thickness) / 2)), o.d);
        return hit && Math.abs(cross(cur.d, o.d)) > 0.05 && dist(hit.point, cur.p) < lim ? hit.point : null;
      };
      out.get(cur.w.id)[cur.e] = { L: miter(1, ccw), R: miter(-1, cw), joint: true };
    });
  });
  for (const w of walls) {
    const g = out.get(w.id), t = w.thickness / 2, { a, b } = g;
    const An = a.L || add(w.a, mul(g.n, t)), Am = a.R || add(w.a, mul(g.n, -t));
    const Bn = b.R || add(w.b, mul(g.n, t)), Bm = b.L || add(w.b, mul(g.n, -t));
    g.poly = [An, Bn, ...(b.joint ? [w.b] : []), Bm, Am, ...(a.joint ? [w.a] : [])];
    g.ext = { aN: dot(sub(An, w.a), g.dir), aM: dot(sub(Am, w.a), g.dir), bN: dot(sub(Bn, w.b), g.dir), bM: dot(sub(Bm, w.b), g.dir) };
  }
  return out;
}

// ---- units ----
const IN = 0.0254;
export function fmtLen(m, units = 'imperial') {
  if (units === 'metric') return Math.abs(m) >= 1 ? `${+m.toFixed(2)} m` : `${Math.round(m * 100)} cm`;
  const neg = m < 0 ? '-' : '';
  const total = Math.round((Math.abs(m) / IN) * 2) / 2, ft = Math.floor(total / 12), inch = +(total - ft * 12).toFixed(1);
  return neg + (ft ? `${ft}' ${inch}"` : `${inch}"`);
}

// `small` picks the bare-number unit: inches/cm for furniture, feet/metres for walls.
export function parseLen(str, units = 'imperial', small = false) {
  const s = String(str).trim().toLowerCase().replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  if (!s) return null;
  let m = s.match(/^(-?[\d.]+)\s*(mm|cm|m)$/);
  if (m) return parseFloat(m[1]) * { mm: 0.001, cm: 0.01, m: 1 }[m[2]];
  m = s.match(/^(?:(-?[\d.]+)\s*(?:'|ft|feet|foot))?\s*(?:([\d.]+)\s*(?:"|in|inch|inches)?)?$/);
  if (m && m[1] !== undefined) return (parseFloat(m[1]) * 12 + (parseFloat(m[2]) || 0)) * IN;
  m = s.match(/^(-?[\d.]+)\s*(?:"|in|inch|inches)$/);
  if (m) return parseFloat(m[1]) * IN;
  m = s.match(/^(-?[\d.]+)\s+([\d.]+)$/);
  if (m && units === 'imperial') return (parseFloat(m[1]) * 12 + parseFloat(m[2])) * IN;
  const v = parseFloat(s);
  if (!isFinite(v) || !/^-?[\d.]+$/.test(s)) return null;
  if (units === 'metric') return small ? v / 100 : v;
  return small ? v * IN : v * 12 * IN;
}

export const fmtArea = (m2, units = 'imperial') => (units === 'metric' ? `${m2.toFixed(1)} m²` : `${Math.round(m2 * 10.7639)} sq ft`);
export const fmtMoney = v => '$' + (+v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

// ---- colour ----
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt)), 0, 255);
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}

// ---- DOM ----
export function h(tag, props, ...kids) {
  const [t, ...cls] = tag.split('.');
  const e = document.createElement(t || 'div');
  if (cls.length) e.className = cls.join(' ');
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'html') e.innerHTML = v;
    else if (k in e && k !== 'list') e[k] = v;
    else e.setAttribute(k, v);
  }
  kids.flat(9).forEach(c => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
}

export function download(name, data, type = 'application/octet-stream') {
  const url = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  if (!url.startsWith('data:')) setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const readAsDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

export function pickFile(accept) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, onchange: () => res(i.files[0] || null) });
    i.click();
  });
}

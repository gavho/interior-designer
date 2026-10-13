// Editing operations on the document. Each one mutates S.doc and commits an undo step.
import { S, commit, select, selOf, find } from './state.js';
import { uid, add, sub, mul, dist, rot, norm, dot, perp, projectOnSegment, lineIntersect, normDeg, pointInPoly } from './util.js';
import { getDef, partsFor } from './catalog.js';
import { getFloor } from './materials.js';

const EPS = 0.012;
const clone = o => JSON.parse(JSON.stringify(o));

export function makeItem(type, extra = {}) {
  const d = getDef(type);
  return { id: uid('it'), type, name: d.name, x: 0, y: 0, rot: 0, w: d.w, d: d.d, h: d.h, elev: d.elev || 0, color: d.color, ...(d.color2 ? { color2: d.color2 } : {}), ...extra };
}
export function addItem(item) { S.doc.items.push(item); select([{ k: 'item', id: item.id }]); commit(); return item; }

// ---- pieces that rest on other furniture (keyboards, monitors, plants on shelves) ----
export const sits = it => it.on ?? !!getDef(it.type).on;
/** Height of whatever is under a small piece (desk, shelf, monitor stand), so it lands on that instead of the floor. */
export function surfaceUnder(it) {
  const cap = Math.max(1.3, (it.elev || 0) + 0.05); // reach a higher shelf by typing its "Off floor" height once
  let top = 0;
  for (const o of S.doc.items) {
    const def = getDef(o.type);
    if (o.id === it.id || def.flat || (sits(o) && !def.surf)) continue;
    const l = rot(sub(it, o), -o.rot);
    if (Math.abs(l.x) > o.w / 2 || Math.abs(l.y) > o.d / 2) continue;
    const parts = partsFor(o), tops = parts.length ? parts.filter(p => Math.abs(l.x - p.x) <= p.w / 2 && Math.abs(l.y - p.z) <= p.d / 2).map(p => p.y + p.h) : [o.h];
    for (const t of tops) if (o.elev + t <= cap && o.elev + t > top) top = o.elev + t;
  }
  return top;
}
/** Pieces resting on any of `bases`, so they travel with the desk or shelf they stand on. */
export function riders(bases) {
  return S.doc.items.filter(it => sits(it) && !it.locked && !bases.includes(it) && bases.some(b => {
    const l = rot(sub(it, b), -b.rot);
    return Math.abs(l.x) <= b.w / 2 && Math.abs(l.y) <= b.d / 2 && it.elev > b.elev + 0.05 && it.elev <= b.elev + b.h + 0.4;
  }));
}

export function addWall(a, b, extra = {}) {
  const w = { id: uid('w'), a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, thickness: S.doc.settings.wallThickness, height: S.doc.settings.wallHeight, ...extra };
  S.doc.walls.push(w);
  return w;
}

export function addOpening(wallId, pos, opt = {}) {
  const door = opt.type !== 'window';
  const o = { id: uid('op'), wallId, pos, type: door ? 'door' : 'window', style: door ? 'single' : 'standard', width: door ? 0.81 : 1.2, height: door ? 2.03 : 1.2, sill: door ? 0 : 0.9, hinge: 'left', side: 1, ...opt };
  S.doc.openings.push(o);
  return o;
}

/** Move every wall end sitting on `from` to `to`, keeping joined walls connected. */
export function moveVertex(from, to) {
  for (const w of S.doc.walls) for (const e of ['a', 'b']) if (dist(w[e], from) < EPS) w[e] = { x: to.x, y: to.y };
}

export function setWallLength(w, L) {
  if (!(L > 0.05)) return;
  const dir = norm(sub(w.b, w.a));
  moveVertex({ ...w.b }, add(w.a, mul(dir, L)));
  commit();
}

export function splitWall(id, at) {
  const w = find('wall', id);
  if (!w) return;
  const pr = at ? projectOnSegment(at, w.a, w.b) : { t: 0.5, point: mul(add(w.a, w.b), 0.5) };
  if (pr.t < 0.02 || pr.t > 0.98) return;
  const L1 = dist(w.a, pr.point), nw = { ...clone(w), id: uid('w'), a: { ...pr.point } };
  w.b = { ...pr.point };
  S.doc.walls.push(nw);
  for (const o of S.doc.openings) if (o.wallId === id && o.pos > L1) { o.wallId = nw.id; o.pos -= L1; }
  commit();
}

export function deleteSelection() {
  if (!S.sel.length) return;
  const ids = k => new Set(S.sel.filter(s => s.k === k).map(s => s.id));
  const d = S.doc, w = ids('wall'), it = ids('item'), op = ids('opening'), lb = ids('label'), dm = ids('dim');
  d.items = d.items.filter(o => !it.has(o.id) || o.locked);
  d.walls = d.walls.filter(o => !w.has(o.id));
  d.openings = d.openings.filter(o => !op.has(o.id) && !w.has(o.wallId));
  d.labels = d.labels.filter(o => !lb.has(o.id));
  d.dims = d.dims.filter(o => !dm.has(o.id));
  select([]); commit();
}

let clipboard = null;
export function copySelection() {
  const items = selOf('item'), walls = selOf('wall'), labels = selOf('label');
  if (!items.length && !walls.length && !labels.length) return false;
  const wid = new Set(walls.map(w => w.id));
  clipboard = clone({ items, walls, labels, openings: S.doc.openings.filter(o => wid.has(o.wallId)) });
  return true;
}
export function paste(offset = { x: 0.3, y: 0.3 }) {
  if (!clipboard) return;
  const c = clone(clipboard), sel = [], map = {};
  for (const it of c.items) { it.id = uid('it'); it.x += offset.x; it.y += offset.y; it.locked = false; S.doc.items.push(it); sel.push({ k: 'item', id: it.id }); }
  const gmap = {};
  for (const w of c.walls) { if (w.grp) w.grp = gmap[w.grp] ??= uid('g'); map[w.id] = w.id = uid('w'); w.a = add(w.a, offset); w.b = add(w.b, offset); S.doc.walls.push(w); sel.push({ k: 'wall', id: w.id }); }
  c.walls.forEach((w, i) => (map[clipboard.walls[i].id] = w.id));
  for (const o of c.openings) { o.id = uid('op'); o.wallId = map[o.wallId]; S.doc.openings.push(o); }
  for (const l of c.labels) { l.id = uid('lb'); l.x += offset.x; l.y += offset.y; S.doc.labels.push(l); sel.push({ k: 'label', id: l.id }); }
  clipboard = clone({ ...c, walls: c.walls, openings: c.openings }); // so repeated pastes cascade
  select(sel); commit();
}
export function duplicateSelection() { const keep = clipboard; if (copySelection()) paste(); clipboard = keep; }

export function rotateSelection(by) {
  const items = selOf('item').filter(i => !i.locked);
  if (!items.length) return;
  const c = mul(items.reduce((s, i) => add(s, i), { x: 0, y: 0 }), 1 / items.length);
  for (const it of [...items, ...riders(items)]) {
    if (items.length > 1 || it !== items[0]) { const p = add(c, rot(sub(it, c), by)); it.x = p.x; it.y = p.y; }
    it.rot = normDeg(it.rot + by);
  }
  commit();
}

export function nudge(dx, dy) {
  const items = selOf('item').filter(i => !i.locked), labels = selOf('label'), walls = selOf('wall');
  if (!items.length && !labels.length && !walls.length) return;
  for (const o of [...items, ...riders(items), ...labels]) { o.x += dx; o.y += dy; }
  const pts = [];
  for (const w of walls) for (const e of ['a', 'b']) if (!pts.some(p => dist(p, w[e]) < EPS)) pts.push({ ...w[e] });
  for (const p of pts) moveVertex(p, add(p, { x: dx, y: dy }));
  commit();
}

export function reorder(toFront) {
  const sel = selOf('item'), rest = S.doc.items.filter(i => !sel.includes(i));
  S.doc.items = toFront ? [...rest, ...sel] : [...sel, ...rest];
  commit();
}

export function alignItems(mode) {
  const items = selOf('item').filter(i => !i.locked);
  if (items.length < 2) return;
  const ext = i => { const r = Math.abs(Math.round(i.rot / 90)) % 2; return r ? { hw: i.d / 2, hh: i.w / 2 } : { hw: i.w / 2, hh: i.d / 2 }; };
  const xs0 = Math.min(...items.map(i => i.x - ext(i).hw)), xs1 = Math.max(...items.map(i => i.x + ext(i).hw));
  const ys0 = Math.min(...items.map(i => i.y - ext(i).hh)), ys1 = Math.max(...items.map(i => i.y + ext(i).hh));
  const spread = (axis, half) => {
    const s = [...items].sort((p, q) => p[axis] - q[axis]), first = s[0][axis], step = (s[s.length - 1][axis] - first) / (s.length - 1);
    s.forEach((it, k) => (it[axis] = first + step * k));
  };
  for (const i of items) {
    const e = ext(i);
    if (mode === 'left') i.x = xs0 + e.hw; else if (mode === 'right') i.x = xs1 - e.hw; else if (mode === 'hcenter') i.x = (xs0 + xs1) / 2;
    else if (mode === 'top') i.y = ys0 + e.hh; else if (mode === 'bottom') i.y = ys1 - e.hh; else if (mode === 'vcenter') i.y = (ys0 + ys1) / 2;
  }
  if (mode === 'disth') spread('x'); if (mode === 'distv') spread('y');
  commit();
}

/** Snap a footprint flush against nearby walls. Returns the adjusted { x, y, rot }. */
export function wallMagnet(it, autoRotate, reach = 0.18) {
  const out = { x: it.x, y: it.y, rot: it.rot };
  const cands = [];
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id); if (!g || g.len < 0.05) continue;
    const pr = projectOnSegment(out, w.a, w.b);
    if (pr.raw < -0.05 || pr.raw > 1.05) continue;
    cands.push({ w, g, d: pr.dist });
  }
  cands.sort((p, q) => p.d - q.d);
  let firstN = null, snaps = 0;
  for (const c of cands) {
    if (snaps >= 2) break;
    const { w, g } = c, pr = projectOnSegment(out, w.a, w.b);
    const side = dot(sub(out, pr.point), g.n) >= 0 ? 1 : -1, n = mul(g.n, side);
    if (firstN && Math.abs(dot(firstN, n)) > 0.5) continue;
    if (autoRotate && !snaps && pr.dist < it.d / 2 + w.thickness / 2 + 0.35) out.rot = normDeg((Math.atan2(-n.x, n.y) * 180) / Math.PI);
    const ux = rot({ x: 1, y: 0 }, out.rot), uy = rot({ x: 0, y: 1 }, out.rot);
    const ext = (Math.abs(dot(ux, n)) * it.w) / 2 + (Math.abs(dot(uy, n)) * it.d) / 2;
    const diff = pr.dist - (w.thickness / 2 + ext);
    if (Math.abs(diff) > reach && !(diff < 0 && diff > -ext)) { if (!snaps && autoRotate) out.rot = it.rot; continue; }
    out.x -= n.x * diff; out.y -= n.y * diff;
    firstN = n; snaps++;
  }
  return out;
}

/** Give every wall face that looks into `room` the same finish / colour. */
export function paintRoom(room, patch) {
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id); if (!g) continue;
    const mid = mul(add(w.a, w.b), 0.5), off = mul(g.n, w.thickness / 2 + 0.12);
    for (const [key, p] of [['n', add(mid, off)], ['m', sub(mid, off)]]) if (pointInPoly(p, room.poly)) { w.sides ??= {}; w.sides[key] = { ...w.sides[key], ...patch }; }
  }
  commit();
}

export function roomAt(p) { return S.rooms.find(r => pointInPoly(p, r.poly)); }

export function applyPalette(pal) {
  const d = S.doc;
  d.settings.wallColor = pal.wall;
  d.walls.forEach(w => delete w.color);
  for (const m of d.roomMeta) { const k = getFloor(m.floor).kind; if (k === 'wood' || k === 'soft' || k === 'hard') m.floor = pal.floor; }
  let f = 0, a = 0;
  for (const it of d.items) {
    const mat = getDef(it.type).mat;
    if (mat === 'fabric') it.color = pal.fabric[f++ % pal.fabric.length];
    else if (mat === 'wood') it.color = pal.wood;
    else if (mat === 'accent') it.color = pal.accent[a++ % pal.accent.length];
    else if (mat === 'bed') { it.color = pal.fabric[f++ % pal.fabric.length]; it.color2 = pal.wood; }
    else if (mat === 'cab') { it.color = pal.cabinet; it.color2 = pal.counter; }
  }
  commit();
}

// ---- CAD-style positioning ----
/** Clear distance from `p` along unit vector `dir` to the nearest wall face (Infinity when nothing is hit). */
export function wallGap(p, dir) {
  let best = Infinity;
  for (const w of S.doc.walls) {
    const hit = lineIntersect(p, dir, w.a, sub(w.b, w.a)), g = S.wallGeom.get(w.id);
    if (g && hit && hit.t > 1e-6 && hit.u >= 0 && hit.u <= 1) best = Math.min(best, hit.t - w.thickness / 2 / (Math.abs(dot(dir, g.n)) || 1e-6));
  }
  return best;
}
/** Gaps between a piece and the walls around it, measured along its own axes. */
export function itemGaps(it) {
  const ux = rot({ x: 1, y: 0 }, it.rot), uy = rot({ x: 0, y: 1 }, it.rot);
  return { ux, uy, left: wallGap(it, mul(ux, -1)) - it.w / 2, right: wallGap(it, ux) - it.w / 2, back: wallGap(it, mul(uy, -1)) - it.d / 2, front: wallGap(it, uy) - it.d / 2 };
}
/** Centre the selection between the walls either side: 'x' = along its width, 'y' = along its depth, 'both'. */
export function centerItems(axis) {
  const items = selOf('item').filter(i => !i.locked);
  for (const it of items) {
    let g = itemGaps(it);
    if (axis !== 'y' && isFinite(g.left + g.right)) { const s = (g.right - g.left) / 2; it.x += g.ux.x * s; it.y += g.ux.y * s; g = itemGaps(it); }
    if (axis !== 'x' && isFinite(g.back + g.front)) { const s = (g.front - g.back) / 2; it.x += g.uy.x * s; it.y += g.uy.y * s; }
  }
  if (items.length) commit();
}
/** Put one side of a piece an exact distance from the wall it faces. */
export function setItemGap(it, side, v) {
  const g = itemGaps(it), cur = g[side];
  if (!isFinite(cur)) return;
  const dir = side === 'left' ? mul(g.ux, -1) : side === 'right' ? g.ux : side === 'back' ? mul(g.uy, -1) : g.uy, s = cur - v;
  it.x += dir.x * s; it.y += dir.y * s;
  commit();
}
export function centerOpening(o, betweenWalls) {
  const w = find('wall', o.wallId), g = w && S.wallGeom.get(w.id);
  if (!g) return;
  if (!betweenWalls) o.pos = g.len / 2;
  else {
    const c = add(add(w.a, mul(g.dir, o.pos)), mul(g.n, o.side * (w.thickness / 2 + 0.2)));
    const l = wallGap(c, mul(g.dir, -1)), r = wallGap(c, g.dir);
    if (isFinite(l + r)) o.pos += (r - l) / 2;
  }
  o.pos = Math.min(Math.max(o.pos, o.width / 2), g.len - o.width / 2);
  commit();
}

// ---- curved walls: an arc through three points, built from short straight segments ----
export function arcPoints(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return [a, b];
  const sq = p => p.x * p.x + p.y * p.y;
  const o = { x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d, y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d };
  const r = dist(o, a);
  if (r > 150) return [a, b];
  const TAU = Math.PI * 2, ang = p => Math.atan2(p.y - o.y, p.x - o.x), wrap = v => ((v % TAU) + TAU) % TAU;
  const a0 = ang(a);
  let sweep = wrap(ang(b) - a0);
  if (wrap(ang(c) - a0) > sweep) sweep -= TAU; // the arc has to pass through the bulge point
  const n = Math.min(72, Math.max(4, Math.ceil((Math.abs(sweep) * r) / 0.3), Math.ceil(Math.abs(sweep) / 0.2)));
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (sweep * i) / n; pts.push(i === 0 ? a : i === n ? b : { x: o.x + r * Math.cos(t), y: o.y + r * Math.sin(t) }); }
  pts.radius = r;
  return pts;
}
export function addPolyWalls(pts, closed) {
  const grp = uid('g'), out = [];
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) out.push(addWall(pts[i], pts[(i + 1) % pts.length], pts.length > 2 ? { grp } : {}));
  commit();
  return out;
}

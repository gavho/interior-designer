// 2D plan editor: rendering, snapping, and all drawing / editing tools.
import { S, on, emit, touch, commit, revert, select, toggleSel, isSel, find, selOf, setTool } from './state.js';
import { add, sub, mul, dot, dist, norm, rot, rad, deg, clamp, normDeg, projectOnSegment, lineIntersect, pointInPoly, uid, fmtLen, fmtArea, parseLen } from './util.js';
import { getDef, drawSymbol } from './catalog.js';
import { getFloor, floorCanvas, TEX } from './materials.js';
import { addWall, addOpening, wallMagnet, splitWall, itemGaps, arcPoints, addPolyWalls } from './ops.js';
import { analyze, clearanceMap } from './analysis.js';

const ACCENT = '#2f7df6', WALL = '#3a3f47';
let cv, ctx, W = 100, H = 100, dpr = 1, raf = 0, exporting = false;
export const view = { cx: 5, cy: 5, zoom: 50 };

let cursor = { x: 0, y: 0 }, mouse = { x: 0, y: 0 }, hover = null;
let drag = null;          // active pointer interaction
let draft = null;         // wall tool: { from }
let arc = null;           // arc tool: { a, b }
let measureFrom = null, calibFrom = null, preview = null, typed = '', guides = [], snapMark = null, spaceDown = false;

const w2s = p => ({ x: (p.x - view.cx) * view.zoom + W / 2, y: (p.y - view.cy) * view.zoom + H / 2 });
const s2w = p => ({ x: (p.x - W / 2) / view.zoom + view.cx, y: (p.y - H / 2) / view.zoom + view.cy });
const px = n => n / view.zoom;
const units = () => S.doc.units;
const L = m => fmtLen(m, units());
export const requestDraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
const status = t => emit('status', t);

// ------------------------------------------------------------------ snapping
function snap(p, { anchor = null, exclude = null, shift = false, grid = true } = {}) {
  guides = []; snapMark = null;
  const verts = [];
  for (const w of S.doc.walls) for (const e of ['a', 'b']) if (!exclude || !exclude(w, e)) verts.push(w[e]);
  let best = null, bd = px(10);
  for (const v of verts) { const d = dist(p, v); if (d < bd) { bd = d; best = v; } }
  if (best) { snapMark = { ...best, kind: 'vertex' }; return snapMark; }
  for (const w of S.doc.walls) { // wall midpoints
    if ((exclude && (exclude(w, 'a') || exclude(w, 'b'))) || dist(w.a, w.b) < 0.6) continue;
    const mp = mul(add(w.a, w.b), 0.5);
    if (dist(p, mp) < px(8)) { snapMark = { ...mp, kind: 'mid' }; return snapMark; }
  }

  let q = { ...p }, kind = 'free', ray = null, Lr = 0;
  if (anchor && (S.prefs.snapAngle || shift)) {
    const v = sub(p, anchor), a = deg(Math.atan2(v.y, v.x)), step = shift ? 45 : 15, sa = Math.round(a / step) * step;
    if (shift || Math.abs(a - sa) < 5) { ray = { x: Math.cos(rad(sa)), y: Math.sin(rad(sa)) }; Lr = dot(v, ray); q = add(anchor, mul(ray, Lr)); }
  }
  // glue to wall bodies (T-junctions)
  for (const w of S.doc.walls) {
    if (exclude && (exclude(w, 'a') || exclude(w, 'b'))) continue;
    if (ray) {
      const hit = lineIntersect(anchor, ray, w.a, sub(w.b, w.a));
      if (hit && hit.u > 0 && hit.u < 1 && hit.t > 0 && dist(hit.point, q) < px(9)) { snapMark = { ...hit.point, kind: 'wall' }; return snapMark; }
    } else {
      const pr = projectOnSegment(p, w.a, w.b);
      if (pr.dist < px(7) && pr.t > 0 && pr.t < 1) { q = pr.point; kind = 'wall'; }
    }
  }
  if (kind === 'wall') { snapMark = { ...q, kind }; return snapMark; }

  // alignment guides with other corners
  let ax = false, ay = false;
  const horiz = ray && Math.abs(ray.y) < 1e-6, vert = ray && Math.abs(ray.x) < 1e-6;
  for (const v of verts) {
    if (!ax && (!ray || horiz) && Math.abs(q.x - v.x) < px(6)) { q.x = v.x; ax = true; guides.push([v, { x: v.x, y: q.y }]); }
    if (!ay && (!ray || vert) && Math.abs(q.y - v.y) < px(6)) { q.y = v.y; ay = true; guides.push([v, { x: q.x, y: v.y }]); }
  }
  const g = S.doc.settings.snap;
  if (grid && S.prefs.snapGrid && g > 0) {
    if (ray) { if (!ax && !ay) q = add(anchor, mul(ray, Math.round(Lr / g) * g)); }
    else { if (!ax) q.x = Math.round(q.x / g) * g; if (!ay) q.y = Math.round(q.y / g) * g; }
  }
  guides.forEach(gd => (gd[1] = { x: q.x, y: q.y }));
  return { ...q, kind: ax || ay ? 'align' : kind };
}

// ------------------------------------------------------------------ hit testing
const toLocal = (p, it) => rot(sub(p, it), -it.rot);
const inItem = (p, it, grow = 0) => { const l = toLocal(p, it); return Math.abs(l.x) <= it.w / 2 + grow && Math.abs(l.y) <= it.d / 2 + grow; };
const openingPos = (o, g) => clamp(o.pos, o.width / 2, Math.max(o.width / 2, g.len - o.width / 2));

function itemHandles(it) {
  const hs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ kind: 'resize', sx, sy, p: add(it, rot({ x: (sx * it.w) / 2, y: (sy * it.d) / 2 }, it.rot)) }));
  hs.push({ kind: 'rotate', p: add(it, rot({ x: 0, y: it.d / 2 + px(26) }, it.rot)) });
  return hs;
}
const singleItem = () => (S.sel.length === 1 && S.sel[0].k === 'item' ? find('item', S.sel[0].id) : null);

function hitTest(p) {
  const d = S.doc, it1 = singleItem();
  if (it1 && !it1.locked) for (const hd of itemHandles(it1)) if (dist(hd.p, p) < px(8)) return { k: 'handle', item: it1, ...hd };
  for (const o of d.openings) {
    const w = find('wall', o.wallId), g = w && S.wallGeom.get(w.id); if (!g) continue;
    const v = sub(p, w.a), al = dot(v, g.dir), pe = dot(v, g.n);
    if (Math.abs(al - openingPos(o, g)) < o.width / 2 && Math.abs(pe) < w.thickness / 2 + px(5)) return { k: 'opening', id: o.id };
  }
  for (const w of d.walls) for (const e of ['a', 'b']) if (dist(w[e], p) < px(7)) return { k: 'vertex', p: { ...w[e] } };
  const items = d.items.filter(i => !getDef(i.type).flat).sort((a, b) => a.elev + a.h - (b.elev + b.h));
  for (let i = items.length - 1; i >= 0; i--) if (inItem(p, items[i], px(2))) return { k: 'item', id: items[i].id };
  for (const w of d.walls) if (projectOnSegment(p, w.a, w.b).dist < w.thickness / 2 + px(3)) return { k: 'wall', id: w.id };
  for (const l of d.labels) { const s = w2s(l), m = w2s(p), hw = (l.text.length * l.size * view.zoom * 0.3) + 4; if (Math.abs(m.x - s.x) < hw && Math.abs(m.y - s.y) < l.size * view.zoom * 0.7 + 3) return { k: 'label', id: l.id }; }
  for (const m of d.dims) if (projectOnSegment(p, m.a, m.b).dist < px(6)) return { k: 'dim', id: m.id };
  for (let i = d.items.length - 1; i >= 0; i--) if (getDef(d.items[i].type).flat && inItem(p, d.items[i])) return { k: 'item', id: d.items[i].id };
  const r = S.rooms.find(r => pointInPoly(p, r.poly));
  return r ? { k: 'room', id: r.id } : null;
}

function nearestWall(p, reach) {
  let best = null;
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id); if (!g || g.len < 0.3) continue;
    const pr = projectOnSegment(p, w.a, w.b);
    if (pr.dist < reach && (!best || pr.dist < best.d)) best = { w, g, d: pr.dist, pos: pr.t * g.len, side: dot(sub(p, pr.point), g.n) >= 0 ? 1 : -1 };
  }
  return best;
}

// ------------------------------------------------------------------ rendering
function text(p, str, { size = 11, color = '#30343a', bg = null, bold = false, angle = 0, dy = 0 } = {}) {
  const s = w2s(p);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(s.x, s.y); ctx.rotate(angle);
  ctx.font = `${bold ? '600 ' : ''}${size}px Inter, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (bg) { const m = ctx.measureText(str).width; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-m / 2 - 4, dy - size / 2 - 3, m + 8, size + 6, 3); ctx.fill(); }
  ctx.fillStyle = color; ctx.fillText(str, 0, dy);
  ctx.restore();
}
const poly = pts => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

function dimension(a, b, offPx, color = '#5b6470', label) {
  const d = dist(a, b); if (d < 1e-4) return;
  const dir = norm(sub(b, a)), n = { x: -dir.y, y: dir.x }, o = mul(n, px(offPx)), A = add(a, o), B = add(b, o), tk = mul(n, px(4));
  ctx.strokeStyle = color; ctx.lineWidth = px(1);
  line(A, B); line(sub(A, tk), add(A, tk)); line(sub(B, tk), add(B, tk));
  let ang = Math.atan2(dir.y, dir.x); if (ang > Math.PI / 2 + 1e-6 || ang <= -Math.PI / 2 + 1e-6) ang += Math.PI;
  text(mul(add(A, B), 0.5), label || L(d), { size: 11, color, bg: 'rgba(255,255,255,.92)', angle: ang });
}

function drawGrid() {
  const imp = units() === 'imperial', major = imp ? 0.3048 : 1;
  const minors = imp ? [0.0254, 0.0762, 0.1524] : [0.01, 0.05, 0.1, 0.5];
  const minor = minors.find(m => m * view.zoom >= 7);
  const a = s2w({ x: 0, y: 0 }), b = s2w({ x: W, y: H });
  const lines = (step, color) => {
    if (step * view.zoom < 5) step *= imp ? 5 : 10;
    ctx.strokeStyle = color; ctx.lineWidth = px(1); ctx.beginPath();
    for (let x = Math.floor(a.x / step) * step; x < b.x; x += step) { ctx.moveTo(x, a.y); ctx.lineTo(x, b.y); }
    for (let y = Math.floor(a.y / step) * step; y < b.y; y += step) { ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); }
    ctx.stroke();
  };
  if (minor && minor < major) lines(minor, '#eceef2');
  lines(major, '#dde1e7');
}

function drawTrace() {
  const t = S.doc.trace, as = t && S.assets[t.assetId];
  if (!as || !t.visible) return;
  if (!as._img) { as._img = new Image(); as._img.onload = requestDraw; as._img.src = as.data; Object.defineProperty(as, '_img', { enumerable: false }); }
  if (!as._img.complete || !as._img.naturalWidth) return;
  ctx.globalAlpha = t.opacity;
  ctx.drawImage(as._img, t.x, t.y, as._img.naturalWidth * t.scale, as._img.naturalHeight * t.scale);
  ctx.globalAlpha = 1;
}

const patterns = new Map();
function floorPattern(id) {
  if (!patterns.has(id)) { const p = ctx.createPattern(floorCanvas(id), 'repeat'); p.setTransform(new DOMMatrix().scale(getFloor(id).size / TEX)); patterns.set(id, p); }
  return patterns.get(id);
}

function drawRooms() {
  for (const r of S.rooms) {
    poly(r.poly);
    ctx.fillStyle = floorPattern(r.meta.floor); ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
    if (isSel('room', r.id)) { ctx.fillStyle = 'rgba(47,125,246,.16)'; ctx.fill(); }
  }
}
function drawRoomLabels() {
  if (!S.prefs.showLabels) return;
  for (const r of S.rooms) {
    if (r.bbox.w * view.zoom < 64 || r.bbox.h * view.zoom < 34) continue;
    const tiny = r.bbox.w * view.zoom < 110;
    text(r.c, r.meta.name, { size: tiny ? 10 : 12, bold: true, color: '#22262b', bg: 'rgba(255,255,255,.72)', dy: tiny ? 0 : -8 });
    if (!tiny) text(r.c, fmtArea(r.area, units()), { size: 10.5, color: '#4b525b', dy: 8 });
  }
}

function drawItem(it, ghost) {
  const sel = isSel('item', it.id), as = it.assetId && S.assets[it.assetId];
  ctx.save();
  ctx.translate(it.x, it.y); ctx.rotate(rad(it.rot));
  if (ghost) ctx.globalAlpha = 0.6;
  else if (it.elev > 1.3) ctx.globalAlpha = 0.55;
  drawSymbol(ctx, it, px(1), it.image || (as?.kind === 'image' ? as.data : as?.thumb), requestDraw);
  ctx.globalAlpha = 1;
  if (!ghost && !exporting && S.prefs.showIssues && analyze().flagged.has(it.id)) { ctx.strokeStyle = '#e2493b'; ctx.lineWidth = px(1.5); ctx.setLineDash([px(5), px(3)]); ctx.strokeRect(-it.w / 2, -it.d / 2, it.w, it.d); ctx.setLineDash([]); }
  if (sel && !exporting) { ctx.strokeStyle = ACCENT; ctx.lineWidth = px(2); ctx.strokeRect(-it.w / 2, -it.d / 2, it.w, it.d); }
  ctx.restore();
  const custom = ['box', 'cyl', 'lshape', 'product', 'model'].includes(it.type);
  if (custom && it.w * view.zoom > it.name.length * 5.5 && !(it.image || as?.thumb)) text(it, it.name, { size: 10, color: '#2a2e33' });
}

function drawWalls() {
  const sel = [];
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#1f2328'; ctx.lineWidth = px(2);
  for (const w of S.doc.walls) { const g = S.wallGeom.get(w.id); if (g) { poly(g.poly); ctx.stroke(); } }
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id); if (!g) continue;
    poly(g.poly); ctx.fillStyle = w.thickness < 0.1 ? '#7b8490' : WALL; ctx.fill();
    if (isSel('wall', w.id)) sel.push(g);
  }
  for (const g of sel) { poly(g.poly); ctx.fillStyle = ACCENT; ctx.fill(); }
}

function drawOpening(o, ghost) {
  const w = find('wall', o.wallId), g = w && S.wallGeom.get(w.id); if (!g) return;
  const pos = openingPos(o, g), t = w.thickness, hw = o.width / 2, sel = isSel('opening', o.id), s = o.side;
  ctx.save();
  ctx.translate(w.a.x, w.a.y); ctx.rotate(Math.atan2(g.dir.y, g.dir.x)); ctx.translate(pos, 0);
  if (ghost) ctx.globalAlpha = 0.65;
  ctx.fillStyle = o.type === 'window' ? '#dff0f8' : '#fbfbfc';
  ctx.strokeStyle = sel ? ACCENT : '#30343a'; ctx.lineWidth = px(sel ? 2 : 1);
  ctx.fillRect(-hw, -t / 2 - px(1), o.width, t + px(2));
  ctx.strokeRect(-hw, -t / 2, o.width, t);
  ctx.beginPath();
  if (o.type === 'window') { ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); if (o.style !== 'picture') { ctx.moveTo(0, -t / 2); ctx.lineTo(0, t / 2); } }
  else if (o.style === 'single' || o.style === 'double') {
    const leaf = (hx, dirx, r) => { ctx.moveTo(hx, 0); ctx.lineTo(hx, s * r); const a0 = (s * Math.PI) / 2, a1 = dirx > 0 ? 0 : Math.PI; ctx.moveTo(hx, s * r); ctx.arc(hx, 0, r, a0, a1, (s > 0) === (dirx > 0)); };
    if (o.style === 'single') leaf(o.hinge === 'left' ? -hw : hw, o.hinge === 'left' ? 1 : -1, o.width);
    else { leaf(-hw, 1, hw); leaf(hw, -1, hw); }
  } else if (o.style === 'sliding' || o.style === 'pocket') {
    ctx.rect(-hw, -t / 6 - px(1.5), hw + o.width * 0.05, px(3)); ctx.rect(-o.width * 0.05, t / 6 - px(1.5), hw + o.width * 0.05, px(3));
  } else if (o.style === 'bifold') {
    const q = o.width / 4;
    ctx.moveTo(-hw, 0); ctx.lineTo(-hw + q * 0.6, s * q); ctx.lineTo(-hw + q * 1.2, 0);
    ctx.moveTo(hw, 0); ctx.lineTo(hw - q * 0.6, s * q); ctx.lineTo(hw - q * 1.2, 0);
  } else { ctx.setLineDash([px(4), px(3)]); ctx.moveTo(-hw, -t / 2); ctx.lineTo(hw, -t / 2); ctx.moveTo(-hw, t / 2); ctx.lineTo(hw, t / 2); }
  ctx.stroke();
  ctx.restore();
  if (sel && !exporting) { // distances to both wall ends
    const c = add(w.a, mul(g.dir, pos));
    dimension(w.a, add(w.a, mul(g.dir, pos - hw)), 18 + (t * view.zoom) / 2, ACCENT);
    dimension(add(c, mul(g.dir, hw)), w.b, 18 + (t * view.zoom) / 2, ACCENT);
  }
}

function drawWallDims() {
  if (!S.prefs.showDims) return;
  const inRoom = p => S.rooms.some(r => pointInPoly(p, r.poly));
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id), sel = isSel('wall', w.id);
    if (!g || (g.len * view.zoom < 58 && !sel)) continue;
    // label the outside face of perimeter walls; interior walls only while selected (keeps rooms uncluttered)
    const mid = mul(add(w.a, w.b), 0.5), off = mul(g.n, w.thickness / 2 + 0.12), inP = inRoom(add(mid, off)), inM = inRoom(sub(mid, off));
    if (inP && inM && !sel) continue;
    dimension(w.a, w.b, (inP && !inM ? -1 : 1) * (14 + (w.thickness * view.zoom) / 2), sel ? ACCENT : '#7b838e');
  }
}

function drawOverlays() {
  const it = singleItem();
  // selected item: size read-out + handles
  if (it) {
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => add(it, rot({ x: (sx * it.w) / 2, y: (sy * it.d) / 2 }, it.rot)));
    dimension(c[1], c[0], 14, ACCENT); dimension(c[0], c[3], 14, ACCENT);
    if (!it.locked) for (const hd of itemHandles(it)) {
      if (hd.kind === 'rotate') { ctx.strokeStyle = ACCENT; ctx.lineWidth = px(1); line(add(it, rot({ x: 0, y: it.d / 2 }, it.rot)), hd.p); }
      ctx.beginPath(); ctx.arc(hd.p.x, hd.p.y, px(hd.kind === 'rotate' ? 6 : 4.5), 0, 7);
      ctx.fillStyle = hd.kind === 'rotate' ? ACCENT : '#fff'; ctx.fill(); ctx.strokeStyle = ACCENT; ctx.lineWidth = px(1.5); ctx.stroke();
    }
    // gaps to the surrounding walls while moving
    if (drag?.t === 'move' && drag.moved) for (const ang of [0, 90, 180, 270]) {
      const dir = rot({ x: 0, y: 1 }, it.rot + ang), half = ang % 180 ? it.w / 2 : it.d / 2, from = add(it, mul(dir, half));
      let best = Infinity;
      for (const w of S.doc.walls) { const hit = lineIntersect(from, dir, w.a, sub(w.b, w.a)); if (hit && hit.t > 0 && hit.u >= 0 && hit.u <= 1) best = Math.min(best, hit.t - w.thickness / 2); }
      if (best > 0.02 && best < 6) dimension(from, add(from, mul(dir, best)), 0, '#d0652a');
    }
  }
  // wall end points
  const pts = [];
  for (const w of selOf('wall')) pts.push(w.a, w.b);
  if (hover?.k === 'vertex') pts.push(hover.p);
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, px(5), 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = ACCENT; ctx.lineWidth = px(2); ctx.stroke(); }

  ctx.strokeStyle = '#f0559a'; ctx.lineWidth = px(1); ctx.setLineDash([px(4), px(4)]);
  for (const [a, b] of guides) line(a, b);
  ctx.setLineDash([]);
  if (snapMark) { ctx.strokeStyle = '#f0559a'; ctx.lineWidth = px(1.5); const r = px(6); if (snapMark.kind === 'vertex') ctx.strokeRect(snapMark.x - r, snapMark.y - r, 2 * r, 2 * r);
    else { ctx.beginPath(); snapMark.kind === 'mid' ? (ctx.moveTo(snapMark.x, snapMark.y - r), ctx.lineTo(snapMark.x + r, snapMark.y + r), ctx.lineTo(snapMark.x - r, snapMark.y + r), ctx.closePath()) : ctx.arc(snapMark.x, snapMark.y, r, 0, 7); ctx.stroke(); }
    if (snapMark.kind === 'mid') text(add(snapMark, { x: 0, y: -px(16) }), 'midpoint', { size: 10, color: '#f0559a' }); }

  if (S.tool === 'wall' && draft) {
    const to = preview || cursor, g = S.doc.settings.wallThickness;
    ctx.strokeStyle = 'rgba(58,63,71,.55)'; ctx.lineWidth = g; ctx.lineCap = 'butt'; line(draft.from, to); ctx.lineCap = 'butt';
    dimension(draft.from, to, -(14 + (g * view.zoom) / 2), ACCENT, typed ? `${typed}▏` : undefined);
    const v = sub(to, draft.from); if (dist(to, draft.from) > 0.05) text(add(draft.from, { x: 0, y: -px(16) }), `${Math.round(normDeg(-deg(Math.atan2(v.y, v.x))))}°`, { size: 10, color: '#6b7380' });
  }
  if (S.tool === 'arc' && arc) {
    ctx.strokeStyle = 'rgba(58,63,71,.55)'; ctx.lineWidth = S.doc.settings.wallThickness; ctx.lineJoin = 'round';
    const pts = arc.b ? arcPoints(arc.a, arc.b, cursor) : [arc.a, cursor];
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    if (!arc.b) dimension(arc.a, cursor, -18, ACCENT);
    else if (pts.radius) text(cursor, `radius ${L(pts.radius)}`, { size: 11, color: ACCENT, bg: 'rgba(255,255,255,.92)', dy: -16 });
  }
  if (drag?.t === 'room' && drag.b) {
    const { a, b } = drag; ctx.strokeStyle = 'rgba(58,63,71,.55)'; ctx.lineWidth = S.doc.settings.wallThickness;
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    dimension(a, { x: b.x, y: a.y }, a.y < b.y === a.x < b.x ? 16 : -16, ACCENT); dimension({ x: b.x, y: a.y }, b, a.y < b.y === a.x < b.x ? 16 : -16, ACCENT);
    text(mul(add(a, b), 0.5), fmtArea(Math.abs((b.x - a.x) * (b.y - a.y)), units()), { size: 12, bold: true, color: ACCENT });
  }
  if (drag?.t === 'marquee' && drag.b) {
    const { a, b } = drag; ctx.fillStyle = 'rgba(47,125,246,.1)'; ctx.strokeStyle = ACCENT; ctx.lineWidth = px(1);
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  if ((S.tool === 'door' || S.tool === 'window') && preview) drawOpening(preview, true);
  if (S.tool === 'place' && preview) drawItem(preview, true);
  const mf = S.tool === 'measure' ? measureFrom : S.tool === 'calibrate' ? calibFrom : null;
  if (mf) dimension(mf, cursor, 0, '#d0652a');
}

function draw() {
  raf = 0;
  const d = S.doc; if (!d || !ctx) return;
  const z = view.zoom;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = exporting ? '#ffffff' : '#f7f8fa'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - view.cx * z), dpr * (H / 2 - view.cy * z));
  if (!exporting) drawGrid();
  drawRooms();
  if (!exporting) drawTrace();
  if (S.prefs.showClear && !exporting) { const m = clearanceMap(); if (m) { ctx.imageSmoothingEnabled = false; ctx.drawImage(m.canvas, m.x0, m.y0, m.w, m.h); ctx.imageSmoothingEnabled = true; } }
  const flat = d.items.filter(i => getDef(i.type).flat), rest = d.items.filter(i => !getDef(i.type).flat).sort((a, b) => a.elev + a.h - (b.elev + b.h));
  flat.forEach(i => drawItem(i));
  rest.forEach(i => drawItem(i));
  drawWalls();
  d.openings.forEach(o => drawOpening(o));
  drawWallDims();
  drawRoomLabels();
  for (const m of d.dims) dimension(m.a, m.b, 0, isSel('dim', m.id) ? ACCENT : '#d0652a');
  for (const l of d.labels) text(l, l.text, { size: Math.max(7, l.size * z), bold: true, color: isSel('label', l.id) ? ACCENT : l.color || '#22262b' });
  if (!exporting) drawOverlays();
}

// ------------------------------------------------------------------ view
function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  if (!r.width || !r.height) return;
  W = r.width; H = r.height; dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  draw();
}

export function contentBounds() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ext = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const w of S.doc.walls) { ext(w.a.x, w.a.y); ext(w.b.x, w.b.y); }
  for (const i of S.doc.items) { const r = Math.hypot(i.w, i.d) / 2; ext(i.x - r, i.y - r); ext(i.x + r, i.y + r); }
  const t = S.doc.trace, im = t && S.assets[t.assetId]?._img;
  if (t?.visible && im?.naturalWidth) { ext(t.x, t.y); ext(t.x + im.naturalWidth * t.scale, t.y + im.naturalHeight * t.scale); }
  return x0 === Infinity ? { x0: 0, y0: 0, x1: 8, y1: 6 } : { x0, y0, x1, y1 };
}
export function zoomFit() {
  const b = contentBounds(), pad = 70;
  view.cx = (b.x0 + b.x1) / 2; view.cy = (b.y0 + b.y1) / 2;
  view.zoom = clamp(Math.min((W - pad * 2) / (b.x1 - b.x0 || 1), (H - pad * 2) / (b.y1 - b.y0 || 1)), 8, 400);
  emit('view'); requestDraw();
}
export function zoomBy(f, at = { x: W / 2, y: H / 2 }) {
  const before = s2w(at);
  view.zoom = clamp(view.zoom * f, 6, 1200);
  const after = s2w(at);
  view.cx += before.x - after.x; view.cy += before.y - after.y;
  emit('view'); requestDraw();
}
export function centerOn(p) { view.cx = p.x; view.cy = p.y; emit('view'); requestDraw(); }
export const viewCenter = () => ({ x: view.cx, y: view.cy });

export function exportPNG(scale = 2) {
  const b = contentBounds(), pad = 0.6, z = 90;
  const keep = { cv, ctx, W, H, dpr, v: { ...view } };
  const off = document.createElement('canvas');
  W = (b.x1 - b.x0 + pad * 2) * z; H = (b.y1 - b.y0 + pad * 2) * z; dpr = scale;
  off.width = W * dpr; off.height = H * dpr;
  ctx = off.getContext('2d'); view.cx = (b.x0 + b.x1) / 2; view.cy = (b.y0 + b.y1) / 2; view.zoom = z;
  patterns.clear(); exporting = true;
  try { draw(); } finally { exporting = false; patterns.clear(); ({ cv, ctx, W, H, dpr } = keep); Object.assign(view, keep.v); }
  draw();
  return off.toDataURL('image/png');
}

// ------------------------------------------------------------------ interaction
const evPos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

function wallEndRefs(points) {
  const refs = [];
  for (const w of S.doc.walls) for (const e of ['a', 'b']) if (points.some(p => dist(p, w[e]) < 0.012)) refs.push({ w, e, x: w[e].x, y: w[e].y });
  return refs;
}

function onDown(e) {
  cv.setPointerCapture(e.pointerId);
  mouse = evPos(e); const p = s2w(mouse);
  if (e.button === 1 || (e.button === 0 && (spaceDown || S.tool === 'pan'))) { drag = { t: 'pan', m: mouse, cx: view.cx, cy: view.cy }; cv.style.cursor = 'grabbing'; return; }
  if (e.button !== 0) return;
  const tool = S.tool;

  if (tool === 'select') {
    const hit = hitTest(p);
    if (hit?.k === 'handle') {
      const it = hit.item;
      drag = hit.kind === 'rotate' ? { t: 'rotate', it } : { t: 'resize', it, sx: hit.sx, sy: hit.sy, fixed: add(it, rot({ x: (-hit.sx * it.w) / 2, y: (-hit.sy * it.d) / 2 }, it.rot)) };
    } else if (hit?.k === 'vertex') {
      const refs = wallEndRefs([hit.p]);
      drag = { t: 'vertex', refs, anchor: refs.length ? { ...refs[0].w[refs[0].e === 'a' ? 'b' : 'a'] } : null };
    } else if (hit && hit.k !== 'room') {
      const was = isSel(hit.k, hit.id), w0 = hit.k === 'wall' && find('wall', hit.id);
      if (e.shiftKey) toggleSel(hit);
      else if (!was) select(w0?.grp && !e.altKey ? S.doc.walls.filter(w => w.grp === w0.grp).map(w => ({ k: 'wall', id: w.id })) : [hit]);
      // the first click on a piece only selects it; drag an already-selected piece (or its Move grip) to move it
      if (hit.k === 'item' && !was) { requestDraw(); return; }
      if (hit.k === 'opening') drag = { t: 'opening', o: find('opening', hit.id) };
      else if (hit.k !== 'dim') {
        const items = selOf('item').filter(i => !i.locked), walls = selOf('wall');
        const pts = []; walls.forEach(w => pts.push({ ...w.a }, { ...w.b }));
        drag = { t: 'move', start: p, moved: false, primary: hit.k === 'item' ? find('item', hit.id) : null,
          items: items.map(it => ({ it, x: it.x, y: it.y, rot: it.rot })), labels: selOf('label').map(o => ({ o, x: o.x, y: o.y })), refs: wallEndRefs(pts) };
        if (drag.primary?.locked) drag = null;
      }
    } else drag = { t: 'marquee', a: p, b: null, room: hit, shift: e.shiftKey };
  } else if (tool === 'wall') {
    const pt = preview || snap(p, { anchor: draft?.from, shift: e.shiftKey });
    placeWallPoint(pt);
  } else if (tool === 'arc') {
    const pt = snap(p, { anchor: arc && !arc.b ? arc.a : null, shift: e.shiftKey });
    if (!arc) arc = { a: { x: pt.x, y: pt.y } };
    else if (!arc.b) { if (dist(arc.a, pt) > 0.1) arc.b = { x: pt.x, y: pt.y }; }
    else { const walls = addPolyWalls(arcPoints(arc.a, arc.b, pt)); select(walls.map(w => ({ k: 'wall', id: w.id }))); arc = null; guides = []; snapMark = null; }
  } else if (tool === 'room') {
    drag = { t: 'room', a: snap(p), b: null };
  } else if (tool === 'door' || tool === 'window') {
    if (preview) { const { id, ...rest } = preview; const o = addOpening(rest.wallId, rest.pos, rest); select([{ k: 'opening', id: o.id }]); commit(); }
  } else if (tool === 'place') {
    if (preview) {
      const it = { ...preview, id: uid('it') };
      S.doc.items.push(it); commit();
      if (e.shiftKey) select([]); else { setTool('select'); select([{ k: 'item', id: it.id }]); }
    }
  } else if (tool === 'measure') {
    const pt = snap(p, { anchor: measureFrom, shift: e.shiftKey });
    if (!measureFrom) measureFrom = pt;
    else { if (dist(measureFrom, pt) > 0.02) { S.doc.dims.push({ id: uid('dm'), a: { x: measureFrom.x, y: measureFrom.y }, b: { x: pt.x, y: pt.y } }); commit(); } measureFrom = null; }
  } else if (tool === 'label') {
    const t = prompt('Label text:');
    if (t) { const l = { id: uid('lb'), x: p.x, y: p.y, text: t, size: 0.22 }; S.doc.labels.push(l); select([{ k: 'label', id: l.id }]); commit(); }
    setTool('select');
  } else if (tool === 'calibrate') {
    if (!calibFrom) calibFrom = p;
    else {
      const measured = dist(calibFrom, p), t = S.doc.trace;
      const ans = prompt(`Real-world length of this line? (e.g. ${units() === 'imperial' ? "12' 6\"" : '3.8 m'})`);
      const real = ans && parseLen(ans, units());
      if (real > 0 && measured > 0 && t) {
        const k = real / measured;
        t.x = calibFrom.x - (calibFrom.x - t.x) * k; t.y = calibFrom.y - (calibFrom.y - t.y) * k; t.scale *= k;
        commit(); emit('toast', `Image scaled ×${k.toFixed(3)}`);
      }
      calibFrom = null; setTool('select');
    }
  }
  requestDraw();
}

function placeWallPoint(pt) {
  if (!draft) { draft = { from: { x: pt.x, y: pt.y }, first: { x: pt.x, y: pt.y }, n: 0 }; return; }
  if (dist(draft.from, pt) < 0.03) return;
  addWall(draft.from, pt); commit();
  draft.n++;
  const closed = draft.n > 1 && dist(pt, draft.first) < 0.012;
  draft = closed ? null : { ...draft, from: { x: pt.x, y: pt.y } };
  typed = ''; preview = null;
}

function onMove(e) {
  mouse = evPos(e); const p = s2w(mouse); cursor = p;
  emit('cursor', p);
  if (drag) return onDrag(e, p);
  guides = []; snapMark = null;
  const tool = S.tool;
  if (tool === 'select') {
    const h2 = hitTest(p);
    if (h2?.k !== hover?.k || h2?.id !== hover?.id || h2?.k === 'vertex') { hover = h2; requestDraw(); }
    cv.style.cursor = spaceDown ? 'grab' : !h2 || h2.k === 'room' ? 'default' : h2.k === 'handle' ? (h2.kind === 'rotate' ? 'crosshair' : 'nwse-resize') : h2.k === 'vertex' ? 'move' : 'pointer';
    if (h2?.k === 'item') { const it = find('item', h2.id); status(`${it.name} — ${L(it.w)} × ${L(it.d)} × ${L(it.h)}`); }
    else if (h2?.k === 'wall') status(`Wall — ${L(S.wallGeom.get(h2.id).len)}`);
    else if (h2?.k === 'room') { const r = find('room', h2.id); status(`${r.meta.name} — ${fmtArea(r.area, units())}`); }
    else status('');
    return;
  }
  if (tool === 'wall') { preview = snap(p, { anchor: draft?.from, shift: e.shiftKey }); if (typed && draft) preview = typedPoint() || preview; }
  else if (tool === 'door' || tool === 'window') {
    const nw = nearestWall(p, 0.7), o = S.toolOpt;
    const width = o.width || (tool === 'door' ? 0.81 : 1.2);
    preview = nw && nw.g.len > width + 0.05 ? { id: '_', wallId: nw.w.id, type: tool, style: o.style || (tool === 'door' ? 'single' : 'standard'), width,
      height: o.height || (tool === 'door' ? 2.03 : 1.2), sill: o.sill ?? (tool === 'door' ? 0 : 0.9), hinge: 'left', side: nw.side,
      pos: clamp(S.prefs.snapGrid ? Math.round(nw.pos / S.doc.settings.snap) * S.doc.settings.snap : nw.pos, width / 2, nw.g.len - width / 2) } : null;
  } else if (tool === 'place') {
    const tpl = S.toolOpt.item, g = S.doc.settings.snap;
    let it = { ...tpl, x: S.prefs.snapGrid ? Math.round(p.x / g) * g : p.x, y: S.prefs.snapGrid ? Math.round(p.y / g) * g : p.y };
    if (S.prefs.magnet && !e.altKey) Object.assign(it, wallMagnet(it, true, 0.25));
    preview = it;
  } else if (tool === 'measure' || tool === 'calibrate') { const s = snap(p, { anchor: measureFrom, shift: e.shiftKey, grid: tool === 'measure' }); if (tool === 'measure') cursor = s; }
  else if (tool === 'room') snap(p);
  else if (tool === 'arc') cursor = snap(p, { anchor: arc && !arc.b ? arc.a : null, shift: e.shiftKey });
  requestDraw();
}

function typedPoint() {
  const len = parseLen(typed, units());
  if (!(len > 0) || !draft) return null;
  const dir = norm(sub(preview && dist(preview, draft.from) > 1e-6 ? preview : cursor, draft.from));
  return add(draft.from, mul(dir, len));
}

function onDrag(e, p) {
  const g = S.doc.settings.snap, gs = v => (S.prefs.snapGrid && !e.altKey ? Math.round(v / g) * g : v);
  const d = drag;
  if (d.t === 'pan') { view.cx = d.cx - (mouse.x - d.m.x) / view.zoom; view.cy = d.cy - (mouse.y - d.m.y) / view.zoom; emit('view'); }
  else if (d.t === 'move') {
    if (!d.moved && dist(w2s(p), w2s(d.start)) < 4) return;
    d.moved = true;
    let dx = gs(p.x - d.start.x), dy = gs(p.y - d.start.y);
    if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
    if (d.primary && d.items.length === 1 && !d.refs.length) {
      const o = d.items[0], it = o.it;
      it.x = o.x + dx; it.y = o.y + dy; it.rot = o.rot;
      if (S.prefs.magnet && !e.altKey) Object.assign(it, wallMagnet(it, getDef(it.type).mount === 'wall'));
      if (!e.altKey) centerGuides(it);
    } else for (const o of d.items) { o.it.x = o.x + dx; o.it.y = o.y + dy; }
    for (const o of d.labels) { o.o.x = o.x + (p.x - d.start.x); o.o.y = o.y + (p.y - d.start.y); }
    for (const r of d.refs) r.w[r.e] = { x: r.x + dx, y: r.y + dy };
    touch();
  } else if (d.t === 'vertex') {
    const mine = (w, e2) => d.refs.some(r => r.w === w && r.e === e2);
    const q = snap(p, { anchor: d.refs.length <= 2 ? d.anchor : null, exclude: mine, shift: e.shiftKey });
    for (const r of d.refs) r.w[r.e] = { x: q.x, y: q.y };
    d.moved = true; touch();
  } else if (d.t === 'opening') {
    const nw = nearestWall(p, 0.8), o = d.o;
    if (nw && nw.g.len > o.width) { o.wallId = nw.w.id; o.pos = clamp(gs(nw.pos), o.width / 2, nw.g.len - o.width / 2); d.moved = true; touch(); }
  } else if (d.t === 'rotate') {
    const v = sub(p, d.it); let a = deg(Math.atan2(v.y, v.x)) - 90;
    if (!e.altKey) a = Math.round(a / (e.shiftKey ? 45 : 5)) * (e.shiftKey ? 45 : 5);
    d.it.rot = normDeg(a); d.moved = true; status(`Rotation ${Math.round(d.it.rot)}°`); touch();
  } else if (d.t === 'resize') {
    const it = d.it, l = rot(sub({ x: gs(p.x), y: gs(p.y) }, d.fixed), -it.rot);
    it.w = Math.max(0.05, d.sx * l.x); it.d = Math.max(0.05, d.sy * l.y);
    const c = add(d.fixed, rot({ x: (d.sx * it.w) / 2, y: (d.sy * it.d) / 2 }, it.rot)); it.x = c.x; it.y = c.y;
    d.moved = true; touch();
  } else if (d.t === 'marquee') d.b = p;
  else if (d.t === 'room') d.b = snap(p);
  requestDraw();
}

// While a piece is dragged, snap it to the centre line between the facing walls and to other pieces' centres.
function centerGuides(it) {
  guides = [];
  const tol = px(6);
  for (const o of S.doc.items) {
    if (o === it || getDef(o.type).flat) continue;
    if (Math.abs(it.x - o.x) < tol && Math.abs(it.y - o.y) > 0.05) { it.x = o.x; guides.push([{ x: o.x, y: o.y }, { x: it.x, y: it.y }]); break; }
    if (Math.abs(it.y - o.y) < tol && Math.abs(it.x - o.x) > 0.05) { it.y = o.y; guides.push([{ x: o.x, y: o.y }, { x: it.x, y: it.y }]); break; }
  }
  for (const [lo, hi, u, v, half] of [['left', 'right', 'ux', 'uy', it.d / 2], ['back', 'front', 'uy', 'ux', it.w / 2]]) {
    const g = itemGaps(it), s = (g[hi] - g[lo]) / 2;
    if (!isFinite(s) || Math.abs(s) > tol || g[lo] < 0.03 || g[hi] < 0.03) continue;
    it.x += g[u].x * s; it.y += g[u].y * s;
    const ext = Math.max(half + 0.6, 1.2);
    guides.push([sub(it, mul(g[v], ext)), add(it, mul(g[v], ext))]);
    status('Centred between walls');
  }
}

/** Start moving the selected furniture from an external control (the Move grip on the selection toolbar). */
export function beginMove(e) {
  const items = selOf('item').filter(i => !i.locked);
  if (!items.length) return;
  mouse = evPos(e);
  drag = { t: 'move', start: s2w(mouse), moved: false, primary: items[0], items: items.map(it => ({ it, x: it.x, y: it.y, rot: it.rot })), labels: [], refs: [] };
  cv.setPointerCapture(e.pointerId);
}
/** Where the selection toolbar should sit for a piece (pane pixels, above its footprint). */
export function itemAnchor(it) { const s = w2s(it); return { x: s.x, y: s.y - (Math.hypot(it.w, it.d) / 2) * view.zoom, w: W, h: H }; }

function onUp(e) {
  const d = drag; drag = null;
  if (!d) return;
  if (d.t === 'pan') { cv.style.cursor = ''; return; }
  if (d.t === 'marquee') {
    const b = d.b;
    if (!b || dist(w2s(d.a), w2s(b)) < 5) select(d.room ? [d.room] : []);
    else {
      const x0 = Math.min(d.a.x, b.x), x1 = Math.max(d.a.x, b.x), y0 = Math.min(d.a.y, b.y), y1 = Math.max(d.a.y, b.y), inR = q => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
      select([...(d.shift ? S.sel : []), ...S.doc.items.filter(i => inR(i) && !i.locked).map(i => ({ k: 'item', id: i.id })), ...S.doc.walls.filter(w => inR(w.a) && inR(w.b)).map(w => ({ k: 'wall', id: w.id })), ...S.doc.labels.filter(inR).map(l => ({ k: 'label', id: l.id }))]);
    }
  } else if (d.t === 'room') {
    const { a, b } = d;
    if (b && Math.abs(b.x - a.x) > 0.3 && Math.abs(b.y - a.y) > 0.3) {
      const c = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
      c.forEach((q, i) => addWall(q, c[(i + 1) % 4]));
      commit(); setTool('select');
    }
  } else if (d.moved) commit();
  guides = []; snapMark = null;
  requestDraw();
}

function onWheel(e) {
  e.preventDefault();
  if (e.ctrlKey || !e.shiftKey) zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), evPos(e));
  else { view.cx += e.deltaY / view.zoom; requestDraw(); }
}

function onDblClick(e) {
  const p = s2w(evPos(e));
  if (S.tool === 'wall') { draft = null; preview = null; typed = ''; requestDraw(); return; }
  if (S.tool !== 'select') return;
  const hit = hitTest(p);
  if (hit?.k === 'room') { const r = find('room', hit.id), n = prompt('Room name:', r.meta.name); if (n) { r.meta.name = n; commit(); } }
  else if (hit?.k === 'label') { const l = find('label', hit.id), n = prompt('Label text:', l.text); if (n) { l.text = n; commit(); } }
  else if (hit?.k === 'wall') { splitWall(hit.id, p); emit('toast', 'Wall split — drag the new corner'); }
}

/** Keyboard input the editor wants first (typed wall lengths, cancel, finish). Returns true if consumed. */
export function handleKey(e) {
  if (e.type === 'keyup') { if (e.code === 'Space') { spaceDown = false; cv.style.cursor = ''; } return false; }
  if (e.code === 'Space') { spaceDown = true; cv.style.cursor = 'grab'; return true; }
  if (S.tool === 'wall' && draft && !e.ctrlKey && !e.metaKey) {
    if (/^[\d.'"]$/.test(e.key) || (typed && /^[ a-z]$/i.test(e.key))) { typed += e.key; preview = typedPoint() || preview; requestDraw(); return true; }
    if (e.key === 'Backspace' && typed) { typed = typed.slice(0, -1); requestDraw(); return true; }
    if (e.key === 'Enter') { const pt = typed && typedPoint(); if (pt) placeWallPoint(pt); else { draft = null; preview = null; } typed = ''; requestDraw(); return true; }
  }
  if (e.key === 'Escape') {
    if (drag) { drag = null; revert(); requestDraw(); return true; }
    if (typed) { typed = ''; requestDraw(); return true; }
    if (draft || measureFrom || calibFrom || arc) { draft = null; measureFrom = null; calibFrom = null; preview = null; arc = null; requestDraw(); return true; }
    if (S.tool !== 'select') { setTool('select'); return true; }
    if (S.sel.length) { select([]); return true; }
  }
  return false;
}

export function initEditor(canvas) {
  cv = canvas; ctx = cv.getContext('2d');
  new ResizeObserver(resize).observe(cv.parentElement);
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointerleave', () => { if (!drag) { preview = S.tool === 'wall' ? preview : null; hover = null; requestDraw(); } });
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('dblclick', onDblClick);
  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (S.tool === 'wall' && draft) { draft = null; preview = null; typed = ''; requestDraw(); return; }
    if (S.tool !== 'select') { setTool('select'); return; }
    const p = s2w(evPos(e)), hit = hitTest(p);
    if (hit && hit.k !== 'handle' && hit.k !== 'vertex' && !isSel(hit.k, hit.id)) select([hit]);
    else if (!hit) select([]);
    emit('contextmenu', { x: e.clientX, y: e.clientY, world: p, hit });
  });
  on('doc', requestDraw); on('sel', requestDraw); on('prefs', requestDraw);
  on('tool', () => {
    draft = null; measureFrom = null; calibFrom = null; preview = null; typed = ''; guides = []; snapMark = null; hover = null; arc = null;
    cv.style.cursor = { select: 'default', pan: 'grab' }[S.tool] || 'crosshair';
    status({ wall: 'Click to start a wall. Type a length + Enter for exact size. Double-click or Esc to finish.', room: 'Drag to draw a rectangular room.', arc: 'Curved wall: click the start, click the end, then move to set the curve and click.',
      door: 'Hover a wall and click to place a door.', window: 'Hover a wall and click to place a window.', measure: 'Click two points to add a dimension.',
      label: 'Click where the label should go.', place: 'Click to place. Shift-click to place several. Alt disables wall snapping.', calibrate: 'Click two points on the image that are a known distance apart.', pan: 'Drag to pan.' }[S.tool] || '');
    requestDraw();
  });
  resize();
}

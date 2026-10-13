// Space-planning analysis: room utilisation, collisions, blocked doors, clearances and a walkway heat-map.
import { S } from './state.js';
import { obbCorners, convexOverlap, pointInPoly, add, mul, rot, clamp } from './util.js';
import { getDef } from './catalog.js';
import { sits } from './ops.js';

const solid = it => !getDef(it.type).flat && it.elev < 1.9 && !(sits(it) && it.elev > 0.05); // things standing on furniture are not obstacles
const SEATS = ['chair', 'officechair', 'taskchair', 'stool', 'bench', 'ottoman'], TABLES = ['dining', 'dining_round', 'desk', 'desk_stand', 'desk_l', 'desk_slim', 'island', 'counter', 'coffee', 'coffee_round'];
const tucks = (seat, table) => SEATS.includes(seat.type) && TABLES.includes(table.type);
const footprint = it => it.w * it.d * (it.type === 'cyl' || /round|column$/.test(it.type) ? Math.PI / 4 : 1);

let cache = { v: -1, r: null };
export function analyze() {
  if (cache.v === S.version) return cache.r;
  const d = S.doc, issues = [], flagged = new Set();
  const flag = (msg, level, ...items) => { issues.push({ msg, level, sel: items.map(i => ({ k: 'item', id: i.id })) }); if (level !== 'info') items.forEach(i => flagged.add(i.id)); };

  const rooms = S.rooms.map(r => {
    const inside = d.items.filter(it => pointInPoly(it, r.poly));
    const used = inside.filter(it => solid(it) && it.elev < 0.6).reduce((s, it) => s + footprint(it), 0);
    const pct = r.area ? clamp(used / r.area, 0, 1) : 0;
    return { room: r, count: inside.length, used, pct, verdict: pct > 0.5 ? 'Crowded' : pct > 0.33 ? 'Full' : pct > 0.12 ? 'Balanced' : inside.length ? 'Open' : 'Empty' };
  });

  const solids = d.items.filter(solid), boxes = new Map(solids.map(it => [it.id, obbCorners(it, -0.015)]));
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    const a = solids[i], b = solids[j];
    if (a.elev >= b.elev + b.h - 0.02 || b.elev >= a.elev + a.h - 0.02) continue; // stacked, not colliding
    if (tucks(a, b) || tucks(b, a)) continue; // chairs slide under tables
    if (convexOverlap(boxes.get(a.id), boxes.get(b.id))) flag(`${a.name} overlaps ${b.name}`, 'warn', a, b);
  }

  for (const w of d.walls) {
    const g = S.wallGeom.get(w.id); if (!g) continue;
    const t = w.thickness / 2 - 0.02, quad = [add(w.a, mul(g.n, t)), add(w.b, mul(g.n, t)), add(w.b, mul(g.n, -t)), add(w.a, mul(g.n, -t))];
    for (const it of solids) if (convexOverlap(boxes.get(it.id), quad)) flag(`${it.name} runs into a wall`, 'warn', it);
  }

  for (const o of d.openings) {
    if (o.type !== 'door' || o.style === 'sliding' || o.style === 'opening') continue;
    const w = d.walls.find(x => x.id === o.wallId), g = w && S.wallGeom.get(w.id); if (!g) continue;
    const depth = o.style === 'bifold' ? o.width / 4 : o.style === 'double' ? o.width / 2 : o.width;
    const c = add(add(w.a, mul(g.dir, o.pos)), mul(g.n, o.side * (w.thickness / 2 + depth / 2)));
    const zone = obbCorners({ x: c.x, y: c.y, w: o.width - 0.06, d: depth - 0.04, rot: (Math.atan2(g.dir.y, g.dir.x) * 180) / Math.PI });
    for (const it of solids) if (convexOverlap(boxes.get(it.id), zone)) flag(`${it.name} blocks a door swing`, 'bad', it);
  }

  for (const it of solids) {
    const need = getDef(it.type).clear;
    if (!need || flagged.has(it.id)) continue;
    const c = add(it, rot({ x: 0, y: it.d / 2 + need / 2 }, it.rot));
    const zone = obbCorners({ x: c.x, y: c.y, w: it.w * 0.8, d: need - 0.04, rot: it.rot });
    const kitchen = getDef(it.type).cat === 'Kitchen';
    const hit = solids.find(o => o !== it && o.elev < 1 && !(kitchen && getDef(o.type).cat === 'Kitchen') && !tucks(o, it) && convexOverlap(boxes.get(o.id), zone));
    const room = S.rooms.find(r => pointInPoly(it, r.poly));
    const wallHit = room && zone.some(p => !pointInPoly(p, room.poly)) && !doorNear(c, need);
    if (hit) flag(`${it.name} needs ~${Math.round(need * 100)} cm clear in front (${hit.name} is in the way)`, 'info', it);
    else if (wallHit) flag(`${it.name} needs ~${Math.round(need * 100)} cm clear in front`, 'info', it);
  }

  for (const it of solids) if (S.rooms.length && !S.rooms.some(r => pointInPoly(it, r.poly))) flag(`${it.name} is outside every room`, 'info', it);

  const priced = d.items.filter(it => it.price || it.url);
  const r = { rooms, issues, flagged, priced, budget: d.items.reduce((s, it) => s + (+it.price || 0), 0), totalArea: S.rooms.reduce((s, x) => s + x.area, 0) };
  cache = { v: S.version, r };
  return r;
}

function doorNear(p, reach) {
  return S.doc.openings.some(o => {
    const w = S.doc.walls.find(x => x.id === o.wallId), g = w && S.wallGeom.get(w.id);
    if (!g) return false;
    const c = add(w.a, mul(g.dir, o.pos));
    return Math.hypot(c.x - p.x, c.y - p.y) < reach + o.width / 2;
  });
}

// Walkway map: every free floor cell is coloured by the width of the passage it sits in.
let clearCache = { v: -1, m: null };
export function clearanceMap() {
  if (clearCache.v === S.version) return clearCache.m;
  clearCache = { v: S.version, m: null };
  if (!S.rooms.length) return null;
  const cell = 0.06;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of S.rooms) { x0 = Math.min(x0, r.bbox.x0); y0 = Math.min(y0, r.bbox.y0); x1 = Math.max(x1, r.bbox.x1); y1 = Math.max(y1, r.bbox.y1); }
  const cols = Math.ceil((x1 - x0) / cell), rows = Math.ceil((y1 - y0) / cell);
  if (cols * rows > 1.2e6) return null;

  // rasterise free floor with a canvas: rooms white, then walls and furniture knocked out
  const cv = document.createElement('canvas'); cv.width = cols; cv.height = rows;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1 / cell, 0, 0, 1 / cell, -x0 / cell, -y0 / cell);
  const path = pts => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); };
  ctx.fillStyle = '#fff'; S.rooms.forEach(r => path(r.poly));
  ctx.fillStyle = '#000';
  for (const w of S.doc.walls) { const g = S.wallGeom.get(w.id); if (g) path(g.poly); }
  ctx.fillStyle = '#fff';
  for (const o of S.doc.openings) { // doorways are passable
    if (o.type !== 'door') continue;
    const w = S.doc.walls.find(x => x.id === o.wallId), g = w && S.wallGeom.get(w.id); if (!g) continue;
    const c = add(w.a, mul(g.dir, o.pos));
    path(obbCorners({ x: c.x, y: c.y, w: o.width, d: w.thickness + 0.02, rot: (Math.atan2(g.dir.y, g.dir.x) * 180) / Math.PI }));
  }
  ctx.fillStyle = '#000';
  for (const it of S.doc.items) if (solid(it) && it.elev < 1) path(obbCorners(it));
  const src = ctx.getImageData(0, 0, cols, rows).data;

  // two-pass chamfer distance transform (distance to nearest obstacle, in cells)
  const D = new Float32Array(cols * rows), BIG = 1e6;
  for (let i = 0; i < cols * rows; i++) D[i] = src[i * 4] > 127 ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : D[y * cols + x]);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x; if (!D[i]) continue;
    D[i] = Math.min(D[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
  }
  for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
    const i = y * cols + x; if (!D[i]) continue;
    D[i] = Math.min(D[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
  }
  // spread each cell's value to the local maximum so a corridor reads as one width, not a gradient
  const img = ctx.createImageData(cols, rows), R = Math.ceil(0.5 / cell);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x; if (!D[i]) continue;
    let m = D[i];
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) { const v = at(x + dx, y + dy); if (v > m && v >= Math.hypot(dx, dy)) m = v; }
    const width = m * cell * 2;
    const col = width < 0.6 ? [226, 74, 59] : width < 0.9 ? [240, 173, 48] : [86, 178, 108];
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = width < 0.9 ? 170 : 45;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(img, 0, 0);
  clearCache.m = { canvas: cv, x0, y0, w: cols * cell, h: rows * cell };
  return clearCache.m;
}

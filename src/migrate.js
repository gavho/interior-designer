// One-time fixes for plans saved before a correction to the apartment template, so saved work keeps its furniture.
import { uid } from './util.js';
import { buildSample, roomDetails, SCALE as NEW_SCALE } from './sample.js';

const S = 0.0128, P = (x, y) => ({ x: +(x * S).toFixed(4), y: +(y * S).toFixed(4) });
const near = (a, b) => Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02;

/** The NE bedroom corner: add the notch in the east wall, slope the window wall and make its panes floor-to-ceiling. */
function bedroomNook(doc) {
  const east = doc.walls.find(w => near(w.a, P(636, 512)) && near(w.b, P(636, 24)));
  const north = doc.walls.find(w => near(w.a, P(636, 24)) && near(w.b, P(312, 24)));
  if (!east || !north) return; // not the apartment plan, or the corner has already been edited by hand
  east.b = P(636, 86);
  north.a = P(636, 11);
  const base = { height: east.height, color: east.color, sides: east.sides };
  for (const [a, b, t] of [[[636, 86], [589.5, 86], 0.08], [[589.5, 86], [589.5, 38], 0.08], [[589.5, 38], [636, 38], 0.08], [[636, 38], [636, 11], east.thickness]])
    doc.walls.push({ ...base, id: uid('w'), a: P(...a), b: P(...b), thickness: t });
  doc.openings = doc.openings.filter(o => !(o.wallId === north.id && o.type === 'window'));
  for (const p of [51, 148, 244]) doc.openings.push({ id: uid('op'), wallId: north.id, pos: +(p * S).toFixed(4), type: 'window', style: 'picture', width: 1.2, height: 2.5, sill: 0.02, hinge: 'left', side: 1 });
}

/** Re-traced layout (exact walls, angled balcony, scale 0.0127 m/px): swap the old template's walls and windows for the new ones.
 *  Furniture, labels and dimensions are rescaled to the new scale so they keep their place; room names and floors carry over. */
function retrace(doc) {
  const has = (x1, y1, x2, y2) => doc.walls.some(w => (near(w.a, P(x1, y1)) && near(w.b, P(x2, y2))) || (near(w.a, P(x2, y2)) && near(w.b, P(x1, y1))));
  if (!(has(745, 512, 636, 512) && has(428, 932, 672, 932) && has(14, 160, 14, 885))) return; // not the old apartment template
  const fresh = buildSample(true), k = NEW_SCALE / S, sc = o => { o.x = +(o.x * k).toFixed(4); o.y = +(o.y * k).toFixed(4); };
  doc.walls = fresh.walls; doc.openings = fresh.openings;
  const old = Object.fromEntries((doc.roomMeta || []).map(r => [r.name, r]));
  doc.roomMeta = fresh.roomMeta.map(r => ({ ...r, floor: old[r.name]?.floor || r.floor }));
  for (const it of doc.items || []) sc(it);
  for (const l of doc.labels || []) sc(l);
  for (const d of doc.dims || []) { sc(d.a); sc(d.b); }
  if (doc.trace?.assetId === 'trace') Object.assign(doc.trace, { x: 0, y: 0, scale: NEW_SCALE });
  // columns, the mechanical chase and the shaft move to their measured spots
  for (const it of doc.items || []) {
    const f = fresh.items.find(n => n.locked && n.name === it.name && it.locked && Math.hypot(n.x - it.x, n.y - it.y) < 0.4);
    if (f) Object.assign(it, { x: f.x, y: f.y, w: f.w, d: f.d });
  }
  if (!doc.items.some(i => i.name === 'Shaft')) doc.items.push(fresh.items.find(i => i.name === 'Shaft'));
}

/** From the photos: facade windows sit on a 20" knee wall with a ledge, and the bedroom-corner enclosure has an access panel. */
function details(doc) {
  const Q = (x, y) => ({ x: x * NEW_SCALE, y: y * NEW_SCALE }), at = (a, b) => doc.walls.find(w => near(w.a, Q(...a)) && near(w.b, Q(...b)));
  if (!at([581, 593.5], [792.5, 593.5])) return; // not the re-traced apartment
  const facade = [at([8, 160.5], [8, 886.5]), at([297.5, 25 - 0.0406 * 283.5 + 8], [636, 25 - 0.0406 * 622 + 8])].filter(Boolean).map(w => w.id);
  for (const o of doc.openings) if (o.type === 'window' && facade.includes(o.wallId) && (o.sill ?? 0) < 0.1) { o.sill = 0.5; o.height = 1.98; }
  if (!doc.items.some(i => i.type === 'window_ledge')) doc.items.push(...roomDetails());
}

/** Glass walls drawn as one curtain wall (dark mullions, panes edge to edge) instead of separate framed windows. */
function curtain(doc) {
  const glass = new Set(doc.walls.filter(w => w.thickness >= 0.19).map(w => w.id));
  for (const o of doc.openings) if (o.type === 'window' && o.style === 'picture' && glass.has(o.wallId)) { o.style = 'curtain'; o.width = +(o.width + 4 * NEW_SCALE).toFixed(4); }
}

const FIXES = [['nook1', bedroomNook], ['layout2', retrace], ['details1', details], ['curtain1', curtain]];
export function migrate(doc) {
  doc.fixes = doc.fixes || [];
  for (const [id, fn] of FIXES) if (!doc.fixes.includes(id)) { if (Array.isArray(doc.walls)) fn(doc); doc.fixes.push(id); }
  return doc;
}

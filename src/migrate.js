// One-time fixes for plans saved before a correction to the apartment template, so saved work keeps its furniture.
import { uid } from './util.js';

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

const FIXES = [['nook1', bedroomNook]];
export function migrate(doc) {
  doc.fixes = doc.fixes || [];
  for (const [id, fn] of FIXES) if (!doc.fixes.includes(id)) { if (Array.isArray(doc.walls)) fn(doc); doc.fixes.push(id); }
  return doc;
}

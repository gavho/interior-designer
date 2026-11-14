// Sample project: a two-bedroom apartment traced from samples/next-chicago-il-floorplan.png.
// Coordinates below are pixels in that image (wall centre-lines, measured from the drawing's wall bands and mullions).
// SCALE converts them to metres: every labelled room measures true wall-to-wall at 0.0127 m/px (Entertain 412 × 426 px =
// 17'2" × 17'9"), and the unit's outline at that scale is 985 sq ft against the listed 980.
import { S, setDoc, newDoc } from './state.js';
import { uid, readAsDataURL } from './util.js';
import { makeItem } from './ops.js';

export const SCALE = 0.0127;
const m = v => +(v * SCALE).toFixed(4), P = (x, y) => ({ x: m(x), y: m(y) });
// wall thicknesses as drawn: solid exterior 11 px, interior 10 px, glass curtain wall 16 px, thin partitions 5–7 px
const EXT = 0.14, INT = 0.127, GLASS = 0.2, RAIL = 0.05, THIN = 0.075;
// The north facade is one straight line on a slight angle (about 2.3°): its outer face drops 25 px over 616 px.
const FACADE = x => 25 - 0.0406 * (x - 14);

export function buildSample(mine = false) {
  const doc = newDoc();
  doc.name = mine ? 'My apartment - 2 bed, 980 sq ft' : 'Sample apartment - 2 bed';
  if (mine) doc.settings.wallColor = '#cdc8bf'; // light greige paint, from the photos
  const W = {};
  const wall = (key, x1, y1, x2, y2, thickness, extra = {}) => { W[key] = { id: uid('w'), a: P(x1, y1), b: P(x2, y2), thickness, height: 2.6, ...extra }; doc.walls.push(W[key]); };
  const open = (key, posPx, type, o = {}) => doc.openings.push({ id: uid('op'), wallId: W[key].id, pos: m(posPx), type, style: type === 'door' ? 'single' : 'picture',
    width: type === 'door' ? 0.84 : 1.5, height: type === 'door' ? 2.03 : 1.9, sill: type === 'door' ? 0 : 0.3, hinge: 'left', side: 1, ...o });
  // floor-to-ceiling glass between two mullions (pixel positions along the wall)
  // glass between two mullions (pixel positions along the wall). Facade windows sit on a 20" knee wall with a ledge (as in the photos);
  // the glass facing the balcony runs floor to ceiling.
  const pane = (key, from, to, low = false) => open(key, (from + to) / 2, 'window', { width: m(to - from - 2), height: low ? 2.5 : 1.98, sill: low ? 0.02 : 0.5, style: 'curtain' });

  const gN = x => FACADE(x) + 8, rN = x => FACADE(x) + 3; // centre of the bedroom glass / of the balcony rail
  // balcony: a slight trapezoid under the angled facade
  wall('balW', 11.5, rN(11.5), 11.5, 160.5, RAIL, { height: 1.1 }); wall('balN', 11.5, rN(11.5), 297.5, rN(297.5), RAIL, { height: 1.1 });
  wall('balS', 8, 160.5, 297.5, 160.5, GLASS); wall('bedW', 297.5, rN(297.5), 297.5, 160.5, GLASS);
  // bedroom 1: angled window wall, then the east wall with its small exterior notch, leaving a nook by the corner
  wall('north', 297.5, gN(297.5), 636, gN(636), GLASS);
  wall('eastTop', 636, gN(636), 636, 37, EXT); wall('nookN', 636, 37, 589.5, 37, THIN); wall('nookW', 589.5, 37, 589.5, 86, THIN); wall('nookS', 589.5, 86, 636, 86, THIN);
  wall('bedJog', 297.5, 160.5, 312, 160.5, INT); wall('liveE', 312, 160.5, 312, 329.5, INT); wall('bed1S', 312, 329.5, 636, 329.5, INT);
  wall('clo1W', 433.5, 266.5, 433.5, 329.5, INT); wall('clo1N', 433.5, 266.5, 636, 266.5, INT); wall('kitStub', 433.5, 329.5, 433.5, 387, INT);
  // east side: kitchen wall, fridge alcove, laundry, entry
  wall('eastUp', 636, 86, 636, 519.5, EXT); wall('fridgeTop', 636, 519.5, 654.5, 519.5, THIN); wall('wdW', 654.5, 510, 654.5, 593.5, INT);
  wall('wdN', 654.5, 510, 743, 510, THIN); wall('wdE', 743, 510, 743, 593.5, THIN); wall('hallN', 581, 593.5, 792.5, 593.5, INT);
  wall('east', 792.5, 593.5, 792.5, 780, EXT); wall('coatS', 792.5, 780, 667.5, 780, EXT);
  // bath and the hall wall above it
  wall('hallS', 437.5, 722.5, 792.5, 722.5, INT); wall('bathE', 667.5, 722.5, 667.5, 850, INT); wall('showerN', 572, 850, 667.5, 850, EXT);
  wall('bathE2', 654, 850, 654, 932, EXT); wall('bathS', 654, 932, 437.5, 932, THIN); wall('bathW', 437.5, 932, 437.5, 722.5, THIN);
  // living / bedroom 2, the shaft and the pipe chase between the walk-in closet and the bath (not part of the unit)
  wall('west', 8, 160.5, 8, 886.5, GLASS); wall('liveS', 8, 597, 461, 597, INT);
  wall('shaftW', 395.5, 597, 395.5, 710.5, INT); wall('shaftE', 459, 597, 459, 722.5, THIN);
  wall('clo2N', 288.5, 710.5, 416, 710.5, INT); wall('clo2E', 416, 710.5, 416, 886.5, THIN); wall('clo2W', 288.5, 710.5, 288.5, 886.5, INT);
  wall('south', 8, 886.5, 416, 886.5, INT);

  // doors (centre of each opening as drawn)
  open('bed1S', 359 - 312, 'door', { side: -1, width: 0.86 }); open('liveS', 347.5 - 8, 'door', { hinge: 'right', width: 0.82 });
  open('hallS', 555.5 - 437.5, 'door', { hinge: 'right', width: 0.82 }); open('hallS', 721 - 437.5, 'door', { style: 'bifold', width: 0.85, side: -1 });
  open('hallN', 700 - 581, 'door', { style: 'bifold', width: 0.84 }); open('clo1N', 515 - 433.5, 'door', { style: 'bifold', width: 1.9, side: -1 });
  open('clo2W', 802.5 - 710.5, 'door', { width: 0.81 }); open('east', 673 - 593.5, 'door', { side: -1, width: 0.91 }); open('balS', 251 - 8, 'door', { side: -1, hinge: 'right', width: 0.88 });
  // floor-to-ceiling glass, pane by pane between the mullions
  for (const [a, b] of [[166, 257], [257, 348], [348, 439], [439, 529], [531, 592], [620, 709], [709, 797], [797, 886]]) pane('west', a - 160.5, b - 160.5);
  const along = x => (x - 297.5) * Math.hypot(1, 0.0406); // distance along the angled window wall
  for (const [a, b] of [[305, 348], [349, 444], [444, 541], [541, 631]]) pane('north', along(a), along(b));
  for (const [a, b] of [[34, 73], [78, 150]]) pane('bedW', a - rN(297.5), b - rN(297.5), true);
  for (const [a, b] of [[16, 115], [115, 213]]) pane('balS', a - 8, b - 8, true);

  // rooms (a seed point inside each one carries its name and floor finish)
  const MINE = { Balcony: 'concrete', Bathroom: 'tile' }; // dark walnut vinyl plank everywhere else, as in the photos
  for (const [name, floor0, x, y] of [['Balcony', 'deck', 160, 92], ['Bedroom 1', 'carpet', 470, 150], ['Closet', 'carpet', 530, 298], ['Living / Kitchen', 'oak', 250, 400], ['Laundry', 'tile_grey', 690, 552],
    ['Coat closet', 'oak', 735, 745], ['Bathroom', 'tile', 550, 825], ['Bedroom 2', 'carpet_grey', 150, 700], ['Walk-in closet', 'carpet_grey', 360, 800]])
  { const floor = mine ? MINE[name] || 'vinyl_walnut' : floor0;
    doc.roomMeta.push({ id: uid('rm'), name, floor, px: m(x), py: m(y) }); }

  const put = (type, x, y, rot = 0, extra = {}) => doc.items.push(makeItem(type, { x: m(x), y: m(y), rot, ...extra }));
  // structure
  for (const [x, y] of [[58.5, 205], [428, 65.5], [59.5, 639]]) put('column', x, y, 0, { w: 0.69, d: 0.69, name: 'Structural column', locked: true });
  put('box', 113.5, 635, 0, { w: 0.64, d: 0.82, h: 2.6, name: 'Mechanical chase', color: '#cfccc6', locked: true });
  put('box', 428.5, 637, 0, { w: 0.7, d: 0.76, h: 2.6, name: 'Shaft', color: '#8f8c86', locked: true });
  for (const it of roomDetails()) doc.items.push(it);
  if (mine) { furnishMine(put); doc.trace = { assetId: 'trace', x: 0, y: 0, scale: SCALE, opacity: 0.45, visible: false }; return doc; }
  // living
  put('rug', 205, 262, 90, { w: 2.74, d: 1.83 }); put('sofa3', 122, 262, 270); put('coffee', 212, 262, 90); put('tvstand', 289, 248, 90); put('tv', 302, 248, 90);
  put('armchair', 215, 385, 180); put('floorlamp', 122, 368); put('plant', 44, 566);
  put('dining', 330, 468, 0, { w: 1.6, d: 0.9 });
  for (const [x, y, r] of [[300, 424, 0], [360, 424, 0], [300, 512, 180], [360, 512, 180]]) put('chair', x, y, r);
  put('art', 190, 590, 180, { w: 1.2, h: 0.8 });
  // kitchen
  put('basecab', 470, 357, 0, { w: 0.78 }); put('range', 530, 359, 0); put('basecab', 595, 357, 0, { w: 0.9 }); put('wallcab', 470, 346, 0, { w: 0.78 }); put('wallcab', 595, 346, 0, { w: 0.9 });
  put('sinkcab', 603, 427, 90, { w: 1.08 }); put('dishwasher', 603, 493, 90); put('fridge', 610, 556, 90, { w: 0.84 });
  put('backsplash', 534, 335, 0, { w: 2.48 }); put('backsplash', 630, 452, 90, { w: 1.68 }); put('hood', 530, 352, 0);
  put('stackwd', 699, 552, 0);
  // bath
  put('vanity', 462, 797, 270, { w: 1.52 }); put('toilet', 469, 893, 270); put('tub', 633, 788, 90, { w: 1.4 }); put('shower', 613, 892, 90, { w: 0.83, d: 0.93 });
  // bedroom 1
  put('bed', 548, 177, 90); put('nightstand', 611, 106, 90); put('nightstand', 611, 250, 90); put('dresser', 338, 150, 270); put('tablelamp', 611, 106, 90);
  // bedroom 2
  put('bed', 165, 796, 180, { color: '#b7c4bd' }); put('nightstand', 82, 859, 180); put('nightstand', 250, 859, 180); put('desk', 262, 631, 0, { w: 1.1 }); put('officechair', 262, 676, 180); put('bookshelf', 44, 760, 270);
  // balcony
  put('lounger', 120, 95, 90); put('planter', 250, 40, 0); put('plant_small', 40, 135, 0);

  doc.trace = { assetId: 'trace', x: 0, y: 0, scale: SCALE, opacity: 0.45, visible: false };
  return doc;
}

// The real unit: kitchen as in the photos (wood-grain flat-panel cabinets, white quartz, linear glass mosaic, stainless appliances),
// bath and laundry fixtures, and the chosen sofa & chaise. Everything else is left empty to furnish.
/** Built-in details seen in the photos: the white knee wall and ledge under the facade windows, and the access panel on the
 *  enclosure in the bedroom corner (the notch in the plan). Also used to bring saved plans up to date. */
export function roomDetails() {
  const it = (type, x, y, rot, extra) => makeItem(type, { x: m(x), y: m(y), rot, locked: true, ...extra });
  const inner = x => FACADE(x) + 16, ang = Math.atan(-0.0406) * 180 / Math.PI; // inside face of the bedroom glass
  return [
    it('window_ledge', 467, inner(467) + 7, ang, { w: m(327) * Math.hypot(1, 0.0406), d: 0.178, name: 'Window ledge' }),        // bedroom 1, into the corner nook
    it('window_ledge', 23, 379, 270, { w: m(425), d: 0.178, name: 'Window ledge' }),                                             // living room
    it('window_ledge', 23, 742, 270, { w: m(279), d: 0.178, name: 'Window ledge' }),                                             // bedroom 2
    it('access_panel', 586, 61.5, 90, { name: 'Access panel (enclosure)' }),
  ];
}

function furnishMine(put) {
  const cab = { color: '#6e5646', color2: '#f1efea', grain: true, slab: true }, up = { ...cab, elev: 1.42, h: 0.98, d: 0.35 };
  put('basecab', 470, 357, 0, { ...cab, w: 0.78 }); put('range', 530, 359, 0, { name: 'Slide-in range (stainless)' }); put('basecab', 595, 357, 0, { ...cab, w: 0.9 });
  put('wallcab', 470, 346, 0, { ...up, w: 0.78 }); put('wallcab', 595, 346, 0, { ...up, w: 0.9 });
  put('wallcab', 530, 346, 0, { ...up, w: 0.76, elev: 1.9, h: 0.5 }); put('microwave', 530, 353, 0, { name: 'Over-the-range microwave', w: 0.76, d: 0.4, h: 0.42, elev: 1.46 });
  put('sinkcab', 603, 427, 90, { ...cab, w: 1.08 }); put('dishwasher', 603, 493, 90, { color2: '#c9ccd1' }); put('fridge', 610, 556, 90, { w: 0.84, name: 'French-door refrigerator (stainless)' });
  put('wallcab', 612, 556, 90, { ...up, w: 0.84, d: 0.6, elev: 1.85, h: 0.55 });
  put('backsplash', 534, 335, 0, { w: 2.48, tex: 'mosaic_glass', h: 0.5 }); put('backsplash', 630, 452, 90, { w: 1.68, tex: 'mosaic_glass', h: 0.5 });
  put('stackwd', 699, 552, 0);
  put('vanity', 462, 797, 270, { w: 1.52 }); put('toilet', 469, 893, 270); put('tub', 633, 788, 90, { w: 1.4 }); put('shower', 613, 892, 90, { w: 0.83, d: 0.93 });
  put('asyiah', 172, 524, 180);
}

/** Start a fresh copy of the real apartment (keeps the current plan in its saved slot, if it has one). */
export async function loadMine() {
  const assets = {};
  try {
    const r = await fetch('samples/next-chicago-il-floorplan.png');
    if (r.ok) assets.trace = { name: 'next-chicago-il-floorplan.png', kind: 'image', data: await readAsDataURL(await r.blob()) };
  } catch {}
  const doc = buildSample(true);
  if (!assets.trace) doc.trace = null;
  setDoc(doc, assets);
  S.sel = [];
}

export async function loadSample() {
  const assets = {};
  try {
    const r = await fetch('samples/next-chicago-il-floorplan.png');
    if (r.ok) assets.trace = { name: 'next-chicago-il-floorplan.png', kind: 'image', data: await readAsDataURL(await r.blob()) };
  } catch {}
  const doc = buildSample();
  if (!assets.trace) doc.trace = null;
  setDoc(doc, assets);
  S.sel = [];
}

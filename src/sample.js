// Sample project: a two-bedroom apartment traced from samples/next-chicago-il-floorplan.png.
// Coordinates below are pixels in that image; SCALE converts them to metres (17'2" living room width = 409 px).
import { S, setDoc, newDoc } from './state.js';
import { uid, readAsDataURL } from './util.js';
import { makeItem } from './ops.js';

const SCALE = 0.0128, m = v => +(v * SCALE).toFixed(4), P = (x, y) => ({ x: m(x), y: m(y) });
const EXT = 0.2, INT = 0.12, GLASS = 0.12, RAIL = 0.06;

export function buildSample() {
  const doc = newDoc();
  doc.name = 'Sample apartment - 2 bed';
  const W = {};
  const wall = (key, x1, y1, x2, y2, thickness, extra = {}) => { W[key] = { id: uid('w'), a: P(x1, y1), b: P(x2, y2), thickness, height: 2.6, ...extra }; doc.walls.push(W[key]); };
  const open = (key, posPx, type, o = {}) => doc.openings.push({ id: uid('op'), wallId: W[key].id, pos: m(posPx), type, style: type === 'door' ? 'single' : 'picture',
    width: type === 'door' ? 0.84 : 1.5, height: type === 'door' ? 2.03 : 1.9, sill: type === 'door' ? 0 : 0.3, hinge: 'left', side: 1, ...o });

  // perimeter
  wall('west', 14, 160, 14, 885, GLASS); wall('south', 14, 885, 428, 885, EXT); wall('bathW', 428, 716, 428, 932, INT); wall('bathS', 428, 932, 672, 932, EXT);
  wall('bathE', 672, 932, 672, 775, EXT); wall('coatW', 672, 775, 672, 716, INT); wall('coatS', 672, 775, 798, 775, EXT); wall('east', 798, 775, 798, 592, EXT);
  wall('entryN', 798, 592, 745, 592, EXT); wall('wdE', 745, 592, 745, 512, EXT); wall('wdN', 745, 512, 636, 512, EXT); wall('eastUp', 636, 512, 636, 24, EXT);
  wall('north', 636, 24, 312, 24, GLASS); wall('bedW', 312, 24, 312, 160, GLASS);
  wall('balN', 312, 24, 14, 24, RAIL, { height: 1.1 }); wall('balW', 14, 24, 14, 160, RAIL, { height: 1.1 }); wall('balS', 14, 160, 312, 160, GLASS);
  // interior
  wall('liveE', 312, 160, 312, 328, INT); wall('bed1S', 312, 328, 636, 328, INT); wall('clo1W', 436, 268, 436, 328, INT); wall('clo1N', 436, 268, 636, 268, INT);
  wall('kitStub', 436, 328, 436, 386, INT); wall('liveS', 14, 598, 460, 598, INT); wall('shaftW', 392, 598, 392, 716, INT); wall('shaftE', 460, 598, 460, 716, INT);
  wall('mid', 290, 716, 798, 716, INT); wall('clo2W', 290, 716, 290, 885, INT); wall('wdW', 636, 512, 636, 592, INT); wall('wdS', 636, 592, 745, 592, INT);

  // doors
  open('bed1S', 48, 'door', { side: -1 }); open('liveS', 333, 'door', { hinge: 'right', width: 0.82 });
  open('mid', 265, 'door', { hinge: 'right', width: 0.82 }); open('mid', 432, 'door', { style: 'bifold', width: 0.8, side: -1 });
  open('wdS', 55, 'door', { style: 'bifold', width: 0.9 }); open('clo1N', 81, 'door', { style: 'bifold', width: 1.8, side: -1 });
  open('clo2W', 93, 'door', { width: 0.74 }); open('east', 102, 'door', { side: -1, width: 0.91 }); open('balS', 238, 'door', { side: -1, hinge: 'right', width: 0.9 });
  // windows
  for (const p of [110, 245, 370]) open('west', p, 'window', { width: 1.5 });
  for (const p of [528, 650]) open('west', p, 'window', { width: 1.2 });
  open('north', 76, 'window'); open('north', 236, 'window'); open('bedW', 68, 'window', { width: 1.2 }); open('balS', 96, 'window', { width: 1.8 });

  // rooms (a seed point inside each one carries its name and floor finish)
  for (const [name, floor, x, y] of [['Balcony', 'deck', 160, 92], ['Bedroom 1', 'carpet', 470, 150], ['Closet', 'carpet', 530, 298], ['Living / Kitchen', 'oak', 250, 400], ['Laundry', 'tile_grey', 690, 552],
    ['Coat closet', 'oak', 735, 745], ['Bathroom', 'tile', 550, 825], ['Bedroom 2', 'carpet_grey', 150, 700], ['Walk-in closet', 'carpet_grey', 360, 800], ['Shaft', 'concrete', 426, 655]])
    doc.roomMeta.push({ id: uid('rm'), name, floor, px: m(x), py: m(y) });

  const put = (type, x, y, rot = 0, extra = {}) => doc.items.push(makeItem(type, { x: m(x), y: m(y), rot, ...extra }));
  // structure
  for (const [x, y] of [[58, 205], [428, 65], [58, 640]]) put('column', x, y, 0, { w: 0.72, d: 0.72, name: 'Structural column', locked: true });
  put('box', 112, 634, 0, { w: 0.58, d: 0.82, h: 2.6, name: 'Mechanical chase', color: '#cfccc6', locked: true });
  // living
  put('rug', 205, 262, 90, { w: 2.74, d: 1.83 }); put('sofa3', 122, 262, 270); put('coffee', 212, 262, 90); put('tvstand', 289, 248, 90); put('tv', 302, 248, 90);
  put('armchair', 215, 385, 180); put('floorlamp', 122, 368); put('plant', 44, 566);
  put('dining', 330, 468, 0, { w: 1.6, d: 0.9 });
  for (const [x, y, r] of [[300, 424, 0], [360, 424, 0], [300, 512, 180], [360, 512, 180]]) put('chair', x, y, r);
  put('art', 190, 590, 180, { w: 1.2, h: 0.8 });
  // kitchen
  put('basecab', 470, 357, 0, { w: 0.78 }); put('range', 530, 359, 0); put('basecab', 595, 357, 0, { w: 0.9 }); put('wallcab', 470, 346, 0, { w: 0.78 }); put('wallcab', 595, 346, 0, { w: 0.9 });
  put('sinkcab', 603, 427, 90, { w: 1.08 }); put('dishwasher', 603, 493, 90); put('fridge', 598, 553, 90, { w: 0.86 });
  put('backsplash', 534, 334, 0, { w: 2.48 }); put('backsplash', 627, 452, 90, { w: 1.68 }); put('hood', 530, 352, 0);
  put('stackwd', 690, 551, 0);
  // bath
  put('vanity', 455, 792, 270, { w: 1.52 }); put('toilet', 462, 900, 270); put('tub', 633, 782, 90); put('shower', 627, 887, 90);
  // bedroom 1
  put('bed', 548, 165, 90); put('nightstand', 611, 86, 90); put('nightstand', 611, 242, 90); put('dresser', 338, 150, 270); put('tablelamp', 611, 86, 90);
  // bedroom 2
  put('bed', 165, 796, 180, { color: '#b7c4bd' }); put('nightstand', 82, 859, 180); put('nightstand', 250, 859, 180); put('desk', 262, 631, 0, { w: 1.1 }); put('officechair', 262, 676, 180); put('bookshelf', 44, 760, 270);
  // balcony
  put('lounger', 120, 95, 90); put('planter', 250, 40, 0); put('plant_small', 40, 135, 0);

  doc.trace = { assetId: 'trace', x: 0, y: 0, scale: SCALE, opacity: 0.45, visible: false };
  return doc;
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

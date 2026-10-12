// Procedural floor finishes (shared by the 2D plan and the 3D view) and whole-home style palettes.
import { shade } from './util.js';

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

const wood = (base, rows = 8) => (ctx, N) => {
  const r = rng(7), rh = N / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * N * 0.5;
    while (x < N) {
      const pw = N * (0.35 + r() * 0.4);
      ctx.fillStyle = shade(base, (r() - 0.5) * 0.16); ctx.fillRect(x, i * rh, pw, rh);
      ctx.strokeStyle = 'rgba(0,0,0,.07)';
      for (let g = 0; g < 3; g++) { const y = i * rh + r() * rh; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + pw, y + (r() - 0.5) * 3); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + pw - 1, i * rh, 1, rh);
      x += pw;
    }
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, i * rh, N, 1);
  }
};
const tile = (base, n, grout = 'rgba(0,0,0,.16)', alt) => (ctx, N) => {
  const r = rng(3), t = N / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = alt && (i + j) % 2 ? alt : shade(base, (r() - 0.5) * 0.05); ctx.fillRect(i * t, j * t, t, t); }
  ctx.fillStyle = grout;
  for (let i = 0; i < n; i++) { ctx.fillRect(i * t, 0, 2, N); ctx.fillRect(0, i * t, N, 2); }
};
const speckle = (base, amt, count = 5000) => (ctx, N) => {
  const r = rng(11);
  ctx.fillStyle = base; ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < count; i++) { ctx.fillStyle = shade(base, (r() - 0.5) * amt); ctx.fillRect(r() * N, r() * N, 2, 2); }
};
const marble = base => (ctx, N) => {
  const r = rng(5);
  tile(base, 2, 'rgba(0,0,0,.1)')(ctx, N);
  ctx.strokeStyle = 'rgba(90,95,105,.22)';
  for (let i = 0; i < 9; i++) { let x = r() * N, y = r() * N; ctx.lineWidth = 0.5 + r() * 1.5; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 60; y += (r() - 0.5) * 50; ctx.lineTo(x, y); } ctx.stroke(); }
};

// `size` = real-world metres covered by one texture tile.
export const FLOORS = [
  { id: 'oak', name: 'Oak', color: '#c9a26b', size: 1.2, kind: 'wood', draw: wood('#c9a26b') },
  { id: 'maple', name: 'Light maple', color: '#e2cfa9', size: 1.2, kind: 'wood', draw: wood('#e2cfa9') },
  { id: 'walnut', name: 'Walnut', color: '#7b5539', size: 1.2, kind: 'wood', draw: wood('#7b5539') },
  { id: 'greywood', name: 'Grey-wash wood', color: '#a8a096', size: 1.2, kind: 'wood', draw: wood('#a8a096') },
  { id: 'tile', name: 'White tile', color: '#e9e8e4', size: 1.2, kind: 'tile', draw: tile('#e9e8e4', 4) },
  { id: 'tile_grey', name: 'Grey tile', color: '#b9bbbd', size: 1.2, kind: 'tile', draw: tile('#b9bbbd', 2) },
  { id: 'slate', name: 'Slate tile', color: '#575b60', size: 1.2, kind: 'tile', draw: tile('#575b60', 2, 'rgba(0,0,0,.3)') },
  { id: 'checker', name: 'Checkerboard', color: '#bdbdbd', size: 1.2, kind: 'tile', draw: tile('#f1f1ee', 4, 'rgba(0,0,0,.1)', '#34363a') },
  { id: 'marble', name: 'Marble', color: '#eeecea', size: 1.6, kind: 'tile', draw: marble('#eeecea') },
  { id: 'carpet', name: 'Beige carpet', color: '#d5c8b4', size: 1, kind: 'soft', draw: speckle('#d5c8b4', 0.12) },
  { id: 'carpet_grey', name: 'Grey carpet', color: '#a5a7aa', size: 1, kind: 'soft', draw: speckle('#a5a7aa', 0.12) },
  { id: 'concrete', name: 'Concrete', color: '#b3b1ac', size: 2, kind: 'hard', draw: speckle('#b3b1ac', 0.07, 2500) },
  { id: 'deck', name: 'Outdoor decking', color: '#9b8468', size: 1.2, kind: 'outdoor', draw: wood('#9b8468', 6) },
  { id: 'grass', name: 'Grass', color: '#7da564', size: 1.5, kind: 'outdoor', draw: speckle('#7da564', 0.22, 9000) },
];
const byId = Object.fromEntries(FLOORS.map(f => [f.id, f]));
export const getFloor = id => byId[id] || byId.oak;

const canvases = new Map();
export const TEX = 256;
export function floorCanvas(id) {
  if (!canvases.has(id)) {
    const c = document.createElement('canvas'); c.width = c.height = TEX;
    const ctx = c.getContext('2d'), f = getFloor(id);
    ctx.fillStyle = f.color; ctx.fillRect(0, 0, TEX, TEX);
    f.draw(ctx, TEX);
    canvases.set(id, c);
  }
  return canvases.get(id);
}

// ---- wall finishes (per wall side) and tiled surfaces such as backsplashes ----
const courses = (base, joint, rows, per, vary = 0.14) => (ctx, N) => {
  const r = rng(13), rh = N / rows, bw = N / per, j = Math.max(1.5, N / 130);
  ctx.fillStyle = joint; ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < rows; i++) for (let k = -1; k <= per; k++) {
    ctx.fillStyle = shade(base, (r() - 0.5) * vary);
    ctx.fillRect(k * bw + (i % 2 ? bw / 2 : 0) + j / 2, i * rh + j / 2, bw - j, rh - j);
  }
};
const slats = (base, n, horizontal) => (ctx, N) => {
  const r = rng(17), s = N / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shade(base, (r() - 0.5) * 0.08);
    horizontal ? ctx.fillRect(0, i * s, N, s) : ctx.fillRect(i * s, 0, s, N);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    horizontal ? ctx.fillRect(0, i * s, N, 2) : ctx.fillRect(i * s, 0, 3, N);
  }
};
const stripes = (c1, c2, n) => (ctx, N) => { for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect((i * N) / n, 0, N / n + 1, N); } };
const diamonds = (bg, fg) => (ctx, N) => {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, N, N); ctx.strokeStyle = fg; ctx.lineWidth = 2.5;
  const s = N / 4;
  for (let i = -1; i < 5; i++) for (let k = -1; k < 5; k++) { const x = i * s + (k % 2 ? s / 2 : 0), y = k * s / 2; ctx.beginPath(); ctx.moveTo(x, y - s / 2.6); ctx.lineTo(x + s / 2.6, y); ctx.lineTo(x, y + s / 2.6); ctx.lineTo(x - s / 2.6, y); ctx.closePath(); ctx.stroke(); }
};
const hexes = (base, grout) => (ctx, N) => {
  ctx.fillStyle = grout; ctx.fillRect(0, 0, N, N);
  const R = N / 8, hgt = R * Math.sqrt(3), r = rng(23);
  for (let row = -1; row < 6; row++) for (let col = -1; col < 7; col++) {
    const cx = col * R * 1.5, cy = row * hgt + (col % 2 ? hgt / 2 : 0);
    ctx.fillStyle = shade(base, (r() - 0.5) * 0.06); ctx.beginPath();
    for (let a = 0; a < 6; a++) ctx.lineTo(cx + (R - 1.6) * Math.cos((a * Math.PI) / 3), cy + (R - 1.6) * Math.sin((a * Math.PI) / 3));
    ctx.fill();
  }
};
export const WALL_FINISHES = [
  { id: 'paint', name: 'Paint (flat colour)' },
  { id: 'brick', name: 'Red brick', color: '#a5563f', size: 0.9, draw: courses('#a5563f', '#cfc6b8', 12, 4) },
  { id: 'brick_white', name: 'Painted brick', color: '#eeece6', size: 0.9, draw: courses('#eeece6', '#d2cfc7', 12, 4, 0.04) },
  { id: 'stone', name: 'Stone', color: '#a9a69f', size: 1.5, draw: courses('#a9a69f', '#6f6c66', 6, 3, 0.2) },
  { id: 'subway', name: 'Subway tile', color: '#f3f4f2', size: 0.6, draw: courses('#f3f4f2', '#c4c7c8', 8, 4, 0.03) },
  { id: 'subway_green', name: 'Green subway tile', color: '#6f9484', size: 0.6, draw: courses('#6f9484', '#e3e6e2', 8, 4, 0.1) },
  { id: 'subway_navy', name: 'Navy tile', color: '#2f4760', size: 0.6, draw: courses('#2f4760', '#d9dde0', 8, 4, 0.1) },
  { id: 'tile_sq', name: 'Square tile', color: '#eceeed', size: 0.6, draw: tile('#eceeed', 6, 'rgba(0,0,0,.2)') },
  { id: 'hex', name: 'Hex tile', color: '#f1f1ee', size: 0.4, draw: hexes('#f1f1ee', '#b9bcbd') },
  { id: 'marble_slab', name: 'Marble slab', color: '#eeecea', size: 2.4, draw: marble('#eeecea') },
  { id: 'wood_slat', name: 'Wood slat panel', color: '#a77b4f', size: 0.6, draw: slats('#a77b4f', 10, false) },
  { id: 'walnut_panel', name: 'Walnut panelling', color: '#6f4a30', size: 1.2, draw: slats('#6f4a30', 4, false) },
  { id: 'shiplap', name: 'Shiplap', color: '#f2f1ec', size: 1.2, draw: slats('#f2f1ec', 8, true) },
  { id: 'stripe', name: 'Striped wallpaper', color: '#d9dfe2', size: 0.5, draw: stripes('#eef1f2', '#c5d0d6', 6) },
  { id: 'geo', name: 'Geometric wallpaper', color: '#e9e4d8', size: 0.6, draw: diamonds('#ece7db', '#b9a988') },
  { id: 'geo_dark', name: 'Dark geometric wallpaper', color: '#2c3a40', size: 0.6, draw: diamonds('#2c3a40', '#c9a24a') },
  { id: 'concrete_wall', name: 'Concrete', color: '#b3b1ac', size: 2, draw: speckle('#b3b1ac', 0.07, 2500) },
];
const finishById = Object.fromEntries(WALL_FINISHES.map(f => [f.id, f]));
export const getFinish = id => finishById[id] || finishById.paint;
export function finishCanvas(id) {
  const key = 'wall:' + id;
  if (!canvases.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = TEX;
    const ctx = c.getContext('2d'), f = getFinish(id);
    ctx.fillStyle = f.color || '#fff'; ctx.fillRect(0, 0, TEX, TEX);
    f.draw?.(ctx, TEX);
    canvases.set(key, c);
  }
  return canvases.get(key);
}

// Wood species for furniture and cabinetry (colour + visible grain in 3D).
export const WOODS = [['Maple', '#e0c9a0'], ['White oak', '#d3bd97'], ['Oak', '#c39a62'], ['Teak', '#a8743f'], ['Cherry', '#96563a'], ['Walnut', '#6f4a30'], ['Espresso', '#3b2a22'], ['Ebony', '#25211f'], ['Grey ash', '#9c958b'], ['Whitewash', '#e9e4da']];
export const COUNTERS = [['White quartz', '#f1efea'], ['Butcher block', '#b9824f'], ['Grey quartz', '#9d9c98'], ['Soapstone', '#4a4f52'], ['Black granite', '#232427'], ['Terrazzo', '#d9d2c8']];
export function grainCanvas() {
  if (!canvases.has('grain')) {
    const c = document.createElement('canvas'); c.width = c.height = TEX;
    const ctx = c.getContext('2d'), r = rng(29);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 150; i++) {
      let y = r() * TEX; ctx.strokeStyle = `rgba(40,25,10,${0.03 + r() * 0.11})`; ctx.lineWidth = 0.5 + r() * 1.6;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= TEX; x += 32) { y += (r() - 0.5) * 5; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    canvases.set('grain', c);
  }
  return canvases.get('grain');
}

// Style palettes recolour walls, floors and furniture in one click.
export const PALETTES = [
  { id: 'scandi', name: 'Scandinavian', wall: '#f5f3ee', floor: 'maple', wood: '#d9c3a0', fabric: ['#cfd4d6', '#e6e0d4', '#9fb0b3'], accent: ['#d7c9b1', '#8fa3a8', '#e3b9a0'], cabinet: '#f4f2ee', counter: '#d8d4cc' },
  { id: 'midcentury', name: 'Mid-century', wall: '#f1e9da', floor: 'walnut', wood: '#8a5a36', fabric: ['#c9772f', '#55707a', '#b7a56a'], accent: ['#d99a2b', '#2f6d6a', '#b84a32'], cabinet: '#8a5a36', counter: '#efe9de' },
  { id: 'industrial', name: 'Industrial loft', wall: '#d9d6d1', floor: 'concrete', wood: '#5b4636', fabric: ['#4a4d52', '#7b6a5a', '#8d9399'], accent: ['#b0652f', '#2b2d31', '#8a8f94'], cabinet: '#3a3d42', counter: '#8b8d90' },
  { id: 'coastal', name: 'Coastal', wall: '#f4f7f7', floor: 'greywood', wood: '#d3c3a8', fabric: ['#eef0ec', '#8fb3c4', '#c9d9de'], accent: ['#3f7f9c', '#e2cfa9', '#9cc3c9'], cabinet: '#ffffff', counter: '#cfd8da' },
  { id: 'japandi', name: 'Japandi', wall: '#ece6db', floor: 'oak', wood: '#b79a74', fabric: ['#d6cdbf', '#7f7a6c', '#a7a08f'], accent: ['#3d3f3a', '#b9a78a', '#8a9a80'], cabinet: '#c9b08a', counter: '#3d3f3a' },
  { id: 'boho', name: 'Bohemian', wall: '#f6eee2', floor: 'oak', wood: '#a8794d', fabric: ['#c6714e', '#d9b25f', '#6f8f72'], accent: ['#b4533c', '#e0a84a', '#4d7f7a'], cabinet: '#e9dfcf', counter: '#a8794d' },
  { id: 'modern', name: 'Modern mono', wall: '#fafafa', floor: 'greywood', wood: '#2e2f33', fabric: ['#3a3c41', '#b7b9bd', '#e5e5e3'], accent: ['#1c1d20', '#c9a24a', '#8a8d92'], cabinet: '#f5f5f3', counter: '#1f2023' },
  { id: 'farmhouse', name: 'Modern farmhouse', wall: '#f7f4ec', floor: 'oak', wood: '#9a7650', fabric: ['#e7e1d3', '#8c9a8a', '#b9a78f'], accent: ['#51614f', '#c9b79c', '#2f3432'], cabinet: '#f5f2ea', counter: '#5a4a3c' },
];

export const SWATCHES = ['#f6f5f2', '#e6e0d4', '#d5c8b4', '#b9a48c', '#a47a4f', '#7b5539', '#3b2f25', '#2b2d31', '#8a9aa3', '#55707a', '#3f7f9c', '#2f6d6a', '#6f8f72', '#4f8a4a', '#d9b25f', '#c9772f', '#b84a32', '#c98f6b', '#a05a6c', '#6a5a8c'];

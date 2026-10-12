// Parametric furniture catalogue. Every piece is described as simple solids sized from (w, d, h),
// so one definition drives the 3D mesh, the 2D plan symbol and the catalogue thumbnail, and any
// piece can be resized freely. Local axes: x = width, y = up, z = depth (back of the piece is -z).
import { shade, rad } from './util.js';

const bx = (x, y, z, w, h, d, c, o) => ({ s: 'box', x, y, z, w, h, d, c, ...o });
const cy = (x, y, z, dia, h, c, o) => ({ s: 'cyl', x, y, z, w: dia, h, d: dia, c, ...o });
const sp = (x, y, z, w, h, d, c) => ({ s: 'sph', x, y, z, w, h, d, c });
const disc = (x, y, z, dia, t, c) => ({ s: 'disc', x, y, z, w: dia, h: dia, d: t, c }); // round face pointing forward
const legs = (w, d, h, t, c, i = 0.03) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => bx(sx * (w / 2 - i - t / 2), 0, sz * (d / 2 - i - t / 2), t, h, t, c));

const sofa = n => (w, d, h) => {
  const arm = Math.min(0.2, w * 0.14), back = Math.min(0.22, d * 0.26), sh = Math.min(0.43, h * 0.55), base = 0.1, iw = w - 2 * arm;
  const out = [...legs(w, d, base, 0.05, 'dark'), bx(0, base, 0, w, sh - base - 0.12, d, 'a-'), bx(0, base, -d / 2 + back / 2, w, h - base, back, 'a'),
    bx(-w / 2 + arm / 2, base, 0, arm, h * 0.7 - base, d, 'a'), bx(w / 2 - arm / 2, base, 0, arm, h * 0.7 - base, d, 'a')];
  for (let i = 0; i < n; i++) {
    const cw = iw / n, cx = -iw / 2 + cw * (i + 0.5);
    out.push(bx(cx, sh - 0.12, back / 2, cw - 0.02, 0.14, d - back - 0.02, 'a+'), bx(cx, sh + 0.02, -d / 2 + back + 0.07, cw - 0.04, h - sh - 0.1, 0.14, 'a+'));
  }
  return out;
};
const sectional = (w, d, h) => {
  const sd = Math.min(0.95, d * 0.6), cw = Math.min(0.95, w * 0.4), back = 0.22, sh = 0.43, b = 0.1;
  return [bx(0, b, -d / 2 + sd / 2, w, sh - b - 0.12, sd, 'a-'), bx(w / 2 - cw / 2, b, sd / 2, cw, sh - b - 0.12, d - sd, 'a-'),
    bx(0, b, -d / 2 + back / 2, w, h - b, back, 'a'), bx(-w / 2 + 0.1, b, -d / 2 + sd / 2, 0.2, h * 0.7 - b, sd, 'a'), bx(w / 2 - 0.1, b, -d / 2 + sd / 2 + 0, 0.2, h * 0.7 - b, sd, 'a'),
    bx(-cw / 2 - 0.0, sh - 0.12, -d / 2 + back + (sd - back) / 2, w - cw - 0.42, 0.14, sd - back - 0.02, 'a+'), bx(w / 2 - cw / 2 - 0.1, sh - 0.12, back / 2, cw - 0.22, 0.14, d - back - 0.02, 'a+'),
    bx(-0.1, sh + 0.02, -d / 2 + back + 0.07, w - 0.44, h - sh - 0.1, 0.14, 'a+'), ...legs(w, sd, b, 0.05, 'dark').map(p => ({ ...p, z: p.z - d / 2 + sd / 2 }))];
};
const table = (w, d, h) => [bx(0, h - 0.04, 0, w, 0.04, d, 'a'), ...legs(w, d, h - 0.04, Math.min(0.06, w * 0.08), 'a-')];
const roundTable = (w, d, h) => [{ ...cy(0, h - 0.04, 0, w, 0.04, 'a'), d }, cy(0, 0.03, 0, Math.min(0.12, w * 0.15), h - 0.07, 'a-'), { ...cy(0, 0, 0, w * 0.5, 0.03, 'a-'), d: d * 0.5 }];
const chair = (w, d, h) => { const s = Math.min(0.45, h * 0.5); return [...legs(w, d, s, 0.035, 'b'), bx(0, s, 0, w, 0.06, d, 'a'), bx(0, s + 0.06, -d / 2 + 0.025, w, h - s - 0.06, 0.05, 'a')]; };
const drawers = (rows, cols = 1) => (w, d, h) => {
  const out = [...legs(w, d, 0.08, 0.04, 'dark'), bx(0, 0.08, -0.01, w, h - 0.08, d - 0.02, 'a')], rh = (h - 0.12) / rows, cw = (w - 0.04) / cols;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + 0.02 + cw * (c + 0.5), y = 0.1 + r * rh;
    out.push(bx(x, y, d / 2 - 0.012, cw - 0.02, rh - 0.02, 0.014, 'a+'), bx(x, y + rh / 2 - 0.02, d / 2, Math.min(0.14, cw * 0.4), 0.015, 0.02, 'metal'));
  }
  return out;
};
const cabinetDoors = (w, d, y0, y1, c = 'a+') => { const n = Math.max(1, Math.round(w / 0.48)), cw = w / n, out = [];
  for (let i = 0; i < n; i++) { const x = -w / 2 + cw * (i + 0.5); const dw = cw - 0.012, dh = y1 - y0, r = Math.min(0.06, dw * 0.2), z = d / 2 - 0.003; // shaker door: slab + raised frame
    out.push(bx(x, y0, d / 2 - 0.02, dw, dh, 0.02, c), bx(x - dw / 2 + r / 2, y0, z, r, dh, 0.008, c), bx(x + dw / 2 - r / 2, y0, z, r, dh, 0.008, c), bx(x, y0, z, dw - 2 * r, r, 0.008, c), bx(x, y1 - r, z, dw - 2 * r, r, 0.008, c),
      bx(x + (i % 2 ? -1 : 1) * (dw / 2 - r / 2), (y0 + y1) / 2 - 0.06, d / 2 + 0.008, 0.014, 0.12, 0.022, 'metal')); }
  return out; };
const baseCab = (w, d, h) => [bx(0, 0, -0.04, w, 0.1, d - 0.1, 'dark'), bx(0, 0.1, -0.02, w, h - 0.14, d - 0.04, 'a'), ...cabinetDoors(w, d - 0.02, 0.11, h - 0.05), bx(0, h - 0.04, 0, w, 0.04, d, 'b')];
const bookshelf = (w, d, h) => {
  const out = [bx(-w / 2 + 0.015, 0, 0, 0.03, h, d, 'a'), bx(w / 2 - 0.015, 0, 0, 0.03, h, d, 'a'), bx(0, 0, -d / 2 + 0.008, w, h, 0.016, 'a-'), bx(0, h - 0.03, 0, w, 0.03, d, 'a')];
  const n = Math.max(1, Math.round(h / 0.38)), sh = (h - 0.03) / n, cols = ['#8c4a3c', '#3f5f7a', '#d9c9a5', '#56715a', '#c98b3f', '#4a4458'];
  for (let i = 0; i < n; i++) {
    out.push(bx(0, i * sh, 0, w - 0.06, 0.03, d - 0.02, 'a'));
    let x = -w / 2 + 0.06, k = i * 3;
    while (x < w / 2 - 0.12 && (k - i * 3) < 14) { const bw = 0.03 + ((k * 7) % 4) * 0.008, bh = sh * (0.55 + ((k * 5) % 4) * 0.08); if ((k * 11) % 9 !== 0) out.push(bx(x + bw / 2, i * sh + 0.03, 0.02, bw, bh, d * 0.6, cols[k % cols.length])); x += bw + 0.004; k++; }
  }
  return out;
};
const bed = (w, d, h) => {
  const n = w > 1.2 ? 2 : 1, pw = (w - 0.16) / n;
  return [...legs(w, d, 0.14, 0.06, 'b-'), bx(0, 0.14, 0, w, 0.18, d, 'b'), bx(0, 0, -d / 2 + 0.04, w, h, 0.08, 'b'), bx(0, 0.32, 0.04, w - 0.06, 0.22, d - 0.1, 'white'),
    bx(0, 0.33, d * 0.17, w - 0.02, 0.23, d * 0.62, 'a'), bx(0, 0.34, -d * 0.12, w - 0.02, 0.225, 0.14, 'a+'),
    ...Array.from({ length: n }, (_, i) => bx(-w / 2 + 0.08 + pw * (i + 0.5), 0.54, -d / 2 + 0.34, pw - 0.08, 0.11, 0.38, 'white'))];
};
const plant = (w, d, h) => [cy(0, 0, 0, w * 0.5, h * 0.3, 'b', { t: 1.25 }), cy(0, h * 0.28, 0, 0.04, h * 0.25, '#6b4f2f'), sp(0, h * 0.42, 0, w, h * 0.58, d, 'a'), sp(w * 0.18, h * 0.36, d * 0.12, w * 0.6, h * 0.36, d * 0.6, 'a-'), sp(-w * 0.2, h * 0.5, -d * 0.1, w * 0.55, h * 0.38, d * 0.55, 'a+')];
const lamp = (w, d, h) => [cy(0, 0, 0, w * 0.6, 0.03, 'b'), cy(0, 0.03, 0, 0.03, h * 0.78, 'b'), cy(0, h * 0.74, 0, w, h * 0.26, 'a', { t: 0.62 })];
const appliance = (w, d, h) => [bx(0, 0, -0.01, w, h, d - 0.02, 'a'), bx(0, h * 0.06, d / 2 - 0.012, w - 0.03, h * 0.72, 0.014, 'a+'), bx(0, h * 0.82, d / 2 - 0.012, w - 0.03, h * 0.12, 0.014, 'dark'), bx(0, h * 0.72, d / 2, w * 0.6, 0.02, 0.03, 'metal')];
const washer = (y, h1) => (w, d) => [bx(0, y, -0.01, w, h1, d - 0.02, 'a'), disc(0, y + h1 * 0.22, d / 2 - 0.01, Math.min(w, h1) * 0.56, 0.03, 'dark'), disc(0, y + h1 * 0.27, d / 2 + 0.005, Math.min(w, h1) * 0.45, 0.03, 'glass'), bx(0, y + h1 - 0.1, d / 2 - 0.012, w - 0.04, 0.07, 0.014, 'a-')];

const DEFS = [
  // ---------- Living ----------
  { id: 'sofa3', name: 'Sofa, 3-seat', cat: 'Living', w: 2.13, d: 0.92, h: 0.85, color: '#8a9aa3', mat: 'fabric', build: sofa(3) },
  { id: 'sofa2', name: 'Loveseat', cat: 'Living', w: 1.55, d: 0.9, h: 0.85, color: '#8a9aa3', mat: 'fabric', build: sofa(2) },
  { id: 'sectional', name: 'Sectional sofa', cat: 'Living', w: 2.7, d: 1.65, h: 0.85, color: '#9a9388', mat: 'fabric', build: sectional },
  { id: 'armchair', name: 'Armchair', cat: 'Living', w: 0.86, d: 0.86, h: 0.85, color: '#b08d6e', mat: 'fabric', build: sofa(1) },
  { id: 'ottoman', name: 'Ottoman', cat: 'Living', w: 0.6, d: 0.6, h: 0.42, color: '#b08d6e', mat: 'fabric', build: (w, d, h) => [...legs(w, d, 0.08, 0.04, 'dark'), bx(0, 0.08, 0, w, h - 0.08, d, 'a'), bx(0, h, 0, w - 0.06, 0.015, d - 0.06, 'a+')] },
  { id: 'beanbag', name: 'Bean bag', cat: 'Living', w: 0.9, d: 0.9, h: 0.7, color: '#c96f4a', mat: 'fabric', build: (w, d, h) => [sp(0, 0, 0, w, h * 0.75, d, 'a'), sp(0, h * 0.3, -d * 0.15, w * 0.7, h * 0.7, d * 0.6, 'a+')] },
  { id: 'coffee', name: 'Coffee table', cat: 'Living', w: 1.1, d: 0.6, h: 0.42, color: '#a47a4f', mat: 'wood', build: (w, d, h) => [...table(w, d, h), bx(0, h * 0.3, 0, w - 0.14, 0.02, d - 0.14, 'a-')] },
  { id: 'coffee_round', name: 'Round coffee table', cat: 'Living', w: 0.9, d: 0.9, h: 0.4, color: '#a47a4f', mat: 'wood', build: roundTable },
  { id: 'side', name: 'Side table', cat: 'Living', w: 0.5, d: 0.5, h: 0.55, color: '#a47a4f', mat: 'wood', build: table },
  { id: 'tvstand', name: 'Media console', cat: 'Living', w: 1.6, d: 0.42, h: 0.5, color: '#6f5440', mat: 'wood', build: drawers(1, 3) },
  { id: 'tv', name: 'TV', cat: 'Living', w: 1.24, d: 0.06, h: 0.72, elev: 0.55, color: '#18181a', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d * 0.7, 'a'), bx(0, 0.015, d * 0.35, w - 0.03, h - 0.03, 0.005, 'screen')] },
  { id: 'bookshelf', name: 'Bookshelf', cat: 'Living', w: 0.8, d: 0.3, h: 1.9, color: '#d8cdbb', mat: 'wood', clear: 0.6, build: bookshelf },
  { id: 'fireplace', name: 'Fireplace', cat: 'Living', w: 1.4, d: 0.4, h: 1.15, color: '#e6e1d8', color2: '#3a3a3c', build: (w, d, h) => [bx(0, 0, 0, w, h - 0.06, d, 'a'), bx(0, h - 0.06, 0.03, w + 0.12, 0.06, d + 0.06, 'a+'), bx(0, 0.08, d / 2 - 0.02, w * 0.55, h * 0.55, 0.05, 'b'), bx(0, 0, d / 2 + 0.15, w, 0.03, 0.3, 'b')] },
  { id: 'floorlamp', name: 'Floor lamp', cat: 'Living', w: 0.42, d: 0.42, h: 1.6, color: '#efe6d2', color2: '#2b2d31', mat: 'accent', build: lamp },
  { id: 'piano', name: 'Upright piano', cat: 'Living', w: 1.5, d: 0.6, h: 1.2, color: '#1d1b1c', build: (w, d, h) => [bx(0, 0, -d * 0.15, w, h, d * 0.7, 'a'), bx(0, h * 0.5, d * 0.3, w - 0.1, 0.08, d * 0.4, 'a+'), bx(0, h * 0.5 + 0.08, d * 0.33, w - 0.16, 0.012, d * 0.26, 'white')] },

  // ---------- Bedroom ----------
  { id: 'bed', name: 'Bed', cat: 'Bedroom', w: 1.52, d: 2.03, h: 1.05, color: '#c7ccd4', color2: '#8a6a4c', mat: 'bed', clear: 0.5, build: bed,
    sizes: [['Twin', 0.99, 1.91], ['Full', 1.37, 1.91], ['Queen', 1.52, 2.03], ['King', 1.93, 2.03], ['Cal King', 1.83, 2.13]] },
  { id: 'nightstand', name: 'Nightstand', cat: 'Bedroom', w: 0.5, d: 0.42, h: 0.56, color: '#8a6a4c', mat: 'wood', build: drawers(2) },
  { id: 'dresser', name: 'Dresser', cat: 'Bedroom', w: 1.5, d: 0.5, h: 0.85, color: '#8a6a4c', mat: 'wood', clear: 0.75, build: drawers(3, 2) },
  { id: 'chest', name: 'Tall chest', cat: 'Bedroom', w: 0.8, d: 0.5, h: 1.25, color: '#8a6a4c', mat: 'wood', clear: 0.75, build: drawers(5) },
  { id: 'wardrobe', name: 'Wardrobe', cat: 'Bedroom', w: 1.2, d: 0.6, h: 2.0, color: '#e4ded2', mat: 'wood', clear: 0.75, build: (w, d, h) => [bx(0, 0, -0.01, w, h, d - 0.02, 'a'), ...cabinetDoors(w, d, 0.06, h - 0.03)] },
  { id: 'crib', name: 'Crib', cat: 'Bedroom', w: 1.35, d: 0.76, h: 0.92, color: '#f1ede4', color2: '#cfe0e8', build: (w, d, h) => [...legs(w, d, h, 0.05, 'a', 0), bx(0, 0.3, 0, w - 0.06, 0.12, d - 0.06, 'b'), bx(0, 0.3, -d / 2 + 0.015, w - 0.1, h - 0.32, 0.03, 'a'), bx(0, 0.3, d / 2 - 0.015, w - 0.1, h - 0.45, 0.03, 'a'), bx(-w / 2 + 0.015, 0.3, 0, 0.03, h - 0.4, d - 0.1, 'a'), bx(w / 2 - 0.015, 0.3, 0, 0.03, h - 0.4, d - 0.1, 'a')] },
  { id: 'mirror', name: 'Wall mirror', cat: 'Wall decor', w: 0.6, d: 0.04, h: 1.3, elev: 0.4, color: '#2b2d31', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d * 0.7, 'a'), bx(0, 0.03, d * 0.35, w - 0.06, h - 0.06, 0.004, 'mirror')] },

  // ---------- Dining ----------
  { id: 'dining', name: 'Dining table', cat: 'Dining', w: 1.8, d: 0.92, h: 0.75, color: '#9c7650', mat: 'wood', clear: 0.75, build: table },
  { id: 'dining_round', name: 'Round table', cat: 'Dining', w: 1.2, d: 1.2, h: 0.75, color: '#9c7650', mat: 'wood', clear: 0.75, build: roundTable },
  { id: 'chair', name: 'Dining chair', cat: 'Dining', w: 0.45, d: 0.5, h: 0.9, color: '#5d6b73', color2: '#3b2f25', mat: 'fabric', build: chair },
  { id: 'stool', name: 'Bar stool', cat: 'Dining', w: 0.4, d: 0.4, h: 0.76, color: '#5d6b73', color2: '#2b2d31', mat: 'fabric', build: (w, d, h) => [cy(0, 0, 0, w * 0.9, 0.02, 'b'), cy(0, 0.02, 0, 0.04, h - 0.08, 'b'), cy(0, h - 0.06, 0, w, 0.06, 'a'), cy(0, h * 0.35, 0, w * 0.7, 0.015, 'metal')] },
  { id: 'bench', name: 'Bench', cat: 'Dining', w: 1.4, d: 0.4, h: 0.46, color: '#9c7650', mat: 'wood', build: table },
  { id: 'sideboard', name: 'Sideboard', cat: 'Dining', w: 1.6, d: 0.45, h: 0.8, color: '#6f5440', mat: 'wood', clear: 0.6, build: (w, d, h) => [...legs(w, d, 0.14, 0.04, 'dark'), bx(0, 0.14, -0.01, w, h - 0.14, d - 0.02, 'a'), ...cabinetDoors(w, d, 0.16, h - 0.03)] },

  // ---------- Kitchen ----------
  { id: 'basecab', name: 'Base cabinet', cat: 'Kitchen', w: 0.6, d: 0.62, h: 0.9, color: '#f2f0ec', color2: '#3b3d42', mat: 'cab', clear: 0.9, build: baseCab },
  { id: 'sinkcab', name: 'Sink cabinet', cat: 'Kitchen', w: 0.9, d: 0.62, h: 0.9, color: '#f2f0ec', color2: '#3b3d42', mat: 'cab', clear: 0.9, build: (w, d, h) => [...baseCab(w, d, h), bx(0, h - 0.035, 0.02, Math.min(w * 0.7, 0.8), 0.04, d * 0.6, 'steel'), bx(0, h - 0.03, 0.02, Math.min(w * 0.7, 0.8) - 0.06, 0.037, d * 0.6 - 0.06, 'dark'), cy(0, h, -d / 2 + 0.08, 0.035, 0.26, 'metal'), bx(0, h + 0.24, -d / 2 + 0.16, 0.03, 0.025, 0.18, 'metal')] },
  { id: 'wallcab', name: 'Wall cabinet', cat: 'Kitchen', w: 0.6, d: 0.33, h: 0.76, elev: 1.4, color: '#f2f0ec', mat: 'cab', mount: 'wall', build: (w, d, h) => [bx(0, 0, -0.01, w, h, d - 0.02, 'a'), ...cabinetDoors(w, d, 0.01, h - 0.01)] },
  { id: 'island', name: 'Kitchen island', cat: 'Kitchen', w: 1.8, d: 0.95, h: 0.92, color: '#4a5a63', color2: '#ece8e1', mat: 'cab', clear: 0.9, build: (w, d, h) => [bx(0, 0, 0, w - 0.1, 0.1, d - 0.25, 'dark'), bx(0, 0.1, -0.08, w - 0.06, h - 0.14, d - 0.3, 'a'), ...cabinetDoors(w - 0.06, d - 0.3, 0.11, h - 0.05).map(p => ({ ...p, z: p.z - 0.08 })), bx(0, h - 0.04, 0, w, 0.04, d, 'b')] },
  { id: 'fridge', name: 'Refrigerator', cat: 'Kitchen', w: 0.9, d: 0.75, h: 1.78, color: '#c9ccd1', clear: 0.9, build: (w, d, h) => [bx(0, 0, -0.03, w, h, d - 0.06, 'a'), bx(-w / 4, 0.62, d / 2 - 0.035, w / 2 - 0.01, h - 0.63, 0.05, 'a+'), bx(w / 4, 0.62, d / 2 - 0.035, w / 2 - 0.01, h - 0.63, 0.05, 'a+'), bx(0, 0.02, d / 2 - 0.035, w - 0.01, 0.58, 0.05, 'a+'), bx(-0.04, 0.9, d / 2, 0.02, 0.5, 0.04, 'metal'), bx(0.04, 0.9, d / 2, 0.02, 0.5, 0.04, 'metal'), bx(0, 0.52, d / 2, w * 0.5, 0.02, 0.04, 'metal')] },
  { id: 'range', name: 'Range / stove', cat: 'Kitchen', w: 0.76, d: 0.66, h: 0.92, color: '#c9ccd1', clear: 0.9, build: (w, d, h) => [bx(0, 0, -0.01, w, h - 0.02, d - 0.02, 'a'), bx(0, h - 0.02, 0, w, 0.02, d, 'black'), bx(0, 0.12, d / 2 - 0.012, w - 0.06, h * 0.6, 0.016, 'dark'), bx(0, h * 0.74, d / 2, w * 0.7, 0.02, 0.035, 'metal'), bx(0, h, -d / 2 + 0.03, w, 0.1, 0.06, 'a'),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cy(sx * w * 0.24, h, sz * d * 0.2 + 0.02, Math.min(w, d) * 0.28, 0.012, '#3d3f44'))] },
  { id: 'dishwasher', name: 'Dishwasher', cat: 'Kitchen', w: 0.6, d: 0.62, h: 0.9, color: '#c9ccd1', color2: '#3b3d42', clear: 0.9, build: (w, d, h) => [bx(0, 0, -0.03, w, h - 0.04, d - 0.06, 'a-'), bx(0, 0.1, d / 2 - 0.035, w - 0.01, h - 0.16, 0.03, 'a'), bx(0, h - 0.16, d / 2, w * 0.7, 0.02, 0.035, 'metal'), bx(0, h - 0.04, 0, w, 0.04, d, 'b')] },

  { id: 'drawerbase', name: 'Drawer base', cat: 'Kitchen', w: 0.6, d: 0.62, h: 0.9, color: '#f2f0ec', color2: '#3b3d42', mat: 'cab', clear: 0.9, build: (w, d, h) => [...drawers(3)(w, d - 0.02, h - 0.04).filter(p => p.c !== 'dark').map(p => ({ ...p, z: p.z - 0.01 })), bx(0, 0, -0.04, w, 0.08, d - 0.1, 'dark'), bx(0, h - 0.04, 0, w, 0.04, d, 'b')] },
  { id: 'tallcab', name: 'Pantry / tall cabinet', cat: 'Kitchen', w: 0.6, d: 0.62, h: 2.2, color: '#f2f0ec', mat: 'cab', clear: 0.9, build: (w, d, h) => [bx(0, 0, -0.04, w, 0.1, d - 0.1, 'dark'), bx(0, 0.1, -0.01, w, h - 0.1, d - 0.02, 'a'), ...cabinetDoors(w, d, 0.11, h * 0.62), ...cabinetDoors(w, d, h * 0.62 + 0.01, h - 0.01)] },
  { id: 'cornercab', name: 'Corner base cabinet', cat: 'Kitchen', w: 0.95, d: 0.95, h: 0.9, color: '#f2f0ec', color2: '#3b3d42', mat: 'cab', build: (w, d, h) => { const k = 0.62; return [bx(0, 0.1, -d / 2 + k / 2, w, h - 0.14, k, 'a'), bx(-w / 2 + k / 2, 0.1, k / 2, k, h - 0.14, d - k, 'a'), bx(k / 2, 0.12, -d / 2 + k - 0.01, w - k - 0.012, h - 0.18, 0.02, 'a+'), bx(-w / 2 + k - 0.01, 0.12, k / 2, 0.02, h - 0.18, d - k - 0.012, 'a+'), bx(0, h - 0.04, -d / 2 + k / 2, w, 0.04, k, 'b'), bx(-w / 2 + k / 2, h - 0.04, k / 2, k, 0.04, d - k, 'b')]; } },
  { id: 'countertop', name: 'Countertop slab', cat: 'Kitchen', w: 2.0, d: 0.64, h: 0.04, elev: 0.88, color: '#f1efea', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'backsplash', name: 'Backsplash', cat: 'Kitchen', w: 2.4, d: 0.015, h: 0.46, elev: 0.92, color: '#ffffff', tex: 'subway', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'hood', name: 'Range hood', cat: 'Kitchen', w: 0.76, d: 0.5, h: 0.9, elev: 1.6, color: '#c9ccd1', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, 0.08, d, 'a'), bx(0, 0.08, -d * 0.1, w * 0.8, 0.14, d * 0.8, 'a+'), bx(0, 0.22, -d / 2 + 0.15, 0.3, h - 0.22, 0.3, 'a')] },
  { id: 'microwave', name: 'Microwave', cat: 'Kitchen', w: 0.6, d: 0.4, h: 0.34, elev: 0.92, color: '#c9ccd1', build: (w, d, h) => [bx(0, 0, 0, w, h, d - 0.02, 'a'), bx(-w * 0.12, 0.03, d / 2 - 0.01, w * 0.68, h - 0.06, 0.012, 'black'), bx(w * 0.38, 0.03, d / 2 - 0.01, w * 0.16, h - 0.06, 0.012, 'dark')] },

  // ---------- Bathroom ----------
  { id: 'toilet', name: 'Toilet', cat: 'Bath', w: 0.45, d: 0.72, h: 0.78, color: '#f7f7f5', clear: 0.55, build: (w, d, h) => [bx(0, 0.38, -d / 2 + 0.1, w * 0.92, h - 0.38, 0.2, 'a'), { ...cy(0, 0, 0.08, w * 0.6, 0.38, 'a', { t: 1.3 }), d: d * 0.55 }, { ...cy(0, 0.38, 0.1, w * 0.86, 0.04, 'a+'), d: d * 0.68 }, { ...cy(0, 0.42, 0.11, w * 0.6, 0.004, 'a-'), d: d * 0.46 }] },
  { id: 'tub', name: 'Bathtub', cat: 'Bath', w: 1.52, d: 0.78, h: 0.55, color: '#f7f7f5', clear: 0.6, build: (w, d, h) => [bx(0, 0, 0, w, 0.14, d, 'a'), bx(0, 0.14, -d / 2 + 0.04, w, h - 0.14, 0.08, 'a'), bx(0, 0.14, d / 2 - 0.04, w, h - 0.14, 0.08, 'a'), bx(-w / 2 + 0.05, 0.14, 0, 0.1, h - 0.14, d - 0.16, 'a'), bx(w / 2 - 0.05, 0.14, 0, 0.1, h - 0.14, d - 0.16, 'a'), bx(0, 0.14, 0, w - 0.2, 0.005, d - 0.16, 'a-'), cy(-w / 2 + 0.07, h, 0, 0.03, 0.14, 'metal'), cy(w * 0.25, 0.145, 0, 0.05, 0.004, 'metal')] },
  { id: 'shower', name: 'Shower', cat: 'Bath', w: 0.92, d: 0.92, h: 2.0, color: '#f7f7f5', clear: 0.6, build: (w, d, h) => [bx(0, 0, 0, w, 0.06, d, 'a'), bx(0, 0.06, d / 2 - 0.008, w, h - 0.06, 0.012, 'glass'), bx(w / 2 - 0.008, 0.06, 0, 0.012, h - 0.06, d, 'glass'), cy(-w / 2 + 0.08, 0.06, -d / 2 + 0.08, 0.025, h - 0.15, 'metal'), cy(-w / 2 + 0.16, h - 0.14, -d / 2 + 0.16, 0.2, 0.02, 'metal'), cy(0, 0.061, 0, 0.09, 0.003, 'metal')] },
  { id: 'vanity', name: 'Vanity', cat: 'Bath', w: 0.9, d: 0.55, h: 0.86, color: '#5b5148', color2: '#f1eeea', mat: 'cab', clear: 0.6, sizes: [['Single 30"', 0.76, 0.55], ['Single 36"', 0.91, 0.55], ['Double 60"', 1.52, 0.55], ['Double 72"', 1.83, 0.55]],
    build: (w, d, h) => { const n = w > 1.3 ? 2 : 1, out = baseCab(w, d, h);
      for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); out.push({ ...cy(x, h - 0.002, 0.03, Math.min(0.5, w / n - 0.2), 0.012, 'white'), d: d * 0.6 }, { ...cy(x, h + 0.008, 0.03, Math.min(0.42, w / n - 0.28), 0.004, '#d9dde0'), d: d * 0.46 }, cy(x, h, -d / 2 + 0.07, 0.03, 0.16, 'metal'), bx(x, h + 0.14, -d / 2 + 0.12, 0.025, 0.02, 0.12, 'metal')); }
      return out; } },

  // ---------- Office ----------
  { id: 'desk', name: 'Desk', cat: 'Office', w: 1.4, d: 0.7, h: 0.75, color: '#b89468', mat: 'wood', clear: 0.75, build: (w, d, h) => [...table(w, d, h), ...drawers(3)(0.4, d - 0.1, h - 0.06).filter(p => p.c !== 'dark').map(p => ({ ...p, x: p.x + w / 2 - 0.26 }))] },
  { id: 'officechair', name: 'Office chair', cat: 'Office', w: 0.62, d: 0.62, h: 1.0, color: '#33373d', color2: '#18181a', mat: 'fabric', build: (w, d, h) => [...[0, 72, 144, 216, 288].map(a => bx(Math.sin(rad(a)) * w * 0.22, 0.03, Math.cos(rad(a)) * d * 0.22, 0.05, 0.03, w * 0.44, 'b', { ry: rad(a) })), cy(0, 0.05, 0, 0.05, 0.38, 'metal'), bx(0, 0.43, 0.02, w * 0.8, 0.08, d * 0.78, 'a'), bx(0, 0.56, -d / 2 + 0.08, w * 0.74, h - 0.56, 0.07, 'a'), bx(-w / 2 + 0.03, 0.6, 0, 0.05, 0.03, d * 0.45, 'b'), bx(w / 2 - 0.03, 0.6, 0, 0.05, 0.03, d * 0.45, 'b')] },
  { id: 'filing', name: 'Filing cabinet', cat: 'Office', w: 0.42, d: 0.6, h: 0.72, color: '#9aa0a6', build: drawers(3) },

  // ---------- Laundry & utility ----------
  { id: 'washer', name: 'Washer', cat: 'Utility', w: 0.68, d: 0.72, h: 0.98, color: '#f4f4f2', clear: 0.9, build: (w, d, h) => washer(0, h)(w, d) },
  { id: 'dryer', name: 'Dryer', cat: 'Utility', w: 0.68, d: 0.72, h: 0.98, color: '#f4f4f2', clear: 0.9, build: (w, d, h) => washer(0, h)(w, d) },
  { id: 'stackwd', name: 'Stacked washer/dryer', cat: 'Utility', w: 0.68, d: 0.76, h: 1.9, color: '#f4f4f2', clear: 0.9, build: (w, d, h) => [...washer(0, h / 2 - 0.005)(w, d), ...washer(h / 2 + 0.005, h / 2 - 0.005)(w, d)] },
  { id: 'waterheater', name: 'Water heater', cat: 'Utility', w: 0.6, d: 0.6, h: 1.5, color: '#d8dadd', build: (w, d, h) => [{ ...cy(0, 0, 0, w, h, 'a'), d }, cy(0, h, 0, 0.1, 0.2, 'metal')] },
  { id: 'treadmill', name: 'Treadmill', cat: 'Utility', w: 0.85, d: 1.8, h: 1.4, color: '#2b2d31', build: (w, d, h) => [bx(0, 0, 0, w, 0.16, d, 'a'), bx(0, 0.16, 0.05, w - 0.2, 0.01, d - 0.3, 'black'), bx(-w / 2 + 0.04, 0.16, -d / 2 + 0.15, 0.06, h - 0.3, 0.06, 'a'), bx(w / 2 - 0.04, 0.16, -d / 2 + 0.15, 0.06, h - 0.3, 0.06, 'a'), bx(0, h - 0.22, -d / 2 + 0.17, w, 0.2, 0.1, 'a+')] },

  // ---------- Decor ----------
  { id: 'rug', name: 'Area rug', cat: 'Decor', w: 2.4, d: 1.7, h: 0.015, color: '#b9a48c', mat: 'accent', flat: true, build: (w, d) => [bx(0, 0, 0, w, 0.012, d, 'a'), bx(0, 0.012, 0, w - 0.24, 0.003, d - 0.24, 'a+'), bx(0, 0.015, 0, w - 0.6, 0.002, d - 0.6, 'a')],
    sizes: [["5' × 8'", 2.44, 1.52], ["6' × 9'", 2.74, 1.83], ["8' × 10'", 3.05, 2.44], ["9' × 12'", 3.66, 2.74]] },
  { id: 'rug_round', name: 'Round rug', cat: 'Decor', w: 1.8, d: 1.8, h: 0.015, color: '#8fa3a8', mat: 'accent', flat: true, build: (w, d) => [{ ...cy(0, 0, 0, w, 0.012, 'a'), d }, { ...cy(0, 0.012, 0, w * 0.82, 0.003, 'a+'), d: d * 0.82 }] },
  { id: 'plant', name: 'Floor plant', cat: 'Decor', w: 0.6, d: 0.6, h: 1.3, color: '#4f8a4a', color2: '#c9b79c', build: plant },
  { id: 'plant_small', name: 'Small plant', cat: 'Decor', w: 0.28, d: 0.28, h: 0.4, color: '#5f9a58', color2: '#e3ded4', build: plant },
  { id: 'tablelamp', name: 'Table lamp', cat: 'Decor', w: 0.3, d: 0.3, h: 0.5, elev: 0.56, color: '#efe6d2', color2: '#b08456', mat: 'accent', build: lamp },
  { id: 'pendant', name: 'Pendant light', cat: 'Decor', w: 0.45, d: 0.45, h: 0.7, elev: 1.9, color: '#d9b25f', color2: '#2b2d31', mat: 'accent', build: (w, d, h) => [cy(0, 0.25, 0, 0.012, h - 0.25, 'b'), cy(0, 0, 0, w, 0.25, 'a', { t: 0.35 })] },
  { id: 'art', name: 'Wall art', cat: 'Wall decor', w: 0.9, d: 0.04, h: 0.6, elev: 1.25, color: '#c98f6b', color2: '#2b2d31', mat: 'accent', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d * 0.7, 'b'), bx(0, 0.04, d * 0.35, w - 0.08, h - 0.08, 0.004, 'white'), bx(0, 0.09, d * 0.35 + 0.002, w - 0.18, h - 0.18, 0.004, 'a')] },
  { id: 'shelf', name: 'Wall shelf', cat: 'Wall decor', w: 0.9, d: 0.24, h: 0.04, elev: 1.5, color: '#b08456', mat: 'wood', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'curtains', name: 'Curtains', cat: 'Wall decor', w: 1.8, d: 0.14, h: 2.3, elev: 0.02, color: '#d9d2c4', color2: '#2b2d31', mat: 'accent', mount: 'wall', build: (w, d, h) => { const out = [bx(0, h - 0.04, 0, w + 0.1, 0.025, 0.025, 'b')], pw = Math.min(0.5, w * 0.28);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) out.push(bx(s * (w / 2 - pw * (i + 0.5) / 4), 0, (i % 2 ? 0.02 : -0.02), pw / 4 + 0.01, h - 0.05, d * 0.5, i % 2 ? 'a' : 'a-'));
    return out; } },

  // ---------- Wall decor ----------
  { id: 'gallery', name: 'Gallery wall', cat: 'Wall decor', w: 1.6, d: 0.04, h: 1.0, elev: 1.0, color: '#c98f6b', color2: '#2b2d31', mat: 'accent', mount: 'wall', build: (w, d, h) => [[-0.34, 0.5, 0.3, 0.5], [0, 0, 0.36, 0.46], [0.34, 0.45, 0.3, 0.55], [-0.32, 0, 0.26, 0.42], [0.02, 0.54, 0.3, 0.46], [0.36, 0, 0.26, 0.38]]
      .flatMap(([x, y, fw, fh], i) => [bx(x * w, y * h, 0, fw * w, fh * h, d * 0.7, 'b'), bx(x * w, y * h + 0.03, d * 0.35, fw * w - 0.06, fh * h - 0.06, 0.004, i % 2 ? 'white' : i % 3 ? 'a' : 'a-')]) },
  { id: 'wallpanel', name: 'Slat wall panel', cat: 'Wall decor', w: 1.8, d: 0.03, h: 2.4, elev: 0.02, color: '#ffffff', tex: 'wood_slat', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'wainscot', name: 'Wainscoting', cat: 'Wall decor', w: 2.4, d: 0.025, h: 0.95, elev: 0, color: '#ffffff', tex: 'shiplap', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h - 0.05, d, 'a'), bx(0, h - 0.05, 0.008, w, 0.05, d + 0.016, 'white')] },
  { id: 'tilewall', name: 'Tile panel', cat: 'Wall decor', w: 1.5, d: 0.015, h: 2.2, elev: 0, color: '#ffffff', tex: 'tile_sq', mount: 'wall', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'shelves3', name: 'Floating shelves', cat: 'Wall decor', w: 1.0, d: 0.22, h: 0.9, elev: 1.1, color: '#a8743f', mat: 'wood', mount: 'wall', build: (w, d, h) => [0, 0.5, 1].flatMap((k, i) => [bx(0, k * (h - 0.04), 0, w, 0.04, d, 'a'), bx(-w * 0.3 + i * w * 0.25, k * (h - 0.04) + 0.04, 0, 0.16, 0.14, 0.1, ['#56715a', '#d9c9a5', '#3f5f7a'][i])]) },
  { id: 'sconce', name: 'Wall sconce', cat: 'Wall decor', w: 0.16, d: 0.18, h: 0.32, elev: 1.6, color: '#efe6d2', color2: '#b08456', mat: 'accent', mount: 'wall', build: (w, d, h) => [bx(0, h * 0.3, -d / 2 + 0.012, w * 0.6, h * 0.4, 0.024, 'b'), bx(0, h * 0.45, -d * 0.2, 0.02, 0.02, d * 0.5, 'b'), cy(0, h * 0.25, d * 0.12, w, h * 0.6, 'a', { t: 0.75 })] },
  { id: 'clock', name: 'Wall clock', cat: 'Wall decor', w: 0.4, d: 0.05, h: 0.4, elev: 1.6, color: '#f6f5f2', color2: '#2b2d31', mount: 'wall', build: (w, d, h) => [disc(0, 0, 0, w, d * 0.7, 'b'), disc(0, w * 0.05, d * 0.36, w * 0.9, 0.006, 'a'), bx(0, h / 2, d * 0.4, 0.012, h * 0.34, 0.006, 'b'), bx(w * 0.1, h / 2 - 0.006, d * 0.4, w * 0.22, 0.012, 0.006, 'b')] },

  // ---------- Structure & outdoor ----------
  { id: 'column', name: 'Round column', cat: 'Structure', w: 0.7, d: 0.7, h: 2.6, color: '#bdbab4', build: (w, d, h) => [{ ...cy(0, 0, 0, w, h, 'a'), d }] },
  { id: 'column_sq', name: 'Square column', cat: 'Structure', w: 0.5, d: 0.5, h: 2.6, color: '#bdbab4', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'stairs', name: 'Staircase', cat: 'Structure', w: 1.0, d: 3.0, h: 2.6, color: '#b89468', mat: 'wood', build: (w, d, h) => { const n = Math.max(2, Math.round(h / 0.18)); return Array.from({ length: n }, (_, i) => bx(0, 0, d / 2 - (d / n) * (i + 0.5), w, (h / n) * (i + 1), d / n, i % 2 ? 'a' : 'a+')); } },
  { id: 'counter', name: 'Counter / half wall', cat: 'Structure', w: 1.8, d: 0.3, h: 1.05, color: '#f3f0ea', color2: '#6f5440', build: (w, d, h) => [bx(0, 0, 0, w, h - 0.04, d, 'a'), bx(0, h - 0.04, 0, w + 0.04, 0.04, d + 0.1, 'b')] },
  { id: 'lounger', name: 'Outdoor lounger', cat: 'Structure', w: 0.7, d: 1.9, h: 0.75, color: '#e8e2d2', color2: '#6f5440', mat: 'fabric', build: (w, d, h) => [...legs(w, d, 0.25, 0.05, 'b'), bx(0, 0.25, 0.2, w, 0.1, d - 0.4, 'a'), bx(0, 0.25, -d / 2 + 0.25, w, h - 0.25, 0.1, 'a+')] },
  { id: 'planter', name: 'Planter box', cat: 'Structure', w: 1.2, d: 0.4, h: 0.9, color: '#5f9a58', color2: '#7a7570', build: (w, d, h) => [bx(0, 0, 0, w, h * 0.45, d, 'b'), sp(-w * 0.25, h * 0.35, 0, w * 0.5, h * 0.65, d * 1.1, 'a'), sp(w * 0.2, h * 0.4, 0, w * 0.55, h * 0.6, d * 1.1, 'a+')] },
  { id: 'pooltable', name: 'Pool table', cat: 'Structure', w: 2.6, d: 1.45, h: 0.8, color: '#2f7a4f', color2: '#5a3d28', build: (w, d, h) => [...legs(w, d, h - 0.2, 0.14, 'b', 0.08), bx(0, h - 0.2, 0, w, 0.2, d, 'b'), bx(0, h, 0, w - 0.2, 0.004, d - 0.2, 'a')] },

  // ---------- Custom primitives (also the base for imported pieces) ----------
  { id: 'box', name: 'Custom box', cat: 'Custom', w: 1, d: 0.6, h: 0.8, color: '#b9b2a6', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'cyl', name: 'Custom cylinder', cat: 'Custom', w: 0.8, d: 0.8, h: 0.8, color: '#b9b2a6', build: (w, d, h) => [{ ...cy(0, 0, 0, w, h, 'a'), d }] },
  { id: 'lshape', name: 'L-shaped block', cat: 'Custom', w: 2, d: 1.6, h: 0.9, color: '#b9b2a6', build: (w, d, h) => [bx(0, 0, -d / 2 + d * 0.2, w, h, d * 0.4, 'a'), bx(-w / 2 + w * 0.2, 0, d * 0.2, w * 0.4, h, d * 0.6, 'a')] },
  { id: 'product', name: 'Product from web', cat: 'Custom', w: 1, d: 0.6, h: 0.8, color: '#d8d3c8', hidden: true, build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'model', name: '3D model', cat: 'Custom', w: 1, d: 1, h: 1, color: '#c8ccd2', hidden: true },
];

export const CATALOG = DEFS;
export const CATEGORIES = [...new Set(DEFS.map(d => d.cat))];
const byId = Object.fromEntries(DEFS.map(d => [d.id, d]));
export const getDef = type => byId[type] || byId.box;

const NAMED = { metal: '#b9bdc3', steel: '#c9ccd1', dark: '#2b2d31', black: '#141416', white: '#f6f5f2', glass: '#a9d4e6', screen: '#0c1016', mirror: '#cfe3ea' };
export function resolveColor(c, item) {
  if (c[0] === '#') return c;
  if (NAMED[c]) return NAMED[c];
  const base = c[0] === 'a' ? item.color : item.color2 || getDef(item.type).color2 || '#8a6a4c';
  return c[1] === '+' ? shade(base, 0.14) : c[1] === '-' ? shade(base, -0.14) : base;
}

export function partsFor(item) {
  const def = getDef(item.type);
  let parts = def.build ? def.build(item.w, item.d, item.h, item) : [];
  if (item.flip) parts = parts.map(p => ({ ...p, x: -p.x, ry: p.ry ? -p.ry : 0 }));
  return parts;
}

const imgCache = new Map();
export function cachedImage(src, onload) {
  let im = imgCache.get(src);
  if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => onload?.(); im.src = src; imgCache.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}

/** Draw the top-down plan symbol. `ctx` is already in the item's local frame (metres, origin at centre). */
export function drawSymbol(ctx, item, lw, imageSrc, redraw) {
  const { w, d } = item;
  ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(30,34,40,.55)'; ctx.lineJoin = 'round';
  if (item.type === 'model' || item.type === 'product') {
    ctx.fillStyle = item.color; ctx.fillRect(-w / 2, -d / 2, w, d);
    const im = imageSrc && cachedImage(imageSrc, redraw);
    if (im) { const s = Math.min(w / im.naturalWidth, d / im.naturalHeight); ctx.drawImage(im, (-im.naturalWidth * s) / 2, (-im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); }
    else if (item.type === 'model') { ctx.beginPath(); ctx.moveTo(-w / 2, -d / 2); ctx.lineTo(w / 2, d / 2); ctx.moveTo(w / 2, -d / 2); ctx.lineTo(-w / 2, d / 2); ctx.globalAlpha *= 0.35; ctx.stroke(); ctx.globalAlpha /= 0.35; }
    ctx.strokeRect(-w / 2, -d / 2, w, d);
    return;
  }
  const parts = partsFor(item).slice().sort((p, q) => p.y + p.h - (q.y + q.h));
  for (const p of parts) {
    ctx.save();
    ctx.translate(p.x, p.z);
    if (p.ry) ctx.rotate(-p.ry);
    if (p.c === 'glass') ctx.globalAlpha *= 0.45;
    ctx.fillStyle = resolveColor(p.c, item);
    ctx.beginPath();
    if (p.s === 'box' || p.s === 'disc') ctx.rect(-p.w / 2, -p.d / 2, p.w, p.d);
    else { const k = p.s === 'cyl' && p.t > 1 ? p.t : 1; ctx.ellipse(0, 0, (p.w / 2) * k, (p.d / 2) * k, 0, 0, Math.PI * 2); }
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

/** Small top-down preview for catalogue cards. */
export function thumbnail(item, size = 64) {
  const c = document.createElement('canvas'), dpr = 2;
  c.width = c.height = size * dpr; c.style.width = c.style.height = size + 'px';
  const ctx = c.getContext('2d'), s = ((size - 10) * dpr) / Math.max(item.w, item.d, 0.2);
  ctx.translate((size * dpr) / 2, (size * dpr) / 2); ctx.scale(s, s);
  drawSymbol(ctx, item, 1.4 / s * dpr / 2);
  return c;
}

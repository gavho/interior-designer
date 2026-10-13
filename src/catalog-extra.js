// Office furniture, desk-setup accessories and modern pieces / appliances, modelled finely enough to hold up close-to.
// `on: 1` pieces rest on whatever furniture is under them; `surf: 1` marks an accessory other things can stand on.
import { bx, rb, cy, sp, disc, hex, legs, stalk, books } from './parts.js';
import { rad } from './util.js';

const TOP = 0.028; // desktop thickness

// ---------- desks & seating ----------
const standDesk = (w, d, h) => {
  const lx = w / 2 - Math.min(0.2, w * 0.14), up = h - TOP - 0.04, split = 0.025 + up * 0.56;
  return [rb(0, h - TOP, 0, w, TOP, d, 'a', 0.006), bx(0, up, 0, 2 * lx, 0.035, 0.08, 'b'), bx(w / 2 - 0.24, h - TOP - 0.02, d / 2 - 0.035, 0.11, 0.02, 0.05, 'dark'),
    ...[-1, 1].flatMap(s => [rb(s * lx, 0, 0, 0.075, 0.025, d * 0.92, 'b', 0.008), bx(s * lx, 0.025, 0, 0.08, split - 0.025, 0.055, 'b'), bx(s * lx, split, 0, 0.066, Math.max(0.01, up - split), 0.042, 'b+'), bx(s * lx, up, 0, 0.05, 0.04, d * 0.8, 'b')])];
};
const sledDesk = (w, d, h) => [rb(0, h - TOP, 0, w, TOP, d, 'a', 0.006), bx(0, h - TOP - 0.03, -d / 2 + 0.12, w - 0.16, 0.03, 0.02, 'b'),
  ...[-1, 1].flatMap(s => { const x = s * (w / 2 - 0.06), t = 0.028; return [bx(x, 0, 0, t, t, d - 0.08, 'b'), bx(x, h - TOP - t, 0, t, t, d - 0.08, 'b'), bx(x, t, -d / 2 + 0.04 + t / 2, t, h - TOP - 2 * t, t, 'b'), bx(x, t, d / 2 - 0.04 - t / 2, t, h - TOP - 2 * t, t, 'b')]; })];
const lDesk = (w, d, h) => {
  const md = Math.min(0.72, d * 0.48), rw = Math.min(0.62, w * 0.42), t = 0.04, y = h - TOP;
  const post = (x, z) => bx(x, 0, z, t, y, t, 'b');
  return [rb(0, y, -d / 2 + md / 2, w, TOP, md, 'a', 0.006), rb(-w / 2 + rw / 2, y, md / 2, rw, TOP, d - md, 'a', 0.006),
    post(-w / 2 + 0.05, -d / 2 + 0.05), post(w / 2 - 0.05, -d / 2 + 0.05), post(w / 2 - 0.05, -d / 2 + md - 0.05), post(-w / 2 + 0.05, d / 2 - 0.05), post(-w / 2 + rw - 0.05, d / 2 - 0.05),
    bx(0, y - 0.04, -d / 2 + 0.05, w - 0.1, 0.04, 0.025, 'b'), bx(-w / 2 + 0.05, y - 0.04, 0, 0.025, 0.04, d - 0.1, 'b')];
};
const taskChair = (w, d, h) => {
  const sh = Math.min(0.47, h * 0.4), r = Math.min(w, d) * 0.47, y0 = sh + 0.11, bh = Math.max(0.12, h - y0 - 0.2), zb = -d / 2 + 0.1;
  return [...[0, 72, 144, 216, 288].flatMap(a => [bx((Math.sin(rad(a)) * r) / 2, 0.05, (Math.cos(rad(a)) * r) / 2, 0.045, 0.028, r, 'b', { ry: rad(a) }), sp(Math.sin(rad(a)) * r, 0, Math.cos(rad(a)) * r, 0.055, 0.055, 0.055, 'dark')]),
    cy(0, 0.06, 0, 0.06, 0.13, 'dark'), cy(0, 0.19, 0, 0.034, sh - 0.25, 'metal'), bx(0, sh - 0.065, 0, 0.2, 0.035, 0.26, 'b'),
    rb(0, sh - 0.03, 0.03, w * 0.76, 0.075, d * 0.72, 'a', 0.03), bx(0, sh - 0.05, zb - 0.03, 0.07, 0.3, 0.025, 'b', { rx: -0.2 }),
    rb(0, y0, zb - 0.03, w * 0.7, bh, 0.035, 'a', 0.017, { rx: -0.12 }), rb(0, y0 + 0.07, zb + 0.005, w * 0.5, 0.1, 0.03, 'a-', 0.014),
    bx(0, y0 + bh - 0.04, zb - 0.075, 0.035, 0.12, 0.018, 'b'), rb(0, h - 0.14, zb - 0.07, w * 0.42, 0.14, 0.05, 'a', 0.022),
    ...[-1, 1].flatMap(s => [bx(s * (w / 2 - 0.035), sh - 0.03, -0.02, 0.03, 0.21, 0.05, 'b'), rb(s * (w / 2 - 0.035), sh + 0.18, 0.03, 0.075, 0.028, 0.25, 'b+', 0.012)])];
};
const pedestal = (w, d, h) => {
  const out = [...legs(w, d, 0.05, 0.045, 'dark', 0.02), rb(0, 0.05, -0.008, w, h - 0.05, d - 0.016, 'a', 0.006)], rows = [0.22, 0.22, 0.56];
  let y = 0.06;
  for (const k of rows) { const fh = (h - 0.07) * k; out.push(bx(0, y, d / 2 - 0.012, w - 0.012, fh - 0.006, 0.012, 'a+'), bx(0, y + fh - 0.03, d / 2, w * 0.4, 0.008, 0.008, 'dark')); y += fh; }
  return out;
};

// ---------- storage ----------
const cubeShelf = (w, d, h) => {
  const t = 0.036, cols = Math.max(1, Math.round((w - t) / 0.37)), rows = Math.max(1, Math.round((h - t) / 0.37)), cw = (w - t) / cols, ch = (h - t) / rows;
  const out = [bx(0, 0, 0, w, t, d, 'a'), bx(0, h - t, 0, w, t, d, 'a'), bx(-w / 2 + t / 2, t, 0, t, h - 2 * t, d, 'a'), bx(w / 2 - t / 2, t, 0, t, h - 2 * t, d, 'a')];
  for (let c = 1; c < cols; c++) out.push(bx(-w / 2 + t / 2 + c * cw, t, 0, 0.016, h - 2 * t, d - 0.01, 'a'));
  for (let r = 1; r < rows; r++) out.push(bx(0, t / 2 + r * ch - 0.008, 0, w - 2 * t, 0.016, d - 0.01, 'a'));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + t / 2 + (c + 0.5) * cw, y = t / 2 + r * ch + 0.008, k = (r * 3 + c * 5 + rows) % 7, iw = cw - 0.03, ih = ch - 0.03;
    if (k === 0) out.push(rb(x, y, 0.005, iw, ih * 0.9, d - 0.03, 'b', 0.012), bx(x, y + ih * 0.62, d / 2 - 0.008, 0.09, 0.022, 0.006, 'dark'));
    else if (k === 1 || k === 4) out.push(...books(x - (k === 4 ? iw * 0.15 : 0), y, 0, iw * (k === 4 ? 0.6 : 0.95), ih * 0.86, d * 0.62, r * 5 + c));
    else if (k === 2) out.push(cy(x, y, 0.02, 0.11, 0.1, '#d9d4c8', { t: 1.2 }), sp(x, y + 0.08, 0.02, 0.2, 0.18, 0.18, '#5f9a58'));
    else if (k === 5) out.push(rb(x, y, 0.02, iw * 0.7, 0.05, d * 0.6, '#d9c9a5', 0.004), rb(x + 0.01, y + 0.05, 0.02, iw * 0.62, 0.04, d * 0.55, '#3f5f7a', 0.004), cy(x, y + 0.09, 0.02, 0.07, 0.12, '#c98b3f', { t: 0.6 }));
  }
  return out;
};
const openShelving = (w, d, h) => {
  const n = Math.max(2, Math.round(h / 0.42)), gap = (h - 0.06) / n, out = legs(w, d, h, 0.022, 'b', 0);
  for (let i = 0; i <= n; i++) {
    const y = 0.04 + i * gap - 0.02;
    out.push(bx(0, y, 0, w - 0.01, 0.022, d - 0.01, 'a'));
    if (i === n) break;
    if (i % 3 === 0) out.push(...books(-w * 0.18, y + 0.022, 0, w * 0.5, gap * 0.72, d * 0.7, i * 3), rb(w * 0.3, y + 0.022, 0, 0.16, 0.12, d * 0.6, '#b9b2a6', 0.01));
    else if (i % 3 === 1) out.push(cy(-w * 0.28, y + 0.022, 0, 0.12, 0.1, '#e3ded4', { t: 1.2 }), sp(-w * 0.28, y + 0.1, 0, 0.24, 0.2, 0.2, '#4f8a4a'), ...books(w * 0.2, y + 0.022, 0, w * 0.38, gap * 0.66, d * 0.7, i * 7 + 2));
    else out.push(rb(-w * 0.2, y + 0.022, 0, w * 0.34, 0.16, d * 0.72, '#8a6a4c', 0.008), rb(w * 0.2, y + 0.022, 0, w * 0.34, 0.16, d * 0.72, '#d8d3c8', 0.008));
  }
  return out;
};

// ---------- wall panels & boards (back of the piece sits on the wall) ----------
const acousticTiles = (w, d, h) => {
  const nx = Math.max(1, Math.round(w / 0.3)), ny = Math.max(1, Math.round(h / 0.3)), tw = w / nx, th = h / ny, out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = (i * 7 + j * 11 + i * j) % 5;
    out.push(rb(-w / 2 + tw * (i + 0.5), j * th + 0.004, -d / 2 + (k % 2 ? d : d * 0.6) / 2, tw - 0.008, th - 0.008, k % 2 ? d : d * 0.6, ['a', 'a+', 'b', 'a-', 'a'][k], 0.006)); }
  return out;
};
const hexTiles = (w, d, h) => {
  const R = Math.min(0.17, h / 3.6, w / 4), cw = Math.sqrt(3) * R, rows = Math.max(1, Math.floor((h - 2 * R) / (1.5 * R)) + 1), out = [];
  for (let j = 0; j < rows; j++) { const off = j % 2 ? cw / 2 : 0, n = Math.floor((w - off) / cw);
    for (let i = 0; i < n; i++) { const k = (i * 5 + j * 3) % 6; if (k === 4 && rows > 1) continue;
      out.push(hex(-w / 2 + off + cw * (i + 0.5), j * 1.5 * R, -d / 2 + d * (k % 2 ? 0.5 : 0.35), 2 * R - 0.012, d * (k % 2 ? 1 : 0.7), ['a', 'a+', 'b', 'a-', 'a', 'b+'][k])); } }
  return out;
};
const fluted = (w, d, h) => { const n = Math.max(2, Math.round(w / 0.045)), p = w / n;
  return [bx(0, 0, -d / 2 + 0.003, w, h, 0.006, 'a-'), ...Array.from({ length: n }, (_, i) => ({ ...cy(-w / 2 + p * (i + 0.5), 0, -d / 2 + 0.006, p * 0.94, h, 'a'), d: (d - 0.006) * 2 }))]; };
const pegboard = (w, d, h) => {
  const zf = -d / 2 + 0.012, out = [rb(0, 0, -d / 2 + 0.006, w, h, 0.012, 'a', 0.008)], nx = Math.min(14, Math.floor((w - 0.06) / 0.05)), ny = Math.min(10, Math.floor((h - 0.06) / 0.05));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) out.push(disc(-nx * 0.025 + i * 0.05, h / 2 - ny * 0.025 + j * 0.05 - 0.006, zf, 0.012, 0.001, 'dark'));
  return [...out, bx(-w * 0.22, h * 0.62, zf + (d - 0.012) / 2, w * 0.4, 0.012, d - 0.012, 'b'), ...books(-w * 0.26, h * 0.62 + 0.012, zf + (d - 0.012) / 2, w * 0.24, 0.16, (d - 0.012) * 0.9, 3),
    cy(-w * 0.07, h * 0.62 + 0.012, zf + 0.045, 0.06, 0.08, '#d9d4c8'), sp(-w * 0.07, h * 0.62 + 0.08, zf + 0.045, 0.1, 0.09, 0.09, '#5f9a58'),
    rb(w * 0.26, h * 0.5, zf + 0.04, 0.16, 0.09, 0.07, 'b', 0.008), stalk(w * 0.22, h * 0.56, zf + 0.04, 0.008, 0.13, '#d9734e', 0.2), stalk(w * 0.28, h * 0.56, zf + 0.04, 0.008, 0.14, '#3f5f7a', -0.15), stalk(w * 0.25, h * 0.56, zf + 0.045, 0.008, 0.12, '#2b2d31', 0),
    ...[-0.3, -0.18, 0.1].map(k => bx(w * k, h * 0.26, zf + 0.025, 0.008, 0.008, 0.05, 'metal')), bx(w * 0.1, h * 0.12, zf + 0.004, 0.11, 0.14, 0.002, '#f3e9b0'), bx(w * 0.3, h * 0.16, zf + 0.004, 0.09, 0.09, 0.002, '#f6f5f2')];
};
const whiteboard = (w, d, h) => [rb(0, 0, -d / 2 + 0.009, w, h, 0.018, 'alu', 0.006), bx(0, 0.018, -d / 2 + 0.019, w - 0.036, h - 0.036, 0.002, 'white'), bx(0, -0.01, 0, w * 0.5, 0.012, d, 'alu'),
  ...['#c23b3b', '#2f5fa8', '#2b2d31'].map((c, i) => bx(-0.09 + i * 0.13, 0.002, 0.005, 0.11, 0.014, 0.014, c))];
const corkboard = (w, d, h) => [rb(0, 0, -d / 2 + 0.01, w, h, 0.02, 'b', 0.004), bx(0, 0.025, -d / 2 + 0.021, w - 0.05, h - 0.05, 0.003, 'a'),
  ...[[-0.3, 0.55, 0.16, 0.2, '#f6f5f2'], [-0.05, 0.6, 0.12, 0.12, '#f3e9b0'], [0.24, 0.5, 0.2, 0.26, '#f6f5f2'], [-0.22, 0.18, 0.2, 0.14, '#cfe0e8'], [0.06, 0.2, 0.12, 0.12, '#f1c9c2']]
    .flatMap(([x, y, pw, ph, c]) => [bx(x * w, y * h, -d / 2 + 0.024, pw * w, ph * h, 0.002, c), sp(x * w, (y + ph) * h - 0.022, -d / 2 + 0.024, 0.012, 0.012, 0.012, '#c23b3b')])];
const ledge = (w, d, h) => [bx(0, 0, 0, w, 0.018, d, 'a'), bx(0, 0.018, d / 2 - 0.006, w, 0.022, 0.012, 'a'), bx(0, 0.018, -d / 2 + 0.006, w, 0.05, 0.012, 'a'),
  ...[[-0.3, 0.3, 1, '#2b2d31', '#d9c9a5'], [0.02, 0.24, 0.72, '#b08456', '#8fa3a8'], [0.3, 0.2, 0.55, '#f6f5f2', '#c98f6b']].flatMap(([x, fw, fh, c, art], i) => { const H = (h - 0.02) * fh, a = -0.09, zc = -d * 0.12 + i * 0.006;
    return [bx(x * w, 0.02, zc, fw * w, H, 0.016, c, { rx: a }), bx(x * w, 0.02 + H * 0.1, zc + 0.009, fw * w * 0.76, H * 0.8, 0.002, art, { rx: a })]; })];
const bracketShelf = (w, d, h) => [rb(0, h - 0.03, 0, w, 0.03, d, 'a', 0.004), ...[-1, 1].flatMap(s => [bx(s * (w / 2 - 0.12), 0, -d / 2 + 0.004, 0.028, h - 0.03, 0.008, 'b'), bx(s * (w / 2 - 0.12), h - 0.038, 0, 0.028, 0.008, d * 0.86, 'b')])];

// ---------- screens & computers (the user sits on the +z side) ----------
const panel = (w, ph, y, z) => [rb(0, y, z, w, ph, 0.028, 'a', 0.006), bx(0, y + 0.014, z + 0.0145, w - 0.014, ph - 0.024, 0.001, 'display')];
const monitor = (w, d, h) => { const ph = Math.min(h * 0.82, w * 0.6), zb = -d / 2;
  return [rb(0, 0, 0, Math.min(0.26, w * 0.42), 0.012, d, 'alu', 0.005), bx(0, 0.012, zb + 0.045, 0.055, h - ph / 2 - 0.012, 0.016, 'alu'), bx(0, h - ph * 0.62, zb + 0.06, 0.09, ph * 0.24, 0.02, 'dark'), ...panel(w, ph, h - ph, zb + 0.084)]; };
const armMonitor = (w, d, h) => { const ph = Math.min(h * 0.72, w * 0.6), zb = -d / 2 + 0.035, cyy = h - ph / 2, zp = d / 2 - 0.014, zq = zp - 0.03, ex = 0.13, ez = (zb + zq) / 2;
  const seg = (xa, za, xb, zc, y) => rb((xa + xb) / 2, y, (za + zc) / 2, 0.032, 0.032, Math.hypot(xb - xa, zc - za) + 0.03, 'alu', 0.012, { ry: Math.atan2(xb - xa, zc - za) });
  return [rb(0, -0.035, zb - 0.01, 0.075, 0.047, 0.07, 'dark', 0.006), cy(0, 0.012, zb, 0.036, cyy + 0.01, 'alu'), seg(0, zb, ex, ez, cyy - 0.05), seg(ex, ez, 0, zq, cyy - 0.016), cy(ex, cyy - 0.054, ez, 0.042, 0.074, 'dark'),
    bx(0, cyy - 0.055, zp - 0.022, 0.11, 0.11, 0.016, 'dark'), ...panel(w, ph, h - ph, zp)]; };
const laptop = (w, d) => { const th = rad(16), bd = d / (1 + Math.sin(th)), L = bd, zc = d / 2 - bd / 2, zh = d / 2 - bd + 0.004, cyy = 0.013 + (L / 2) * Math.cos(th), cz = zh - (L / 2) * Math.sin(th);
  return [rb(0, 0, zc, w, 0.013, bd, 'a', 0.005), bx(0, 0.013, zc - bd * 0.12, w * 0.88, 0.0006, bd * 0.46, 'dark'), bx(0, 0.013, zc + bd * 0.3, w * 0.34, 0.0006, bd * 0.3, 'a-'),
    rb(0, cyy - L / 2, cz, w, L, 0.006, 'a', 0.0028, { rx: -th }), bx(0, cyy - L / 2 + 0.007 + Math.sin(th) * 0.0034, cz + Math.cos(th) * 0.0034, w - 0.012, L - 0.016, 0.0008, 'display', { rx: -th })]; };
const keyboard = (w, d, h) => {
  const u = 0.019, cols = Math.max(4, Math.round((w - 0.014) / u)), rows = Math.max(2, Math.round((d - 0.014) / u)), kw = (w - 0.014) / cols, kd = (d - 0.014) / rows, y = h * 0.55, out = [rb(0, 0, 0, w, y, d, 'a', 0.005)];
  const key = (c0, r, n, col) => rb(-w / 2 + 0.007 + kw * (c0 + n / 2), y, -d / 2 + 0.007 + kd * (r + 0.5), kw * n - 0.0026, h - y, kd - 0.0026, col, 0.0018);
  for (let r = 0; r < rows; r++) {
    if (r === rows - 1 && cols >= 10) { const s0 = Math.round(cols * 0.26), sn = Math.round(cols * 0.36);
      for (let c = 0; c < s0; c++) out.push(key(c, r, 1, 'b')); out.push(key(s0, r, sn, 'b')); for (let c = s0 + sn; c < cols; c++) out.push(key(c, r, 1, 'b')); continue; }
    for (let c = 0; c < cols; c++) out.push(key(c, r, 1, (r === 0 && c === 0) || (r === rows - 3 && c === cols - 1) ? '#d9734e' : r === 0 || c === 0 || c === cols - 1 ? 'b-' : 'b'));
  }
  return out;
};
const pcTower = (w, d, h) => [...legs(w, d, 0.015, 0.03, 'dark', 0.02), rb(0, 0.015, 0, w, h - 0.015, d, 'a', 0.008), bx(-w / 2 - 0.001, 0.04, 0, 0.004, h - 0.07, d - 0.05, 'glass'), bx(0, 0.04, d / 2, w - 0.03, h - 0.07, 0.003, 'a-'),
  ...[0.22, 0.5, 0.78].flatMap(k => [disc(0, 0.015 + (h - 0.015) * k - w * 0.3, d / 2 + 0.001, w * 0.6, 0.004, 'dark'), disc(0, 0.015 + (h - 0.015) * k - w * 0.08, d / 2 + 0.002, w * 0.16, 0.005, 'a')]),
  bx(0, h, -d * 0.1, w * 0.7, 0.002, d * 0.5, 'dark'), cy(w * 0.25, h, d / 2 - 0.03, 0.014, 0.002, 'led')];

// ---------- desk accessories ----------
const mouse = (w, d, h) => [sp(0, -h, 0, w, 2 * h, d, 'a'), bx(0, h * 0.86, -d * 0.2, w * 0.1, h * 0.14, d * 0.16, 'dark')];
const riser = (w, d, h) => [rb(0, h - 0.018, 0, w, 0.018, d, 'a', 0.004), ...[-1, 1].flatMap(s => { const x = s * (w / 2 - 0.05); return [bx(x, 0, 0, 0.012, 0.006, d - 0.03, 'b'), bx(x, 0.006, -d / 2 + 0.021, 0.012, h - 0.024, 0.012, 'b'), bx(x, 0.006, d / 2 - 0.021, 0.012, h - 0.024, 0.012, 'b')]; })];
const deskShelf = (w, d, h) => [rb(0, h - 0.018, 0, w, 0.018, d, 'a', 0.004), bx(-w / 2 + 0.009, 0, 0, 0.018, h - 0.018, d - 0.006, 'a'), bx(w / 2 - 0.009, 0, 0, 0.018, h - 0.018, d - 0.006, 'a'), bx(w * 0.18, 0, 0, 0.014, h - 0.018, d - 0.02, 'a'),
  bx(w * 0.34, 0.002, 0.004, w * 0.3 - 0.022, h - 0.024, d - 0.012, 'a-'), bx(w * 0.34, h * 0.4, d / 2 - 0.001, 0.05, 0.006, 0.006, 'dark')];
const deskLamp = (w, d, h) => { const x0 = -w / 2 + d / 2; return [cy(x0, 0, 0, d, 0.014, 'a'), cy(x0, 0.014, 0, 0.014, h - 0.03, 'a'), rb(x0 + (w - d / 2) / 2 - 0.01, h - 0.02, 0, w - d / 2, 0.016, 0.034, 'a', 0.007), bx(x0 + (w - d / 2) / 2 + 0.02, h - 0.022, 0, w - d / 2 - 0.08, 0.003, 0.022, 'led')]; };
const speaker = (w, d, h) => [rb(0, 0, -0.004, w, h, d - 0.008, 'a', 0.012), disc(0, h * 0.12, d / 2 - 0.006, w * 0.74, 0.004, 'dark'), disc(0, h * 0.12 + w * 0.2, d / 2 - 0.003, w * 0.34, 0.005, 'b'), disc(0, h * 0.68, d / 2 - 0.006, w * 0.34, 0.004, 'dark'), disc(0, h * 0.68 + w * 0.1, d / 2 - 0.003, w * 0.14, 0.005, 'b')];
const headphones = (w, d, h) => { const x = w / 2 - 0.022; return [cy(0, 0, 0, d, 0.012, 'b'), cy(0, 0.012, 0, 0.016, h - 0.04, 'b'), rb(0, h - 0.034, 0, 0.06, 0.012, 0.04, 'b', 0.005),
  rb(0, h - 0.02, 0, 2 * x + 0.014, 0.02, 0.03, 'a', 0.009), ...[-1, 1].flatMap(s => [rb(s * x, h - 0.13, 0, 0.012, 0.12, 0.022, 'a', 0.005), sp(s * x, h - 0.23, 0, 0.042, 0.1, 0.085, 'a'), sp(s * (x - 0.014), h - 0.225, 0, 0.03, 0.09, 0.075, 'dark')])]; };
const microphone = (w, d, h) => [cy(0, 0, 0, w, 0.014, 'b'), cy(0, 0.014, 0, 0.012, h * 0.5, 'b'), bx(0, h * 0.5, 0, 0.07, 0.01, 0.012, 'b'), cy(0, h * 0.46, 0, 0.052, h * 0.38, 'a'), sp(0, h * 0.74, 0, 0.056, h * 0.26, 0.056, 'metal'), cy(0, h * 0.6, 0.0265, 0.008, 0.003, 'led')];
const mug = (w, d, h) => [cy(-w / 2 + d / 2, 0, 0, d, h, 'a'), cy(-w / 2 + d / 2, h - 0.0015, 0, d * 0.84, 0.002, '#4a2c1a'), rb(w / 2 - 0.016, h * 0.22, 0, 0.03, h * 0.55, 0.012, 'a', 0.005)];
const penCup = (w, d, h) => [cy(0, 0, 0, w, h * 0.7, 'a'), stalk(-0.012, h * 0.3, 0.008, 0.008, h * 0.7, '#d9734e', 0.16, 0.05), stalk(0.014, h * 0.3, -0.006, 0.008, h * 0.66, '#3f5f7a', -0.14, -0.08), stalk(0, h * 0.3, 0.012, 0.007, h * 0.62, '#2b2d31', 0.03, 0.14), stalk(0.004, h * 0.3, -0.014, 0.009, h * 0.56, '#e8b44a', -0.05, -0.16), bx(-0.018, h * 0.3, -0.01, 0.022, h * 0.6, 0.003, 'metal', { rz: 0.1 })];
const bookStack = (w, d, h) => { const n = Math.max(1, Math.round(h / 0.03)), t = h / n; return Array.from({ length: n }, (_, i) => [rb((i % 2 ? 0.006 : -0.004), i * t, 0, w * (1 - i * 0.07), t, d * (1 - i * 0.06), ['#3f5f7a', '#d9c9a5', '#8c4a3c', '#2f3338', '#56715a'][i % 5], 0.003, { ry: (i % 3 - 1) * 0.07 }), bx((i % 2 ? 0.006 : -0.004), i * t + 0.003, d * 0.012, w * (1 - i * 0.07) - 0.008, t - 0.006, d * (1 - i * 0.06) - 0.006, '#f6f5f2', { ry: (i % 3 - 1) * 0.07 })]).flat(); };
const notebook = (w, d, h) => [rb(-w * 0.06, 0, 0, w * 0.88, h, d, 'a', 0.003), bx(-w * 0.06, 0.002, 0.002, w * 0.88 - 0.006, h - 0.003, d - 0.006, '#f6f5f2'), bx(-w * 0.06, 0, 0, w * 0.88, h + 0.0006, 0.012, 'b'), rb(w / 2 - 0.006, 0, 0, 0.009, 0.009, d * 0.72, 'b', 0.004)];
const photoFrame = (w, d, h) => [bx(0, 0.002, -d * 0.1, w, h, 0.012, 'a', { rx: -0.22 }), bx(0, 0.002 + h * 0.08, -d * 0.1 + 0.0075, w * 0.84, h * 0.84, 0.002, 'white', { rx: -0.22 }), bx(0, 0.002 + h * 0.16, -d * 0.1 + 0.009, w * 0.66, h * 0.66, 0.002, 'b', { rx: -0.22 }), bx(0, 0, -d / 2 + 0.01, 0.02, h * 0.6, 0.004, 'a', { rx: 0.35 })];
const printer = (w, d, h) => [rb(0, 0, 0, w, h * 0.86, d, 'a', 0.012), rb(0, h * 0.86, -d * 0.04, w * 0.94, h * 0.14, d * 0.84, 'a-', 0.006), bx(0, h * 0.2, d / 2 - 0.002, w * 0.72, h * 0.16, 0.006, 'dark'), bx(0, h * 0.24, d / 2 + 0.03, w * 0.66, 0.006, 0.08, 'a+'), bx(0, h * 0.25, d / 2 + 0.02, w * 0.5, 0.002, 0.07, 'white'),
  bx(w * 0.3, h * 0.6, d / 2 - 0.001, w * 0.22, h * 0.16, 0.004, 'black'), disc(-w * 0.36, h * 0.66, d / 2, 0.014, 0.003, 'led')];
const bin = (w, d, h) => [{ ...cy(0, 0, 0, w / 1.18, h, 'a', { t: 1.18 }), d: d / 1.18 }, { ...cy(0, h - 0.002, 0, w * 0.93, 0.003, 'dark'), d: d * 0.93 }];

// ---------- plants ----------
const pot = (dia, h, c = 'b') => [cy(0, 0, 0, dia / 1.15, h, c, { t: 1.15 }), cy(0, h - 0.004, 0, dia * 0.9, 0.005, '#3a2c20')];
const snakePlant = (w, d, h) => { const ph = Math.min(0.28, h * 0.3), n = 9;
  return [...pot(w * 0.62, ph), ...Array.from({ length: n }, (_, i) => { const a = (i * 137.5 * Math.PI) / 180, r = w * 0.12 * (i ? 1 : 0), L = (h - ph) * (0.62 + ((i * 7) % 5) * 0.095), lean = i ? 0.1 + ((i * 3) % 4) * 0.035 : 0;
    return { ...stalk(Math.cos(a) * r, ph - 0.01, Math.sin(a) * r, 0.055, L, i % 3 ? 'a' : 'a-', -Math.cos(a) * lean, Math.sin(a) * lean, { t: 0.12 }), d: 0.016, ry: 0 }; })]; };
const fiddleFig = (w, d, h) => { const ph = Math.min(0.34, h * 0.22), out = [...pot(w * 0.5, ph), stalk(0, ph - 0.01, 0, 0.03, h * 0.5, '#6b4f2f', 0.04, -0.03)];
  for (let i = 0; i < 16; i++) { const a = (i * 137.5 * Math.PI) / 180, k = i / 15, r = w * (0.16 + 0.2 * Math.sin(Math.PI * (0.25 + k * 0.7))), y = ph + (h - ph) * (0.32 + k * 0.56), s = w * (0.36 - k * 0.1);
    out.push({ ...sp(Math.cos(a) * r, y, Math.sin(a) * r, s, s * 0.34, s * 0.62, i % 3 ? 'a' : i % 2 ? 'a+' : 'a-'), ry: -a, rz: 0.45 }); }
  return out; };
const succulent = (w, d, h) => [...pot(w * 0.9, h * 0.55), ...Array.from({ length: 9 }, (_, i) => { const a = (i * 137.5 * Math.PI) / 180, r = i ? w * (0.1 + (i % 3) * 0.05) : 0;
  return { ...sp(Math.cos(a) * r, h * 0.48 + (i ? (3 - (i % 3)) * h * 0.04 : h * 0.14), Math.sin(a) * r, w * 0.3, h * 0.2, w * 0.18, i % 2 ? 'a' : 'a+'), ry: -a, rz: i ? 0.5 : 0 }; })];
const pothos = (w, d, h) => { const ph = h * 0.3, out = [...pot(w * 0.6, ph), ...[[0, 0, 0.5], [-0.24, 0.04, 0.36], [0.24, -0.03, 0.36], [0.05, 0.2, 0.34], [-0.08, -0.2, 0.32]].map(([x, z, s], i) => sp(x * w, ph * 0.85, z * d, w * s, h * (0.3 + s * 0.4), w * s, i % 2 ? 'a+' : 'a'))];
  for (let i = 0; i < 7; i++) { const x = -w * 0.38 + (i * w * 0.76) / 6, L = h * (0.5 + ((i * 5) % 4) * 0.16), z = d * (0.2 + ((i * 3) % 3) * 0.1);
    out.push(bx(x, ph * 0.9 - L, z, 0.004, L, 0.004, 'a-'), ...Array.from({ length: Math.round(L / 0.05) }, (_, j) => ({ ...sp(x + (j % 2 ? 0.014 : -0.014), ph * 0.9 - (j + 1) * 0.05, z, 0.042, 0.05, 0.016, (i + j) % 3 ? 'a' : 'a+'), rz: j % 2 ? -0.5 : 0.5 }))); }
  return out; };

// ---------- modern furniture ----------
const modernSofa = (w, d, h) => {
  const b = 0.12, sh = Math.min(0.42, h * 0.56), arm = Math.min(0.16, w * 0.09), back = 0.18, iw = w - 2 * arm, n = Math.max(1, Math.round(iw / 0.85)), cw = iw / n;
  const out = [...legs(w, d, b, 0.022, 'dark', 0.06), rb(0, b, 0, w, 0.13, d, 'a-', 0.03), rb(0, b + 0.1, -d / 2 + back / 2, w, h * 0.78 - b - 0.1, back, 'a', 0.05),
    rb(-w / 2 + arm / 2, b + 0.1, 0, arm, sh + 0.16 - b - 0.1, d, 'a', 0.05), rb(w / 2 - arm / 2, b + 0.1, 0, arm, sh + 0.16 - b - 0.1, d, 'a', 0.05)];
  for (let i = 0; i < n; i++) { const x = -iw / 2 + cw * (i + 0.5);
    out.push(rb(x, b + 0.12, back / 2, cw - 0.012, sh - b - 0.12, d - back - 0.01, 'a+', 0.045), rb(x, sh - 0.02, -d / 2 + back + 0.06, cw - 0.03, h - sh + 0.02, 0.17, 'a+', 0.07, { rx: -0.16 })); }
  return out;
};
const lounge = (w, d, h) => { const sh = 0.38; return [...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => stalk(sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.12), 0.03, 0.3, 'b', sx * 0.2, -sz * 0.2, { t: 1.6 })),
  rb(0, 0.26, 0.02, w - 0.06, 0.05, d - 0.1, 'b', 0.02), rb(0, 0.3, 0.05, w - 0.12, sh - 0.2, d - 0.2, 'a', 0.05), rb(0, 0.34, -d / 2 + 0.13, w - 0.1, h - 0.36, 0.13, 'a', 0.06, { rx: -0.22 }),
  ...[-1, 1].flatMap(s => [bx(s * (w / 2 - 0.03), 0.3, 0, 0.022, 0.26, 0.022, 'b'), rb(s * (w / 2 - 0.03), 0.55, -0.02, 0.05, 0.022, d * 0.62, 'b', 0.01)])]; };
const platformBed = (w, d, h) => { const n = w > 1.2 ? 2 : 1, pw = (w - 0.2) / n, m = 0.26;
  return [bx(0, 0, 0.02, w - 0.24, 0.1, d - 0.24, 'dark'), rb(0, 0.1, 0, w + 0.14, 0.08, d + 0.06, 'b', 0.01), rb(0, 0.18, -d / 2 + 0.02, w + 0.14, h - 0.18, 0.05, 'b', 0.012),
    rb(0, 0.18, 0.04, w, m, d - 0.04, 'white', 0.06), rb(0, 0.2, d * 0.17, w + 0.03, m + 0.03, d * 0.62, 'a', 0.07), rb(0, 0.22, -d * 0.15, w + 0.03, m + 0.035, 0.2, 'a+', 0.06),
    ...Array.from({ length: n }, (_, i) => rb(-w / 2 + 0.1 + pw * (i + 0.5), 0.18 + m - 0.03, -d / 2 + 0.3, pw - 0.06, 0.14, 0.4, 'white', 0.06, { rx: -0.12 }))]; };
const pedestalTable = (w, d, h) => [{ ...cy(0, h - 0.025, 0, w, 0.025, 'a'), d }, cy(0, 0.02, 0, w * 0.2, h - 0.045, 'a', { t: 0.55 }), { ...cy(0, 0, 0, w * 0.62, 0.02, 'a'), d: d * 0.62 }];
const slimLamp = (w, d, h) => [cy(0, 0, 0, w, 0.015, 'b'), cy(0, 0.015, 0, 0.016, h - 0.2, 'b'), cy(0, h - 0.2, 0, w * 0.5, 0.2, 'a', { t: 0.8 }), cy(0, h - 0.202, 0, w * 0.44, 0.003, 'led')];

// ---------- appliances ----------
const slimFridge = (w, d, h) => { const fz = h * 0.36, z = d / 2 - 0.025; return [bx(0, 0, -0.03, w, h, d - 0.06, 'a-'), rb(0, 0.04, z, w - 0.006, fz - 0.045, 0.05, 'a', 0.006), rb(0, fz + 0.004, z, w - 0.006, h - fz - 0.008, 0.05, 'a', 0.006),
  bx(-w / 2 + 0.04, fz + 0.1, d / 2 + 0.012, 0.016, (h - fz) * 0.5, 0.024, 'metal'), bx(-w / 2 + 0.04, fz - 0.26, d / 2 + 0.012, 0.016, 0.2, 0.024, 'metal'), bx(0, 0, -0.02, w - 0.04, 0.04, d - 0.1, 'dark')]; };
const ovenTower = (w, d, h) => { const o = 0.6, y0 = Math.min(0.75, h * 0.34); return [bx(0, 0, -0.04, w, 0.1, d - 0.1, 'dark'), bx(0, 0.1, -0.01, w, h - 0.1, d - 0.02, 'a'), rb(0, 0.11, d / 2 - 0.01, w - 0.008, y0 - 0.12, 0.02, 'a+', 0.003), rb(0, y0 + 2 * o + 0.01, d / 2 - 0.01, w - 0.008, Math.max(0.02, h - y0 - 2 * o - 0.02), 0.02, 'a+', 0.003),
  ...[0, 1].flatMap(i => { const y = y0 + i * o; return [bx(0, y + 0.004, d / 2 - 0.01, w - 0.02, o - 0.008, 0.022, 'black'), bx(0, y + 0.04, d / 2 + 0.002, w - 0.12, o * 0.58, 0.002, 'screen'), bx(0, y + o * 0.74, d / 2 + 0.03, w - 0.1, 0.016, 0.016, 'metal'), bx(-w / 2 + 0.07, y + o * 0.74, d / 2 + 0.014, 0.014, 0.016, 0.03, 'metal'), bx(w / 2 - 0.07, y + o * 0.74, d / 2 + 0.014, 0.014, 0.016, 0.03, 'metal'), bx(0, y + o * 0.86, d / 2 + 0.002, 0.14, 0.03, 0.002, 'display')]; })]; };
const cooktop = (w, d, h) => [rb(0, 0, 0, w, h, d, 'black', h * 0.45), ...[[-0.25, -0.2, 0.2], [0.25, -0.2, 0.16], [-0.25, 0.22, 0.16], [0.25, 0.22, 0.2]].flatMap(([x, z, r]) => [cy(x * w, h, z * d, r, 0.0006, '#3a3d44'), cy(x * w, h + 0.0004, z * d, r * 0.93, 0.0006, 'black')]), bx(0, h, d / 2 - 0.035, w * 0.3, 0.0006, 0.018, '#3a3d44')];
const wineFridge = (w, d, h) => [bx(0, 0, -0.04, w - 0.02, 0.08, d - 0.1, 'dark'), bx(0, 0.08, -0.02, w, h - 0.08, d - 0.04, 'a'), bx(0, 0.1, d / 2 - 0.038, w - 0.05, h - 0.13, 0.004, 'black'),
  ...Array.from({ length: 5 }, (_, i) => [bx(0, 0.16 + i * (h - 0.26) / 5, d / 2 - 0.03, w - 0.08, 0.012, 0.012, '#8a6a4c'), ...[-0.3, -0.1, 0.1, 0.3].map(x => disc(x * w, 0.18 + i * (h - 0.26) / 5, d / 2 - 0.03, 0.075, 0.01, '#31402e'))]).flat(),
  bx(0, 0.09, d / 2 - 0.012, w - 0.012, h - 0.1, 0.02, 'glass'), bx(-w / 2 + 0.035, h * 0.3, d / 2 + 0.014, 0.016, h * 0.45, 0.022, 'metal')];
const espresso = (w, d, h) => [rb(0, 0, -d * 0.18, w, h, d * 0.64, 'a', 0.012), rb(0, 0, d * 0.2, w * 0.9, 0.03, d * 0.56, 'dark', 0.006), bx(0, 0.03, d * 0.2, w * 0.8, 0.003, d * 0.48, 'metal'), rb(0, h * 0.62, d * 0.18, w, h * 0.38, d * 0.3, 'a', 0.012),
  cy(-w * 0.14, h * 0.5, d * 0.2, 0.06, h * 0.12, 'metal'), bx(-w * 0.14, h * 0.5, d * 0.3, 0.018, 0.014, 0.11, 'dark'), stalk(w * 0.32, h * 0.36, d * 0.2, 0.01, h * 0.28, 'metal', 0.25, 0.2),
  cy(-w * 0.14, 0.033, d * 0.2, 0.062, 0.055, 'white'), ...[-0.25, 0, 0.25].map(x => disc(x * w, h * 0.74, d * 0.33, 0.032, 0.008, 'metal')), cy(0, h, -d * 0.2, w * 0.5, 0.004, 'metal'), cy(w * 0.12, h + 0.004, -d * 0.22, 0.06, 0.05, 'white'), cy(-w * 0.14, h + 0.004, -d * 0.16, 0.06, 0.05, 'white')];
const kettle = (w, d, h) => [cy(0, 0, 0, d * 0.95, 0.02, 'dark'), cy(0, 0.02, 0, d, h - 0.045, 'a', { t: 0.78 }), cy(0, h - 0.025, 0, d * 0.76, 0.014, 'dark'), sp(0, h - 0.018, 0, 0.03, 0.03, 0.03, 'dark'), rb(d / 2 + 0.012, h * 0.24, 0, 0.022, h * 0.62, 0.026, 'dark', 0.009), bx(d * 0.42, h * 0.8, 0, 0.05, 0.018, 0.024, 'dark'), bx(-d * 0.4, h * 0.82, 0, 0.04, 0.02, 0.03, 'a', { rz: -0.5 })];
const toaster = (w, d, h) => [rb(0, 0.01, 0, w, h - 0.01, d, 'a', 0.03), bx(0, 0, 0, w * 0.86, 0.012, d * 0.84, 'dark'), ...[-0.2, 0.2].map(z => bx(-w * 0.03, h - 0.001, z * d, w * 0.62, 0.002, 0.026, 'black')), bx(w / 2 + 0.008, h * 0.55, 0, 0.018, 0.016, 0.04, 'dark'), cy(w / 2, h * 0.2, 0, 0.03, 0.006, 'dark', { rz: Math.PI / 2 })];
const purifier = (w, d, h) => [rb(0, 0, 0, w, h, d, 'a', Math.min(w, d) * 0.22), ...Array.from({ length: 8 }, (_, i) => bx(0, h * 0.08 + i * h * 0.05, d / 2 + 0.0005, w * 0.6, 0.008, 0.002, 'a-')), { ...cy(0, h, 0, w * 0.74, 0.003, 'dark'), d: d * 0.74 }, { ...cy(0, h + 0.002, 0, w * 0.3, 0.003, 'a'), d: d * 0.3 }, disc(0, h * 0.82, d / 2, 0.012, 0.003, 'led')];
const towerFan = (w, d, h) => [{ ...cy(0, 0, 0, w, 0.03, 'a-'), d }, cy(0, 0.03, 0, w * 0.34, 0.05, 'a-'), cy(0, 0.08, 0, w * 0.46, h - 0.08, 'a'), bx(0, 0.14, w * 0.21, w * 0.22, h - 0.3, 0.02, 'dark'), cy(0, h, 0, w * 0.3, 0.003, 'dark')];
const miniSplit = (w, d, h) => [rb(0, h * 0.12, -d * 0.04, w, h * 0.88, d * 0.92, 'a', 0.045), bx(0, h * 0.14, d * 0.25, w - 0.08, 0.02, d * 0.4, 'dark'), bx(0, h * 0.2, d * 0.44, w - 0.06, 0.008, d * 0.14, 'a+', { rx: 0.5 }), bx(0, h * 0.94, -d * 0.1, w - 0.1, 0.004, d * 0.5, 'a-'), disc(w * 0.38, h * 0.42, d * 0.42, 0.01, 0.003, 'led')];
const roboVac = (w, d, h) => [{ ...cy(0, 0.012, 0, w, h * 0.7, 'a'), d }, { ...cy(0, 0.012 + h * 0.7, 0, w * 0.96, 0.003, 'a+'), d: d * 0.96 }, cy(0, h * 0.72, -d * 0.18, w * 0.28, h * 0.28, 'a-'), cy(0, h * 0.74, d * 0.26, 0.03, 0.003, 'led'), bx(0, 0.02, d / 2 - 0.006, w * 0.6, h * 0.4, 0.012, 'dark')];
const soundbar = (w, d, h) => [rb(0, 0, 0, w, h, d, 'a', Math.min(h, d) * 0.4), bx(0, h * 0.2, d / 2 + 0.0004, w * 0.9, h * 0.6, 0.001, 'a-'), disc(w * 0.4, h * 0.45, d / 2 + 0.001, 0.006, 0.002, 'led')];

export const OFFICE = [
  { id: 'desk_stand', name: 'Standing desk', cat: 'Office', w: 1.5, d: 0.75, h: 0.74, color: '#d2b48c', color2: '#f2f2f0', mat: 'wood', clear: 0.75, build: standDesk, sizes: [['48" × 24"', 1.22, 0.61], ['55" × 28"', 1.4, 0.7], ['60" × 30"', 1.52, 0.76], ['72" × 30"', 1.83, 0.76]] },
  { id: 'desk_slim', name: 'Minimal desk', cat: 'Office', w: 1.4, d: 0.65, h: 0.74, color: '#f1efea', color2: '#232427', mat: 'wood', clear: 0.75, build: sledDesk },
  { id: 'desk_l', name: 'L-shaped desk', cat: 'Office', w: 1.8, d: 1.5, h: 0.74, color: '#b89468', color2: '#232427', mat: 'wood', build: lDesk },
  { id: 'taskchair', name: 'Ergonomic chair', cat: 'Office', w: 0.66, d: 0.66, h: 1.25, color: '#34383e', color2: '#1b1c1f', mat: 'fabric', build: taskChair },
  { id: 'pedestal', name: 'Mobile pedestal', cat: 'Office', w: 0.4, d: 0.5, h: 0.58, color: '#f1efea', build: pedestal },
  { id: 'cubeshelf', name: 'Cube shelf', cat: 'Office', w: 0.78, d: 0.39, h: 1.48, color: '#f3f1ec', color2: '#b9a48c', mat: 'wood', clear: 0.6, build: cubeShelf, sizes: [['2 × 2', 0.78, 0.39], ['3 wide', 1.15, 0.39], ['4 wide', 1.52, 0.39]] },
  { id: 'shelving', name: 'Open shelving unit', cat: 'Office', w: 0.9, d: 0.34, h: 1.8, color: '#b08456', color2: '#232427', mat: 'wood', clear: 0.6, build: openShelving },
  { id: 'pctower', name: 'PC tower', cat: 'Office', w: 0.21, d: 0.44, h: 0.46, color: '#f1f1ef', build: pcTower },
  { id: 'bin', name: 'Waste bin', cat: 'Office', w: 0.26, d: 0.26, h: 0.3, color: '#2b2d31', build: bin },
  { id: 'chairmat', name: 'Chair mat', cat: 'Office', w: 1.2, d: 0.9, h: 0.004, color: '#dfe6ea', flat: true, build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'glass')] },
  { id: 'whiteboard', name: 'Whiteboard', cat: 'Office', w: 1.2, d: 0.06, h: 0.9, elev: 1.0, color: '#f6f5f2', mount: 'wall', build: whiteboard },
  { id: 'pegboard', name: 'Pegboard', cat: 'Office', w: 0.76, d: 0.12, h: 0.56, elev: 1.05, color: '#f3f1ec', color2: '#b08456', mount: 'wall', build: pegboard },
  { id: 'corkboard', name: 'Pin board', cat: 'Office', w: 0.9, d: 0.03, h: 0.6, elev: 1.15, color: '#c69c6d', color2: '#8a6a4c', mount: 'wall', build: corkboard },
  { id: 'acoustic', name: 'Acoustic panels', cat: 'Wall decor', w: 1.2, d: 0.035, h: 1.2, elev: 0.9, color: '#5d6b73', color2: '#c9b79c', mat: 'accent', mount: 'wall', build: acousticTiles },
  { id: 'hexpanels', name: 'Hexagon panels', cat: 'Wall decor', w: 1.5, d: 0.03, h: 0.95, elev: 1.0, color: '#56715a', color2: '#d9c9a5', mat: 'accent', mount: 'wall', build: hexTiles },
  { id: 'fluted', name: 'Fluted panel', cat: 'Wall decor', w: 1.2, d: 0.028, h: 2.4, elev: 0.02, color: '#b08456', mat: 'wood', mount: 'wall', build: fluted },
  { id: 'ledge', name: 'Picture ledge', cat: 'Wall decor', w: 0.9, d: 0.1, h: 0.36, elev: 1.2, color: '#f3f1ec', mount: 'wall', build: ledge },
  { id: 'shelf_bracket', name: 'Bracket shelf', cat: 'Wall decor', w: 1.0, d: 0.22, h: 0.18, elev: 1.25, color: '#b08456', color2: '#232427', mat: 'wood', mount: 'wall', build: bracketShelf },
  { id: 'lightbar', name: 'Wall light bar', cat: 'Wall decor', w: 0.9, d: 0.03, h: 0.03, elev: 1.9, color: '#fff1d0', mount: 'wall', build: (w, d, h) => [bx(0, 0, -d / 4, w, h, d / 2, 'dark'), rb(0, h * 0.1, d / 4, w - 0.01, h * 0.8, d / 2, 'led', 0.006)] },
];

export const DESK = [ // everything here rests on the furniture under it
  { id: 'monitor', name: 'Monitor 27"', cat: 'Desk setup', w: 0.615, d: 0.2, h: 0.47, color: '#1d1e21', build: monitor, sizes: [['24"', 0.54, 0.2], ['27"', 0.615, 0.2], ['32"', 0.72, 0.22]] },
  { id: 'monitor_uw', name: 'Ultrawide monitor', cat: 'Desk setup', w: 0.82, d: 0.22, h: 0.46, color: '#1d1e21', build: monitor },
  { id: 'monitor_arm', name: 'Monitor on arm', cat: 'Desk setup', w: 0.615, d: 0.3, h: 0.56, color: '#1d1e21', build: armMonitor },
  { id: 'riser', name: 'Monitor stand', cat: 'Desk setup', w: 0.55, d: 0.23, h: 0.1, color: '#b08456', color2: '#232427', mat: 'wood', surf: 1, build: riser },
  { id: 'deskshelf', name: 'Desk shelf', cat: 'Desk setup', w: 1.0, d: 0.22, h: 0.13, color: '#b08456', mat: 'wood', surf: 1, build: deskShelf },
  { id: 'laptop', name: 'Laptop', cat: 'Desk setup', w: 0.31, d: 0.28, h: 0.23, color: '#b9bcc2', build: laptop },
  { id: 'keyboard', name: 'Keyboard, compact', cat: 'Desk setup', w: 0.32, d: 0.11, h: 0.03, color: '#2b2d31', color2: '#e6e3dc', build: keyboard },
  { id: 'keyboard_full', name: 'Keyboard, full size', cat: 'Desk setup', w: 0.44, d: 0.13, h: 0.03, color: '#d9d6cf', color2: '#f3f1ec', build: keyboard },
  { id: 'mouse', name: 'Mouse', cat: 'Desk setup', w: 0.062, d: 0.11, h: 0.036, color: '#2b2d31', build: mouse },
  { id: 'deskmat', name: 'Desk mat', cat: 'Desk setup', w: 0.8, d: 0.35, h: 0.003, color: '#4a4d52', surf: 1, build: (w, d, h) => [rb(0, 0, 0, w, h, d, 'a', h * 0.45)] },
  { id: 'desklamp', name: 'Desk lamp', cat: 'Desk setup', w: 0.42, d: 0.14, h: 0.42, color: '#232427', build: deskLamp },
  { id: 'speaker', name: 'Desktop speaker', cat: 'Desk setup', w: 0.14, d: 0.17, h: 0.23, color: '#f1efea', color2: '#b9bdc3', build: speaker },
  { id: 'headphones', name: 'Headphones & stand', cat: 'Desk setup', w: 0.2, d: 0.11, h: 0.29, color: '#2b2d31', color2: '#b08456', build: headphones },
  { id: 'microphone', name: 'Microphone', cat: 'Desk setup', w: 0.12, d: 0.12, h: 0.28, color: '#2b2d31', color2: '#3a3d42', build: microphone },
  { id: 'printer', name: 'Printer', cat: 'Desk setup', w: 0.42, d: 0.34, h: 0.19, color: '#f1f1ef', surf: 1, build: printer },
  { id: 'mug', name: 'Mug', cat: 'Desk setup', w: 0.115, d: 0.082, h: 0.095, color: '#f1efea', build: mug },
  { id: 'pencup', name: 'Pen cup', cat: 'Desk setup', w: 0.08, d: 0.08, h: 0.16, color: '#b08456', build: penCup },
  { id: 'bookstack', name: 'Book stack', cat: 'Desk setup', w: 0.24, d: 0.17, h: 0.1, color: '#3f5f7a', surf: 1, build: bookStack },
  { id: 'notebook', name: 'Notebook & pen', cat: 'Desk setup', w: 0.2, d: 0.21, h: 0.014, color: '#2f3338', color2: '#d9734e', build: notebook },
  { id: 'photoframe', name: 'Photo frame', cat: 'Desk setup', w: 0.15, d: 0.08, h: 0.2, color: '#b08456', color2: '#8fa3a8', build: photoFrame },
  { id: 'succulent', name: 'Succulent', cat: 'Desk setup', w: 0.12, d: 0.12, h: 0.13, color: '#6fa37a', color2: '#e3ded4', build: succulent },
  { id: 'pothos', name: 'Trailing plant', cat: 'Desk setup', w: 0.3, d: 0.22, h: 0.26, color: '#4f8a4a', color2: '#e3ded4', build: pothos },
].map(def => ({ ...def, on: 1 }));

export const MORE = [
  { id: 'sofa_modern', name: 'Modern sofa', cat: 'Living', w: 2.2, d: 0.95, h: 0.76, color: '#c9c3b8', mat: 'fabric', build: modernSofa },
  { id: 'lounge', name: 'Lounge chair', cat: 'Living', w: 0.74, d: 0.8, h: 0.78, color: '#b3a48f', color2: '#8a6a4c', mat: 'fabric', build: lounge },
  { id: 'pedestal_table', name: 'Pedestal side table', cat: 'Living', w: 0.45, d: 0.45, h: 0.5, color: '#f1efea', build: pedestalTable },
  { id: 'slimlamp', name: 'Slim floor lamp', cat: 'Living', w: 0.26, d: 0.26, h: 1.5, color: '#f1efea', color2: '#232427', build: slimLamp },
  { id: 'soundbar', name: 'Soundbar', cat: 'Living', w: 0.95, d: 0.1, h: 0.065, color: '#2b2d31', on: 1, build: soundbar },
  { id: 'bed_platform', name: 'Platform bed', cat: 'Bedroom', w: 1.52, d: 2.03, h: 0.85, color: '#d8d3c8', color2: '#a47a4f', mat: 'bed', clear: 0.5, build: platformBed, sizes: [['Twin', 0.99, 1.91], ['Full', 1.37, 1.91], ['Queen', 1.52, 2.03], ['King', 1.93, 2.03]] },
  { id: 'fridge_slim', name: 'Fridge, flat-front', cat: 'Kitchen', w: 0.7, d: 0.7, h: 1.86, color: '#c9ccd1', clear: 0.9, build: slimFridge },
  { id: 'oven_tower', name: 'Double wall oven', cat: 'Kitchen', w: 0.76, d: 0.62, h: 2.2, color: '#f2f0ec', mat: 'cab', clear: 0.9, build: ovenTower },
  { id: 'cooktop', name: 'Induction cooktop', cat: 'Kitchen', w: 0.76, d: 0.52, h: 0.006, elev: 0.9, color: '#141416', on: 1, build: cooktop },
  { id: 'winefridge', name: 'Wine fridge', cat: 'Kitchen', w: 0.6, d: 0.6, h: 0.87, color: '#2b2d31', clear: 0.9, build: wineFridge },
  { id: 'espresso', name: 'Espresso machine', cat: 'Kitchen', w: 0.28, d: 0.4, h: 0.36, elev: 0.9, color: '#c9ccd1', on: 1, build: espresso },
  { id: 'kettle', name: 'Kettle', cat: 'Kitchen', w: 0.21, d: 0.15, h: 0.23, elev: 0.9, color: '#f1efea', on: 1, build: kettle },
  { id: 'toaster', name: 'Toaster', cat: 'Kitchen', w: 0.28, d: 0.17, h: 0.19, elev: 0.9, color: '#d9d4c8', on: 1, build: toaster },
  { id: 'purifier', name: 'Air purifier', cat: 'Utility', w: 0.26, d: 0.26, h: 0.58, color: '#f4f4f2', build: purifier },
  { id: 'towerfan', name: 'Tower fan', cat: 'Utility', w: 0.3, d: 0.3, h: 1.05, color: '#f4f4f2', build: towerFan },
  { id: 'minisplit', name: 'Mini-split AC', cat: 'Utility', w: 0.85, d: 0.21, h: 0.29, elev: 2.05, color: '#f6f5f2', mount: 'wall', build: miniSplit },
  { id: 'robovac', name: 'Robot vacuum', cat: 'Utility', w: 0.34, d: 0.34, h: 0.095, color: '#2b2d31', build: roboVac },
  { id: 'plant_snake', name: 'Snake plant', cat: 'Decor', w: 0.34, d: 0.34, h: 0.85, color: '#4f7a4a', color2: '#e3ded4', build: snakePlant },
  { id: 'plant_fiddle', name: 'Fiddle-leaf fig', cat: 'Decor', w: 0.75, d: 0.75, h: 1.7, color: '#3f7a45', color2: '#c9b79c', build: fiddleFig },
];

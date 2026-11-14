// Parametric furniture catalogue. Every piece is described as simple solids sized from (w, d, h),
// so one definition drives the 3D mesh, the 2D plan symbol and the catalogue thumbnail, and any
// piece can be resized freely. Local axes: x = width, y = up, z = depth (back of the piece is -z).
import { shade, rad } from './util.js';

import { bx, rb, cy, sp, disc, legs, stalk } from './parts.js';
import { OFFICE, DESK, MORE, standDesk } from './catalog-extra.js';

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
// Sofa with a chaise on the right (as you face it): square arms, tight back, two seat cushions plus the chaise cushion.
// Sizes follow the item, so the listed overall width / depth / height carry straight through; the chaise width and seat height can be overridden per item.
const sofaChaise = (w, d, h, it = {}) => {
  const cw = Math.min(it.chaiseW || 1.118, w * 0.5), sd = Math.min(d, it.seatD || 0.9), sh = it.seatH || 0.457, ah = Math.min(h, it.armH || 0.559), arm = 0.16, back = 0.2, base = 0.09;
  const z0 = -d / 2, cx = w / 2 - cw / 2, mw = w - cw - arm; // main seat runs from the left arm to the chaise
  const out = [...legs(w, sd, base, 0.045, 'dark').map(p => ({ ...p, z: p.z + z0 + sd / 2 })), bx(cx, 0, d / 2 - 0.08, 0.045, base, 0.045, 'dark'), bx(-w / 2 + 0.06, 0, z0 + sd - 0.08, 0.045, base, 0.045, 'dark'),
    bx(0, base, z0 + sd / 2, w, sh - base - 0.13, sd, 'a-'), bx(cx, base, z0 + sd + (d - sd) / 2, cw, sh - base - 0.13, d - sd, 'a-'),
    bx(0, base, z0 + back / 2, w, h - base, back, 'a'), bx(-w / 2 + arm / 2, base, z0 + sd / 2, arm, ah - base, sd, 'a'), bx(w / 2 - arm / 2, base, 0, arm, ah - base, d, 'a')];
  for (let i = 0; i < 2; i++) { const pw = mw / 2, px = -w / 2 + arm + pw * (i + 0.5);
    out.push(bx(px, sh - 0.13, z0 + back + (sd - back) / 2, pw - 0.015, 0.13, sd - back - 0.01, 'a+'), bx(px, sh, z0 + back + 0.06, pw - 0.03, h - sh - 0.06, 0.12, 'a')); }
  out.push(bx(cx - arm / 2, sh - 0.13, z0 + back + (d - back) / 2, cw - arm - 0.015, 0.13, d - back - 0.01, 'a+'), bx(cx - arm / 2, sh, z0 + back + 0.06, cw - arm - 0.03, h - sh - 0.06, 0.12, 'a'));
  return out;
};
// Corduroy L-shaped sectional: chaise / return on the right, low track arms, loose back pillows.
const lSectional = (w, d, h, it = {}) => {
  const rw = Math.min(it.chaiseW || 0.95, w * 0.5), sd = Math.min(d, it.seatD || 0.95), sh = it.seatH || 0.44, arm = 0.18, back = 0.2, base = 0.06, z0 = -d / 2, rx = w / 2 - rw / 2;
  const out = [bx(0, 0, z0 + sd / 2, w - 0.04, base, sd - 0.04, 'dark'), bx(rx, 0, z0 + sd + (d - sd) / 2, rw - 0.04, base, d - sd - 0.04, 'dark'),
    rb(0, base, z0 + sd / 2, w, sh - base - 0.14, sd, 'a-', 0.03), rb(rx, base, z0 + sd + (d - sd) / 2, rw, sh - base - 0.14, d - sd, 'a-', 0.03),
    rb(0, base, z0 + back / 2, w, h * 0.78 - base, back, 'a', 0.04), rb(-w / 2 + arm / 2, base, z0 + sd / 2, arm, sh + 0.12 - base, sd, 'a', 0.05), rb(w / 2 - arm / 2, base, 0, arm, sh + 0.12 - base, d, 'a', 0.05)];
  const n = 3, mw = w - arm * 2, pw = mw / n;
  for (let i = 0; i < n; i++) { const px = -w / 2 + arm + pw * (i + 0.5);
    out.push(rb(px, sh - 0.14, z0 + back + (sd - back) / 2, pw - 0.015, 0.14, sd - back - 0.01, 'a+', 0.04), rb(px, sh - 0.02, z0 + back + 0.08, pw - 0.04, h - sh + 0.02, 0.18, 'a+', 0.06)); }
  out.push(rb(rx - arm / 2, sh - 0.14, z0 + sd + (d - sd) / 2, rw - arm - 0.015, 0.14, d - sd - 0.01, 'a+', 0.04));
  return out;
};
// Rolling kitchen island: storage body on casters (cabinet door + three drawers) with a drop leaf on the seating side.
// The listed depth includes the raised leaf; untick "Leaf raised" to fold it down.
const islandCart = (w, d, h, it = {}) => {
  const bd = Math.min(d, 0.42), top = 0.025, cast = 0.075, zb = d / 2 - bd / 2, up = it.leafDown !== true, cw = w * 0.5, dx = w / 2 - (w - cw) / 2, dh = (h - top - cast - 0.04) / 3;
  const out = [...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cy(sx * (w / 2 - 0.05), 0, zb + sz * (bd / 2 - 0.05), 0.06, cast, 'dark')),
    bx(0, cast, zb, w, h - top - cast, bd, 'a'), bx(0, h - top, up ? 0 : zb, w, top, up ? d : bd, 'b'),
    bx(-w / 2 + cw / 2, cast + 0.03, d / 2 + 0.006, cw - 0.03, h - top - cast - 0.06, 0.016, 'a+'), bx(-w / 2 + cw - 0.06, cast + (h - cast) * 0.55, d / 2 + 0.018, 0.016, 0.12, 0.02, 'metal')];
  for (let i = 0; i < 3; i++) { const y = cast + 0.03 + i * dh; out.push(bx(dx, y, d / 2 + 0.006, w - cw - 0.03, dh - 0.015, 0.016, 'a+'), bx(dx, y + dh / 2 - 0.01, d / 2 + 0.018, 0.12, 0.015, 0.02, 'metal')); }
  if (up) out.push(bx(-w / 2 + 0.12, h - top - 0.12, -d / 2 + (d - bd) / 2 + 0.02, 0.03, 0.1, d - bd - 0.08, 'a-'), bx(w / 2 - 0.12, h - top - 0.12, -d / 2 + (d - bd) / 2 + 0.02, 0.03, 0.1, d - bd - 0.08, 'a-')); // leaf brackets
  else out.push(bx(0, h - top - (d - bd), zb - bd / 2 - top, w, d - bd, top, 'b')); // leaf hanging down the back
  return out;
};
// Low modular "cloud" sectional: corner + armless chair + corner along the back, ottoman in front of the right corner (Mirror moves it left).
// Module sizes are proportions of the listed overall size: corners 43.3" square, ottoman fills the rest of the depth.
const modularL = (w, d, h, it = {}) => {
  const cw = w * (43.31 / 123.62), aw = w - 2 * cw, md = d * (43.31 / 85.82), od = d - md, sh = it.seatH || 0.2, bk = 0.26, z0 = -d / 2, r = 0.07, g = 0.008;
  const seat = (x, z, mw, mdp) => rb(x, 0, z, mw - g, sh, mdp - g, 'a', r);
  const out = [seat(-w / 2 + cw / 2, z0 + md / 2, cw, md), seat(0, z0 + md / 2, aw, md), seat(w / 2 - cw / 2, z0 + md / 2, cw, md), seat(w / 2 - cw / 2, z0 + md + od / 2, cw, od)];
  // backs: along the back of all three seats, plus the outer side of each corner acting as the arm
  out.push(rb(-w / 2 + cw / 2, sh - 0.02, z0 + bk / 2, cw - g, h - sh + 0.02, bk, 'a+', 0.1), rb(0, sh - 0.02, z0 + bk / 2, aw - g, h - sh + 0.02, bk, 'a+', 0.1), rb(w / 2 - cw / 2, sh - 0.02, z0 + bk / 2, cw - g, h - sh + 0.02, bk, 'a+', 0.1),
    rb(-w / 2 + bk / 2, sh - 0.02, z0 + bk + (md - bk) / 2, bk, (h - sh) * 0.62, md - bk - g, 'a+', 0.1), rb(w / 2 - bk / 2, sh - 0.02, z0 + bk + (md - bk) / 2, bk, (h - sh) * 0.62, md - bk - g, 'a+', 0.1));
  return out;
};
// Upholstered lift-up storage bed: 12" platform, wingback headboard with three horizontal channels; optional queen mattress.
const wingBed = (w, d, h, it = {}) => {
  const fh = 0.305, hbT = 0.09, wing = 0.1, z0 = -d / 2, ch = Math.min(0.61, h - fh), out = [
    rb(0, 0, z0 + hbT + (d - hbT) / 2, w - 0.01, fh, d - hbT, 'a', 0.025), bx(0, fh - 0.01, z0 + hbT + (d - hbT) / 2, w - 0.08, 0.012, d - hbT - 0.08, 'a-'),
    rb(0, 0, z0 + hbT / 2, w - 2 * wing + 0.02, h - 0.01, hbT, 'a', 0.02),
    rb(-w / 2 + wing / 2, 0, z0 + 0.12, wing, h, 0.24, 'a', 0.045), rb(w / 2 - wing / 2, 0, z0 + 0.12, wing, h, 0.24, 'a', 0.045)];
  for (let i = 0; i < 3; i++) out.push(rb(0, h - ch + (ch / 3) * i + 0.006, z0 + hbT + 0.012, w - 2 * wing - 0.02, ch / 3 - 0.012, 0.035, 'a+', 0.016));
  if (!it.noMattress) out.push(rb(0, fh, z0 + hbT + 0.04 + 1.016, Math.min(1.524, w - 0.04), 0.254, Math.min(2.032, d - hbT - 0.06), 'white', 0.05));
  return out;
};
// Fluted nightstand: rounded top, open shelf, two fluted drawers with gold bar pulls, plinth.
const flutedStand = (w, d, h) => {
  const t = 0.022, pl = 0.06, dh = (h - pl - 0.2) / 2, out = [bx(0, 0, -0.01, w - 0.03, pl, d - 0.04, 'a-'),
    rb(-w / 2 + t / 2 + 0.01, 0, 0, t + 0.02, h - 0.04, d, 'a', 0.01), rb(w / 2 - t / 2 - 0.01, 0, 0, t + 0.02, h - 0.04, d, 'a', 0.01), rb(0, h - 0.06, 0, w, 0.06, d, 'a', 0.028),
    bx(0, pl, -d / 2 + 0.01, w - 0.04, h - pl - 0.05, 0.012, 'a-'), bx(0, pl + 2 * dh + 0.005, 0.005, w - 0.06, 0.018, d - 0.03, 'a')];
  for (let k = 0; k < 2; k++) {
    const y = pl + 0.004 + k * dh, n = Math.round((w - 0.08) / 0.016), fw = (w - 0.08) / n;
    out.push(bx(0, y, d / 2 - 0.02, w - 0.07, dh - 0.008, 0.02, 'a-'));
    for (let i = 0; i < n; i++) out.push(cy(-w / 2 + 0.04 + fw * (i + 0.5), y + 0.004, d / 2 - 0.004, fw * 0.95, dh - 0.016, 'a'));
    out.push(bx(0, y + dh - 0.04, d / 2 + 0.012, Math.min(0.1, w * 0.25), 0.012, 0.016, '#c9a54a'));
  }
  out.push(bx(-w / 2 + 0.04, h - 0.062, -d / 2 + 0.06, 0.07, 0.004, 0.07, 'dark')); // charging pad
  return out;
};
// Fluted dresser: rounded top and sides, cols × rows fluted drawers with gold bar pulls along their top edge, 3.94" plinth.
const flutedDresser = (cols, rows) => (w, d, h) => {
  const pl = 0.1, t = 0.03, cw = (w - 2 * t - 0.01) / cols, rh = (h - pl - 0.06) / rows, out = [bx(0, 0, -0.01, w - 2 * t, pl, d - 0.04, 'a-'),
    rb(-w / 2 + t / 2, 0, 0, t, h - 0.04, d, 'a', 0.012), rb(w / 2 - t / 2, 0, 0, t, h - 0.04, d, 'a', 0.012), rb(0, h - 0.06, 0, w, 0.06, d, 'a', 0.03),
    bx(0, pl, -0.01, w - 2 * t, h - pl - 0.06, d - 0.04, 'a-')];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = -w / 2 + t + 0.005 + cw * (c + 0.5), y = pl + r * rh + 0.003, n = Math.max(4, Math.round((cw - 0.02) / 0.02)), fw = (cw - 0.02) / n;
    out.push(bx(x, y, d / 2 - 0.022, cw - 0.008, rh - 0.006, 0.02, 'a-'));
    for (let i = 0; i < n; i++) out.push(cy(x - (cw - 0.02) / 2 + fw * (i + 0.5), y + 0.004, d / 2 - 0.006, fw * 0.95, rh - 0.014, 'a'));
    out.push(bx(x, y + rh - 0.035, d / 2 + 0.01, Math.min(0.14, cw * 0.3), 0.012, 0.016, '#c9a54a'));
  }
  return out;
};
// Desk with a two-tone top (wood ends, black centre panel) on black U-frame legs.
const uFrameDesk = (w, d, h) => {
  const tt = 0.025, lg = 0.05, top = h - tt, out = [bx(-w / 2 + w / 8, top, 0, w / 4, tt, d, 'a'), bx(w / 2 - w / 8, top, 0, w / 4, tt, d, 'a'), bx(0, top, 0, w / 2, tt, d, '#1d1d1f')];
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.06);
    out.push(bx(x, 0, -d / 2 + 0.05, lg, top, lg, 'b'), bx(x, 0, d / 2 - 0.05, lg, top, lg, 'b'), bx(x, 0.06, 0, lg, 0.04, d - 0.1, 'b'), bx(x, top - 0.05, 0, lg * 0.8, 0.05, d - 0.1, 'b'));
  }
  out.push(bx(0, top - 0.05, -d / 2 + 0.05, w - 0.12, 0.05, 0.02, 'b'));
  return out;
};
// Low TV stand: two doors either side of open media shelves, short legs.
const mediaStand = (w, d, h) => {
  const lg = 0.06, cw = w * 0.3, out = [...legs(w, d, lg, 0.04, 'a-'), bx(0, lg, 0, w, h - lg, d - 0.01, 'a'), bx(0, h - 0.02, 0, w + 0.01, 0.02, d, 'a+'),
    bx(0, lg + 0.02, d / 2 - 0.02, w - 2 * cw - 0.02, h - lg - 0.05, 0.02, 'dark'), bx(0, lg + (h - lg) / 2, d / 2 - 0.01, w - 2 * cw - 0.03, 0.015, 0.02, 'a')];
  for (const sx of [-1, 1]) out.push(bx(sx * (w / 2 - cw / 2), lg + 0.015, d / 2 - 0.004, cw - 0.025, h - lg - 0.045, 0.012, 'b'), bx(sx * (w / 2 - cw + 0.04), lg + (h - lg) / 2 - 0.04, d / 2 + 0.008, 0.012, 0.08, 0.015, 'metal'));
  return out;
};
// Arc floor lamp: weighted base at one end, upright pole (wood lower section), arc reaching over to a dome shade at the other end.
const arcLamp = (w, d, h) => {
  const bxp = -w / 2 + d / 2, ph = h * 0.62, R = Math.min(w - d / 2 - 0.15, h - ph - 0.12), n = 14, out = [cy(bxp, 0, 0, d * 0.85, 0.05, 'b'), cy(bxp, 0.05, 0, 0.035, ph * 0.45, 'a'), cy(bxp, 0.05 + ph * 0.45, 0, 0.025, ph * 0.55 - 0.05, 'b')];
  for (let i = 0; i < n; i++) { // quarter-ish arc from the pole top over to the shade
    const a0 = (i / n) * Math.PI * 0.62, a1 = ((i + 1) / n) * Math.PI * 0.62, x0 = bxp + R - R * Math.cos(a0), y0 = ph + R * Math.sin(a0) * 0.9, x1 = bxp + R - R * Math.cos(a1), y1 = ph + R * Math.sin(a1) * 0.9;
    out.push(stalk(x0, y0, 0, 0.022, Math.hypot(x1 - x0, y1 - y0) + 0.004, 'b', Math.atan2(-(x1 - x0), y1 - y0)));
  }
  const sx = bxp + R - R * Math.cos(Math.PI * 0.62), sy = ph + R * Math.sin(Math.PI * 0.62) * 0.9;
  out.push(stalk(sx, sy - 0.12, 0, 0.02, 0.12, 'b'), cy(sx, sy - 0.32, 0, Math.min(d, 0.4), 0.22, 'b', { t: 0.35 }), cy(sx, sy - 0.33, 0, Math.min(d, 0.4) * 0.9, 0.01, 'led'));
  return out;
};
// Three framed canvases hung side by side (each w/3 minus gaps): black wood frames, dark canvas with a gold ring.
const triptych = (w, d, h) => {
  const gap = 0.05, pw = (w - 2 * gap) / 3, out = [];
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + pw / 2 + i * (pw + gap), f = 0.025;
    out.push(bx(x, 0, 0, pw, h, d, 'b'), bx(x, f, d / 2 - 0.004, pw - 2 * f, h - 2 * f, 0.008, 'a'));
    const r = Math.min(pw, h) * (0.62 - i * 0.08);
    out.push(disc(x + (i - 1) * pw * 0.06, h * (0.45 + i * 0.05) - r / 2, d / 2 + 0.004, r, 0.004, '#c9a54a'), disc(x + (i - 1) * pw * 0.06, h * (0.45 + i * 0.05) - r / 2 + r * 0.04, d / 2 + 0.006, r * 0.92, 0.004, 'a'));
  }
  return out;
};
// Leaning ladder bookshelf: two black rails leaning back to the wall, five walnut shelves that get shallower towards the top.
const ladderShelf = (w, d, h) => {
  const zf = d / 2 - 0.03, zb = -d / 2 + 0.02, lean = Math.atan2(zf - zb, h), len = Math.hypot(zf - zb, h), out = [];
  for (const s of [-1, 1]) out.push(stalk(s * (w / 2 - 0.015), 0, zf - (zf - zb) / 2 * 0 , 0.03, len, 'b', 0, -lean));
  for (let i = 0; i < 5; i++) {
    const y = 0.06 + i * (h - 0.12) / 4, zr = zf - (zf - zb) * (y / h), sd = Math.max(0.12, zr - zb + 0.02);
    out.push(bx(0, y, zb + sd / 2 - 0.01, w - 0.04, 0.022, sd, 'a'), bx(0, y - 0.015, zb + sd / 2 - 0.01, w - 0.04, 0.015, 0.02, 'b'));
  }
  return out;
};
// Futon: low frame on short legs, seat and split back cushions; `it.bed` lays it flat (the item depth becomes the sleeping depth).
const futon = arms => (w, d, h, it = {}) => {
  const lh = 0.09, arm = arms ? 0.15 : 0, iw = w - 2 * arm, out = [...legs(w, Math.min(d, 0.86), lh, 0.045, 'b').map(p => ({ ...p, z: p.z + (it.bed ? 0 : 0) }))];
  if (arms) for (const s of [-1, 1]) out.push(rb(s * (w / 2 - arm / 2), lh, 0, arm, 0.48, d, 'a', 0.04));
  if (it.bed) { out.push(bx(0, lh, 0, iw, 0.08, d - 0.02, 'a-'), rb(0, lh + 0.08, 0, iw - 0.01, 0.16, d - 0.03, 'a', 0.04)); for (const z of [-d / 6, d / 6]) out.push(bx(0, lh + 0.235, z, iw - 0.06, 0.01, 0.012, 'a-')); return out; }
  const sd = Math.min(d - 0.22, 0.62), sh = 0.41;
  out.push(bx(0, lh, 0, iw, 0.1, d - 0.04, 'a-'), rb(0, lh + 0.1, d / 2 - sd / 2 - 0.02, iw - 0.01, sh - lh - 0.1, sd, 'a', 0.04));
  for (const s of [-1, 1]) out.push({ ...rb(s * (iw / 4), sh - 0.05, -d / 2 + 0.17, iw / 2 - 0.015, h - sh + 0.02, 0.16, 'a+', 0.04), rx: -0.18 });
  return out;
};
// Sofa / console table: narrow top on a black metal frame with a bottom stretcher; `it.shelf` adds a lower shelf.
const consoleTable = (w, d, h, it = {}) => {
  const t = 0.03, f = 0.025, out = [bx(0, h - t, 0, w, t, d, 'a')];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(bx(sx * (w / 2 - 0.04), 0, sz * (d / 2 - f / 2 - 0.005), f, h - t, f, 'b'));
  for (const sx of [-1, 1]) out.push(bx(sx * (w / 2 - 0.04), 0.06, 0, f, f, d - 0.02, 'b'), bx(sx * (w / 2 - 0.04), h - t - f, 0, f, f, d - 0.02, 'b'));
  out.push(bx(0, h - t - f, -d / 2 + f / 2 + 0.005, w - 0.1, f, f, 'b'), bx(0, h - t - f, d / 2 - f / 2 - 0.005, w - 0.1, f, f, 'b'));
  if (it.shelf) out.push(bx(0, 0.1, 0, w - 0.1, 0.022, d - 0.03, 'a')); else out.push(bx(0, 0.06, 0, w - 0.1, f, f, 'b'));
  return out;
};
// Powered PA speaker: trapezoid cabinet, black grille with woofer and horn, top handle, pole socket underneath.
const paSpeaker = (w, d, h) => [bx(0, 0, d * 0.12, w, h, d * 0.76, 'a'), bx(0, h * 0.04, -d * 0.3, w * 0.72, h * 0.92, d * 0.4, 'a'), bx(0, h * 0.03, d / 2 - 0.006, w - 0.02, h * 0.94, 0.012, 'b'),
  disc(0, h * 0.06, d / 2 + 0.002, w * 0.8, 0.006, 'black'), disc(0, h * 0.17, d / 2 + 0.004, w * 0.3, 0.006, 'b'), bx(0, h * 0.7, d / 2 + 0.002, w * 0.62, h * 0.2, 0.01, 'black'),
  bx(0, h * 0.93, d / 2 + 0.006, w * 0.2, 0.025, 0.004, 'metal'), bx(0, h - 0.005, 0, w * 0.4, 0.03, 0.05, 'black'), cy(0, -0.001, 0, 0.05, 0.002, 'black')];
// Tripod speaker stand: three splayed legs, telescoping pole, top adapter. The top (item height) is where a speaker rests.
const tripod = (w, d, h) => {
  const hy = Math.min(0.75, h * 0.42), r = Math.min(w, d) / 2 - 0.02, out = [cy(0, hy - 0.08, 0, 0.06, 0.12, 'a'), cy(0, hy, 0, 0.038, h - hy - 0.05, 'a'), cy(0, h - 0.05, 0, 0.035, 0.05, 'metal')];
  for (let i = 0; i < 3; i++) { const a = (i * 2 * Math.PI) / 3 + Math.PI / 2, x = Math.cos(a) * r, z = Math.sin(a) * r, len = Math.hypot(r, hy);
    out.push(stalk(x, 0, z, 0.028, len, 'a', -Math.atan2(-x, hy), Math.atan2(-z, hy)), stalk(x * 0.45, hy * 0.55, z * 0.45, 0.015, Math.hypot(r * 0.45, hy * 0.4), 'a', -Math.atan2(-x * 0.45, hy * 0.4), Math.atan2(-z * 0.45, hy * 0.4))); }
  return out;
};
const vase = (w, d, h) => [{ ...cy(0, 0, 0, w, h * 0.72, 'a', { t: 0.72 }), d }, { ...cy(0, h * 0.72, 0, w * 0.72, h * 0.18, 'a', { t: 0.62 }), d: d * 0.72 }, { ...cy(0, h * 0.9, 0, w * 0.45, h * 0.1, 'a+', { t: 1.15 }), d: d * 0.45 }];
const tray = (w, d, h) => [bx(0, 0, 0, w, 0.008, d, 'a'), bx(0, 0, -d / 2 + 0.005, w, h, 0.01, 'a'), bx(0, 0, d / 2 - 0.005, w, h * 0.55, 0.01, 'a'), bx(-w / 2 + 0.005, 0, 0, 0.01, h, d, 'a'), bx(w / 2 - 0.005, 0, 0, 0.01, h, d, 'a')];
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
const cabinetDoors = (w, d, y0, y1, c = 'a+', slab = false) => { const n = Math.max(1, Math.round(w / 0.48)), cw = w / n, out = [];
  for (let i = 0; i < n; i++) { const x = -w / 2 + cw * (i + 0.5); const dw = cw - 0.012, dh = y1 - y0, r = Math.min(0.06, dw * 0.2), z = d / 2 - 0.003; // shaker door: slab + raised frame
    if (slab) { out.push(bx(x, y0, d / 2 - 0.02, dw, dh, 0.02, c), bx(x, y0 + (y1 - y0 > 0.5 && y0 > 0.5 ? 0.04 : dh - 0.05), d / 2 + 0.008, Math.min(0.16, dw * 0.45), 0.012, 0.02, 'metal')); continue; } // flat-panel door with a bar pull
    out.push(bx(x, y0, d / 2 - 0.02, dw, dh, 0.02, c), bx(x - dw / 2 + r / 2, y0, z, r, dh, 0.008, c), bx(x + dw / 2 - r / 2, y0, z, r, dh, 0.008, c), bx(x, y0, z, dw - 2 * r, r, 0.008, c), bx(x, y1 - r, z, dw - 2 * r, r, 0.008, c),
      bx(x + (i % 2 ? -1 : 1) * (dw / 2 - r / 2), (y0 + y1) / 2 - 0.06, d / 2 + 0.008, 0.014, 0.12, 0.022, 'metal')); }
  return out; };
const baseCab = (w, d, h, it) => [bx(0, 0, -0.04, w, 0.1, d - 0.1, 'dark'), bx(0, 0.1, -0.02, w, h - 0.14, d - 0.04, 'a'), ...cabinetDoors(w, d - 0.02, 0.11, h - 0.05, 'a+', it?.slab), bx(0, h - 0.04, 0, w, 0.04, d, 'b')];
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

const IN = 0.0254;
const DEFS = [
  // ---------- My picks: real products, sized from the retailer's listing ----------
  { id: 'asyiah', name: 'Wade Logan Asyiah 114.5" sofa & chaise', cat: 'My picks', w: 114.5 * IN, d: 67 * IN, h: 31 * IN, color: '#5f6b4e', mat: 'fabric', hand: 'right', build: sofaChaise,
    url: 'https://www.wayfair.com/furniture/pdp/wade-logan-asyiah-1145-wide-microfiber-sofa-chaise-w011334397.html?piid=1570405339%2C1586255537',
    colors: [['Green corduroy', '#5f6b4e']],
    note: 'Listed size: 114.5" W × 67" D × 31" H; chaise 44" W; seat 18" high; arms 22" high. Comes right- or left-hand facing: switch it under Chaise side.' },
  { id: 'rebrilliant_l', name: 'Rebrilliant corduroy L-shaped sectional', cat: 'My picks', w: 111 * IN, d: 67 * IN, h: 32 * IN, color: '#cbb89a', mat: 'fabric', hand: 'right', build: lSectional,
    url: 'https://www.wayfair.com/furniture/pdp/rebrilliant-corduroy-l-shaped-sectional-w123144379.html?piid=572712133%2C572712135',
    colors: [],
    note: 'Size and colour not yet confirmed: Wayfair blocks automated reading of this listing. Type the exact width, depth and height from its Specifications tab above.' },
  { id: 'zone_sectional', name: 'Living Spaces Zone 4-piece modular sectional', cat: 'My picks', w: 123.62 * IN, d: 85.82 * IN, h: 36.22 * IN, color: '#ece4d4', mat: 'fabric', hand: 'right', build: modularL,
    url: 'https://www.livingspaces.com/pdp-zone-cream-4-piece-modular-sectional-with-2-corners-1-armless-chair-ottoman-320081',
    colors: [['Cream (SKU 320081)', '#ece4d4'], ['Green (SKU 357981)', '#7f8a6a'], ['Blue (SKU 319543)', '#7d91a6']],
    note: 'Listed size: 123.62" W × 85.82" D × 36.22" H; seat 7.87" high; 18" interior back. Two 43.3" corners + armless chair along the back, ottoman in front of one corner (switch sides under Chaise side). Swatch colours are approximate.' },
  { id: 'allewie_bed', name: 'Allewie queen lift-up storage bed', cat: 'My picks', w: 63 * IN, d: 84.25 * IN, h: 44.5 * IN, color: '#f1efe9', mat: 'bed', build: wingBed,
    url: 'https://a.co/d/004ln3E1',
    colors: [['White', '#f1efe9'], ['Grey', '#9d9a95'], ['Beige', '#e6dcc6']],
    note: 'Listed size: 84.25" L × 63" W × 44.5" H; 12" platform, 24" channel headboard above it, 10.8" underbed storage, fits a 60" × 80" queen mattress. Untick "Show mattress" for the bare frame. Swatch colours are approximate.' },
  { id: 'decofy_nightstand', name: 'Decofy fluted nightstand', cat: 'My picks', w: 19.6 * IN, d: 15.5 * IN, h: 24 * IN, color: '#d2b07a', build: flutedStand,
    url: 'https://a.co/d/0i5KghFd',
    colors: [['Oak', '#d2b07a']],
    note: 'Listed size: 19.6" W × 15.5" D × 24" H (sold as a set of 2: place one each side of the bed). Open shelf, two fluted drawers, charging station.' },
  { id: 'decofy_dresser', name: 'Decofy 47" fluted 6-drawer dresser', cat: 'My picks', w: 47.2 * IN, d: 15.8 * IN, h: 31.5 * IN, color: '#d2b07a', build: flutedDresser(2, 3),
    colors: [['Natural oak', '#d2b07a']],
    note: 'Listed size: 47.2" W × 15.8" D × 31.5" H (diagram: 31.6"); six fluted drawers in two columns with gold handles, 3.94" plinth. Drawers 21.8" × 13.8" × 5.8" inside. Matches the Decofy fluted nightstand.' },
  { id: 'tribesigns_desk', name: 'Tribesigns 63" computer desk', cat: 'My picks', w: 63 * IN, d: 31.5 * IN, h: 29.53 * IN, color: '#7a4e2d', color2: '#1b1b1d', build: uFrameDesk,
    colors: [['Rustic brown / black', '#7a4e2d']],
    note: 'Listed size: 63" × 31.5" × 29.53" H; two-tone top (15.75" wood ends, 31.5" black centre), 1.97" square black metal legs.' },
  { id: 'amazon_standdesk', name: 'Amazon Basics electric standing desk 47"', cat: 'My picks', w: 47.3 * IN, d: 24 * IN, h: 28.4 * IN, color: '#6e4a33', color2: '#1c1c1e', mat: 'wood', clear: 0.75, build: standDesk,
    colors: [['Black / Walnut effect', '#6e4a33']], heights: [['Sitting · 28.4"', 28.4 * IN], ['Standing · 46.2"', 46.2 * IN]],
    note: 'Listed size: 47.3" W × 24" D; adjusts from 28.4" to 46.2" high (memory buttons, electronic display). Use the height buttons below or type any height in that range.' },
  { id: 'dorian_tv', name: 'Meyer Cross Dorian 58" TV stand', cat: 'My picks', w: 58 * IN, d: 15.75 * IN, h: 16 * IN, color: '#f3f1ec', color2: '#c99d6e', build: mediaStand,
    url: 'https://www.homedepot.com/pep/Meyer-Cross-Dorian-58-in-Alder-White-TV-Stand-Fits-TV-s-up-to-65-in-TV2306/333200763',
    colors: [['Alder White', '#f3f1ec']],
    note: 'Listed size: 58" W × 15.75" D × 16" H, for TVs up to 65". Door and shelf layout is approximate: Home Depot could not be read from here.' },
  // ---------- Office ideas: real products to try out (sizes from the retailers' listings) ----------
  { id: 'oi_slat_walnut', like: 'wallpanel', name: 'Acoustic wood slat panel 24" × 94.5" (set of 2)', cat: 'Office ideas', w: 24 * IN, d: 0.875 * IN, h: 94.5 * IN, elev: 0.01, color: '#b88f73',
    url: 'https://www.walmart.com/ip/15380871814', colors: [['American walnut', '#b88f73'], ['Oak', '#ffffff'], ['Teak', '#e2bb93']],
    note: '24" × 94.5" × 7/8" per panel on black acoustic felt; sold as 2 panels (31 sq ft). Duplicate it to cover a whole wall. Oak and teak are separate listings.' },
  { id: 'oi_hex_light', like: 'hexpanels', name: 'Nanoleaf Shapes hexagon light panels (9-pack)', cat: 'Office ideas', w: 36 * IN, d: 0.4 * IN, h: 24 * IN, elev: 1.2, color: '#1d1d1f', color2: '#ffb36b',
    url: 'https://www.currys.co.uk/products/nanoleaf-shapes-hexagon-smart-lights-starter-kit-ultra-black-pack-of-9-10258070.html', colors: [['Ultra Black', '#1d1d1f'], ['White', '#f2f2f0']],
    note: 'Each hexagon is 9" × 7.75", 0.4" thick when mounted; nine panels, colour-changing. The overall size here is one possible layout. Link is a UK listing; the same kit is sold by Best Buy and Amazon in the US.' },
  { id: 'oi_triptych', like: 'art', name: 'IDEA4WALL dark wood rings framed canvas set (3 × 24" × 36")', cat: 'Office ideas', w: 76 * IN, d: 1.5 * IN, h: 36 * IN, elev: 1.0, color: '#3b2f27', color2: '#141416', build: triptych,
    url: 'https://www.walmart.com/ip/IDEA4WALL-Framed-Canvas-Print-Wall-Art-Set-Gold-Black-Dark-Wood-Rings-Landscape-Abstract-Modern-Minimalist-Chic-Relax-Calm-Living-Room-Bedroom-Office/5311087156',
    colors: [['Gold & black dark wood rings', '#3b2f27']], note: 'Three 24" × 36" framed canvases in black frames; shown with 2" between them. Artwork in the model is a stand-in for the print.' },
  { id: 'oi_float_shelf', like: 'shelf', name: 'Latitude Run 36" floating shelves, walnut (set of 2)', cat: 'Office ideas', w: 36 * IN, d: 8 * IN, h: 1.6 * IN, elev: 1.45, color: '#6b4a35',
    url: 'https://www.wayfair.com/storage-organization/pdp/latitude-run-2-piece-pine-floating-shelf-w112939997.html', colors: [['Walnut', '#6b4a35']],
    note: '36" W × 8" D × 1.6" H, hidden brackets; set of 2 (duplicate for the second shelf).' },
  { id: 'oi_bracket_shelf', like: 'shelf_bracket', name: 'Del Hutson 36" dark walnut shelves with black brackets (set of 2)', cat: 'Office ideas', w: 36 * IN, d: 7 * IN, h: 5.5 * IN, elev: 1.3, color: '#5a3b28', color2: '#1b1b1d',
    url: 'https://www.homedepot.com/p/Del-Hutson-Designs-Industrial-Grace-Simple-5-5in-x-36in-x-7in-Dark-Walnut-Pine-Wood-Set-of-2-Floating-Decorative-Wall-Shelves-with-Brackets-DHD3112dw/310698160',
    colors: [['Dark walnut', '#5a3b28']], note: '36" W × 7" D × 5.5" H including the black industrial brackets; set of 2.' },
  { id: 'oi_ladder', name: 'Nathan James Theo 5-shelf ladder bookshelf', cat: 'Office ideas', w: 23.6 * IN, d: 11.7 * IN, h: 72.5 * IN, color: '#6b4a35', color2: '#1b1b1d', mat: 'wood', build: ladderShelf,
    url: 'https://nathanjames.com/products/5-shelf-ladder-bookshelf-walnut-matte-black', colors: [['Walnut / matte black', '#6b4a35']],
    note: '23.6" W × 11.7" D × 72.5" H; leans against the wall and screws to it. Push it flush to a wall.' },
  { id: 'oi_arc_lamp', name: 'Adesso Ethan arc floor lamp (black / walnut)', cat: 'Office ideas', w: 56 * IN, d: 17 * IN, h: 76.5 * IN, color: '#6b4a35', color2: '#1b1b1d', build: arcLamp,
    url: 'https://dulleselectric.com/products/ades_5049-15', colors: [['Black / walnut', '#6b4a35']],
    note: '76.5" H with a 56" reach and 17" shade. The base sits at the left end; rotate it so the shade hangs over the desk or chair.' },
  { id: 'oi_sconce', like: 'sconce', name: 'Crate & Barrel Weston walnut wall sconce', cat: 'Office ideas', w: 5 * IN, d: 8.8 * IN, h: 9.7 * IN, elev: 1.55, color: '#26262a', color2: '#6b4a35',
    url: 'https://crateandbarrel.ca/weston-black-mid-century-modern-wall-sconce-light/s260343', colors: [['Walnut / blackened steel', '#26262a']],
    note: '9.7" H × 5" W × 8.8" D. Hard-wired; a plug-in alternative is the Globe Electric Tristan (matte black, faux walnut) at Home Depot.' },
  { id: 'oi_rug', like: 'rug', name: 'Mohawk Home Rowland charcoal rug 5 × 8', cat: 'Office ideas', w: 60 * IN, d: 96 * IN, h: 0.41 * IN, color: '#3a3b3e',
    url: 'https://www.homedepot.com/p/Mohawk-Home-Rowland-Charcoal-5-ft-x-8-ft-Abstract-Area-Rug-041715/309244700', colors: [['Charcoal', '#3a3b3e']],
    note: '5 ft × 8 ft, 0.41" pile: low enough for a rolling desk chair.' },
  { id: 'oi_riser', like: 'riser', name: 'Room & Board wood monitor riser', cat: 'Office ideas', w: 22 * IN, d: 10 * IN, h: 3 * IN, color: '#6b4a35', color2: '#6b4a35',
    url: 'https://www.roomandboard.com/catalog/office/desktop-organizers/monitor-riser-shelf-in-wood', colors: [['Walnut', '#6b4a35']],
    note: '22" W × 10" D × 3" H. Place it on a desk; a monitor placed on top sits on it.' },
  { id: 'oi_fiddle', like: 'plant_fiddle', name: 'Faux fiddle-leaf fig 6 ft in black pot', cat: 'Office ideas', w: 26 * IN, d: 26 * IN, h: 72 * IN, color: '#3f7a45', color2: '#1d1d1f',
    url: 'https://www.christmascentral.com/potted-artificial-fiddle-leaf-fig-tree-in-black-pot-6', colors: [['Green / black pot', '#3f7a45']], note: '6 ft H × 26" W × 26" D including the black pot.' },
  { id: 'oi_snake', like: 'plant_snake', name: 'Faux snake plant 34" in black pot', cat: 'Office ideas', w: 12 * IN, d: 12 * IN, h: 34 * IN, color: '#4f7a4a', color2: '#1d1d1f',
    url: 'https://www.overstock.com/Home-Garden/Sansevieria-Snake-Plant-in-Black-Pot/35179990/product.html', colors: [['Green / black pot', '#4f7a4a']], note: '34" H × 12" W × 12" D with black pot.' },
  { id: 'oi_olive', like: 'plant', name: 'Faux olive topiary 5 ft in black pot', cat: 'Office ideas', w: 15 * IN, d: 15 * IN, h: 60 * IN, color: '#7d8a5a', color2: '#1d1d1f',
    url: 'https://www.christmascentral.com/5-olive-topiary-artificial-potted-tree/', colors: [['Olive / black pot', '#7d8a5a']], note: '5 ft H × 15" W × 15" D in a black pot.' },
  // ---------- Snake plants in several sizes (pick a pot style under Pot) ----------
  { id: 'sp_mini', like: 'plant_snake', name: 'Threshold mini tabletop snake plant 4.5"', cat: 'Plants', w: 4.5 * IN, d: 5 * IN, h: 4.5 * IN, color: '#4f7a4a', color2: '#f2f0eb', on: 1,
    url: 'https://www.target.com/p/4-5-34-mini-tabletop-snake-artificial-plant-threshold-8482/-/A-87993605', note: '4.5" H × 4.5" W × 5" D in a small ceramic pot: desk or shelf size.' },
  { id: 'sp_12', like: 'plant_snake', name: 'Flora Bunda snake plant 12.5" (white dimple pot on wood stand)', cat: 'Plants', w: 5.5 * IN, d: 5.5 * IN, h: 12.5 * IN, color: '#4f7a4a', color2: '#f2f0eb', on: 1,
    url: 'https://www.homedepot.com/p/Flora-Bunda-12-5-in-Artificial-Faux-Snake-Plant-in-White-Dimple-Pattern-Ceramic-Pot-on-Wood-Stand-CS3819E-MTWH/313454507', note: '12.5" tall; pot about 5.5" across.' },
  { id: 'sp_17', like: 'plant_snake', name: 'Crate & Barrel faux snake plant in pot 17.5"', cat: 'Plants', w: 10.5 * IN, d: 10.5 * IN, h: 17.5 * IN, color: '#4f7a4a', color2: '#e9e4da', on: 1,
    url: 'https://www.crateandbarrel.com/faux-snake-plant-in-pot/s441771', note: '17.5" H × 10.5" diameter.' },
  { id: 'sp_18', like: 'plant_snake', name: 'Primrue tabletop snake plant 18"', cat: 'Plants', w: 8 * IN, d: 6 * IN, h: 18 * IN, color: '#4f7a4a', color2: '#1d1d1f', on: 1,
    url: 'https://www.wayfair.com/home/pdp/primrue-artificial-snake-plant-w004087203.html', note: '8" × 6" × 18" H. The same listing has a 26" size (below).' },
  { id: 'sp_26', like: 'plant_snake', name: 'Primrue snake plant 26"', cat: 'Plants', w: 9 * IN, d: 9 * IN, h: 26 * IN, color: '#4f7a4a', color2: '#1d1d1f',
    url: 'https://www.wayfair.com/home/pdp/primrue-artificial-snake-plant-w004087203.html', note: '9" × 9" × 26" H.' },
  { id: 'sp_48', like: 'plant_snake', name: 'Snake plant 4 ft in black pot', cat: 'Plants', w: 15 * IN, d: 15 * IN, h: 48 * IN, color: '#5d7f45', color2: '#1d1d1f',
    url: 'https://www.overstock.com/Home-Garden/4ft-Green-Yellow-Artificial-Sansevieria-Snake-Plant-in-Black-Pot-48-H-x-15-W-x-15-DP/42094342/product.html', note: '48" H × 15" W × 15" D, green and yellow leaves.' },
  { id: 'sp_54', like: 'plant_snake', name: 'Nearly Natural 4.5 ft snake plant in gray planter', cat: 'Plants', w: 12 * IN, d: 12 * IN, h: 54 * IN, color: '#4f7a4a', color2: '#9a9a96',
    url: 'https://www.target.com/p/nearly-natural-4-5-ft-sansevieria-artificial-plant-in-gray-planter/-/A-90178797', note: '54" H × 12" W × 12" D; the gray planter is 24" tall. Listed as out of stock when found.' },
  { id: 'sp_55', like: 'plant_snake', name: 'Vintage Home 4.6 ft snake plant in fiberstone planter', cat: 'Plants', w: 20 * IN, d: 20 * IN, h: 55 * IN, color: '#4f7a4a', color2: '#8f8b84',
    url: 'https://www.walmart.com/ip/Vintage-Home-Artificial-Faux-Real-Touch-4-58-Feet-Tall-Snake-Plant-Sansevieria-With-Fiberstone-Planter/794242708', note: '20" × 20" × 55" H, real-touch leaves, fiberstone planter.' },
  // ---------- Office chairs ----------
  { id: 'ch_branch', like: 'taskchair', name: 'Branch Ergonomic Chair', cat: 'Seating', w: 26 * IN, d: 24 * IN, h: 45 * IN, color: '#1e1f22', color2: '#1b1c1f',
    url: 'https://www.bestbuy.com/product/branch-furniture-branch-ergonomic-chair-adjustable-office-chair-for-all-day-comfort-with-lumbar-support-and-recycled-mesh-back-black/J3GW7G3LP3',
    colors: [['Black', '#1e1f22'], ['Baltic', '#3d5566'], ['Pebble White', '#e7e4dd'], ['Sand White', '#e2d9c8']], note: '26" W × 24" D × 45" H at full height (Branch assembly guide); adjustable lumbar, mesh back.' },
  { id: 'ch_branch_lite', like: 'taskchair', name: 'Branch Ergonomic Chair Lite', cat: 'Seating', w: 27.4 * IN, d: 24.7 * IN, h: 42.5 * IN, color: '#1e1f22', color2: '#1b1c1f',
    url: 'https://www.target.com/p/branch-ergonomic-chair-lite/-/A-1014919480', colors: [['Black', '#1e1f22']], note: '27.4" W × 24.7–26.7" D × 39.6–42.5" H; seat 19.3" W.' },
  { id: 'ch_series1', like: 'taskchair', name: 'Steelcase Series 1', cat: 'Seating', w: 27 * IN, d: 23.75 * IN, h: 41.25 * IN, color: '#2b2d31', color2: '#1b1c1f',
    url: 'https://www.steelcase.com/asia-en/products/office-chairs/steelcase-series-1', colors: [['Licorice', '#2b2d31']], note: '23.5–27" W × 21–23.75" D × 36.5–41.25" H (Steelcase spec sheet); shown at the largest settings.' },
  { id: 'ch_hon', like: 'taskchair', name: 'HON Ignition 2.0 mid-back big & tall', cat: 'Seating', w: 30 * IN, d: 30 * IN, h: 46 * IN, color: '#1e1f22', color2: '#1b1c1f',
    url: 'https://www.officedepot.com/a/products/8315527503/HON-Ignition-2-0-Mid-Back', colors: [['Black', '#1e1f22']], note: 'About 30" × 30" × 46" H; seat 17–21.5" high.' },
  // ---------- Futons ----------
  { id: 'fu_emily', name: 'DHP Emily futon (armless, 71")', cat: 'Seating', w: 71 * IN, d: 34 * IN, h: 32 * IN, bedD: 43 * IN, color: '#1f1f21', color2: '#2b2d31', mat: 'fabric', build: futon(false),
    url: 'https://www.target.com/p/dhp-emily-convertible-futon/-/A-1002839209', colors: [['Black faux leather', '#1f1f21'], ['Grey linen', '#8e8c88'], ['Navy blue', '#2c3a55'], ['White faux leather', '#f0eeea']],
    note: '71" W × 34" D × 32" H; seat 16" high. Opens to a 71" × 43" bed (tick "Opened as a bed").' },
  { id: 'fu_brittany', name: 'Novogratz Brittany futon (81.5")', cat: 'Seating', w: 81.5 * IN, d: 34.5 * IN, h: 31.5 * IN, bedD: 43.5 * IN, color: '#5b5c5e', color2: '#7a5a3e', mat: 'fabric', build: futon(true),
    url: 'https://www.target.com/p/novogratz-brittany-futon/-/A-1002453010', colors: [['Dark gray linen', '#5b5c5e'], ['Gray linen', '#9a9894'], ['Navy', '#2c3a55'], ['Green linen', '#5f6e57'], ['Mustard', '#c99a3a'], ['Black faux leather', '#1f1f21']],
    note: '81.5" W × 34.5" D × 31.5" H with wooden legs; seat 16" high. Opens to a 70.5" × 43.5" bed (tick "Opened as a bed").' },
  // ---------- Sofa / console tables (behind a couch) ----------
  { id: 'ct_overstock', name: 'Modern 55" console table, wood top / black metal', cat: 'Tables', w: 55 * IN, d: 12 * IN, h: 36 * IN, color: '#7a5236', color2: '#1b1b1d', mat: 'wood', build: consoleTable, shelfOpt: 1,
    url: 'https://www.overstock.com/Home-Garden/55-Modern-Solid-Wood-Metal-Black-Console-Table-55-L-x-12-W-x-36-H/43641094/product.html', colors: [['Wood / black', '#7a5236']],
    note: '55" L × 12" W × 36" H: tall enough to sit behind most sofas. Solid wood top (colour not stated in the listing).' },
  { id: 'ct_hendry', name: 'Hendry 54" narrow console, espresso / black iron', cat: 'Tables', w: 54 * IN, d: 10 * IN, h: 30 * IN, color: '#3b2a20', color2: '#1b1b1d', mat: 'wood', build: consoleTable, shelfOpt: 1,
    url: 'https://www.lampsplus.com/p/159X7', colors: [['Espresso / matte black', '#3b2a20']], note: '54" W × 10" D × 30" H; only 10" deep, so it fits tight spots.' },
  { id: 'ct_folke', name: 'Folke 55" American walnut console table', cat: 'Tables', w: 55 * IN, d: 17.5 * IN, h: 30 * IN, color: '#6b4a35', color2: '#1b1b1d', mat: 'wood', build: consoleTable, shelfOpt: 1,
    url: 'https://www.lampsplus.com/c/0523F', colors: [['Walnut / black', '#6b4a35']], note: '55" W × 17.5" D × 30" H, walnut veneer with a black metal crossbar.' },
  // ---------- 10" PA speakers and stands ----------
  { id: 'pa_eon710', name: 'JBL EON710 10" powered PA speaker', cat: 'Audio', w: 13.07 * IN, d: 11.81 * IN, h: 23.11 * IN, color: '#1b1b1d', color2: '#2c2d30', on: 1, reach: 2.1, build: paSpeaker,
    url: 'https://jblpro.com/en-US/products/jbl-eon710', colors: [['Black', '#1b1b1d']], note: '23.11" H × 13.07" W × 11.81" D, 26.2 lb; Bluetooth. Drop it on a tripod stand and it sits on top.' },
  { id: 'pa_thump210', name: 'Mackie Thump210 10" powered PA speaker', cat: 'Audio', w: 13.0 * IN, d: 12.8 * IN, h: 22.4 * IN, color: '#1b1b1d', color2: '#2c2d30', on: 1, reach: 2.1, build: paSpeaker,
    url: 'https://www.adorama.com/mathump210.html', colors: [['Black', '#1b1b1d']], note: '22.4" H × 13" W × 12.8" D, 25.4 lb.' },
  { id: 'pa_ts410', name: 'Alto TS410 10" powered PA speaker', cat: 'Audio', w: 12.6 * IN, d: 12.5 * IN, h: 21.1 * IN, color: '#1b1b1d', color2: '#2c2d30', on: 1, reach: 2.1, build: paSpeaker,
    url: 'https://www.altoprofessional.com/products/ts410', colors: [['Black', '#1b1b1d']], note: '21.1" H × 12.6" W × 12.5" D, 26 lb; Bluetooth, app control.' },
  { id: 'pa_stand', name: 'Ultimate Support TS-80B tripod speaker stand', cat: 'Audio', w: 47 * IN, d: 47 * IN, h: 55 * IN, color: '#1b1b1d', build: tripod, surf: 1,
    url: 'https://www.ultimatesupport.com/products/ts-80b', colors: [['Black', '#1b1b1d']], heightLabel: 'Stand height', heights: [['Lowest · 44"', 44 * IN], ['55"', 55 * IN], ['Highest · 79"', 79 * IN]],
    note: 'Adjusts 44"–79"; the legs spread to a 47" circle. Holds up to 150 lb. Place a speaker on top; change the height and the speaker follows.' },
  // ---------- More office decor ----------
  { id: 'od_clock', like: 'clock', name: 'Nano wall clock, walnut / black', cat: 'Office ideas', w: 11 * IN, d: 3.5 * IN, h: 11.8 * IN, color: '#1d1d1f', color2: '#6b4a35',
    url: 'https://www.2modern.com/products/nano-clock', colors: [['Walnut / black', '#1d1d1f']], note: '11" W × 3.5" D × 11.8" H.' },
  { id: 'od_pegwall', like: 'pegboard', name: 'Amabro Peg Wall, walnut', cat: 'Office ideas', w: 23.6 * IN, d: 1.5 * IN, h: 35.4 * IN, color: '#6b4a35', color2: '#1d1d1f',
    url: 'https://shop.gessato.com/amabro-peg-wall-walnut/', sizes: [['Medium 17.7" × 23.6"', 17.7 * IN, 1.5 * IN, 23.6 * IN], ['Large 23.6" × 35.4"', 23.6 * IN, 1.5 * IN, 35.4 * IN]],
    note: 'Walnut peg board with pegs and accessories. Sizes are from the oak version of the listing.' },
  { id: 'od_deskpad', like: 'deskmat', name: 'Smead vegan leather desk pad, charcoal', cat: 'Office ideas', w: 31.5 * IN, d: 15.7 * IN, h: 0.1 * IN, color: '#3a3b3e',
    url: 'https://www.staples.com/smead-vegan-leather-desk-pad-31-5-x-15-7-charcoal-smd64833/product_SMD64833', colors: [['Charcoal', '#3a3b3e']], note: '31.5" × 15.7".' },
  { id: 'od_tray', name: 'Carver walnut-finish letter tray', cat: 'Office ideas', w: 13.62 * IN, d: 10.62 * IN, h: 2.12 * IN, color: '#6b4a35', on: 1, mat: 'wood', build: tray,
    url: 'https://www.ontimesupplies.com/cvrcw07212-walnut-finish-solid-wood-desk-trays-desktop-stackable-walnut-oak-1-each.html', colors: [['Walnut', '#6b4a35']], note: '13.62" × 10.62" × 2.12", stackable. Oak with a walnut finish.' },
  { id: 'od_vase', name: 'Black ceramic vase with glossy rim 16.2"', cat: 'Office ideas', w: 9.8 * IN, d: 4.9 * IN, h: 16.2 * IN, color: '#1a1a1c', on: 1, build: vase,
    url: 'https://www.athome.com/black-ceramic-vase-with-glossy-rim-16.2/125019795.html', colors: [['Black', '#1a1a1c']], note: '9.8" L × 4.9" W × 16.2" H.' },
  { id: 'od_lamp', like: 'tablelamp', name: 'Henn&Hart matte black & brass table lamp', cat: 'Office ideas', w: 15 * IN, d: 15 * IN, h: 24.5 * IN, color: '#efe6d2', color2: '#1d1d1f',
    url: 'https://www.cymax.com/Henn-Hart-15-Matte-Black-Brass-Ceramic-Metal-Fabric-Table-Lamp-242248X.htm', colors: [['Black / brass', '#efe6d2']], note: '15" W × 15" D × 24.5" H, ceramic and metal base with fabric shade.' },
  { id: 'shintenchi_island', name: 'Shintenchi rolling kitchen island with drop leaf', cat: 'My picks', w: 39.8 * IN, d: 24.8 * IN, h: 35.6 * IN, color: '#f4f3ef', color2: '#f4f3ef', clear: 0.9, build: islandCart,
    url: 'https://www.amazon.com/dp/B0GY8N9MWN',
    colors: [['White', '#f4f3ef'], ['Black', '#2a2a2b']],
    note: 'Listed size: 39.8" W × 24.8" D × 35.6" H with the drop leaf raised (seating side at the back). Cabinet with adjustable shelf, three drawers, locking casters. Size from retailer listings of this model.' },
  // ---------- Living ----------
  { id: 'sofa3', name: 'Sofa, 3-seat', cat: 'Living', w: 2.13, d: 0.92, h: 0.85, color: '#8a9aa3', mat: 'fabric', build: sofa(3) },
  { id: 'sofa2', name: 'Loveseat', cat: 'Living', w: 1.55, d: 0.9, h: 0.85, color: '#8a9aa3', mat: 'fabric', build: sofa(2) },
  { id: 'sectional', name: 'Sectional sofa', cat: 'Living', w: 2.7, d: 1.65, h: 0.85, color: '#9a9388', mat: 'fabric', hand: 'right', build: sectional },
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
  { id: 'wallcab', name: 'Wall cabinet', cat: 'Kitchen', w: 0.6, d: 0.33, h: 0.76, elev: 1.4, color: '#f2f0ec', mat: 'cab', mount: 'wall', build: (w, d, h, it) => [bx(0, 0, -0.01, w, h, d - 0.02, 'a'), ...cabinetDoors(w, d, 0.01, h - 0.01, 'a+', it?.slab)] },
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
  ...OFFICE, ...DESK,

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
  { id: 'plant_small', name: 'Small plant', cat: 'Decor', on: 1, w: 0.28, d: 0.28, h: 0.4, color: '#5f9a58', color2: '#e3ded4', build: plant },
  { id: 'tablelamp', name: 'Table lamp', cat: 'Decor', on: 1, w: 0.3, d: 0.3, h: 0.5, elev: 0.56, color: '#efe6d2', color2: '#b08456', mat: 'accent', build: lamp },
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

  ...MORE,

  // ---------- Custom primitives (also the base for imported pieces) ----------
  { id: 'box', name: 'Custom box', cat: 'Custom', w: 1, d: 0.6, h: 0.8, color: '#b9b2a6', build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'cyl', name: 'Custom cylinder', cat: 'Custom', w: 0.8, d: 0.8, h: 0.8, color: '#b9b2a6', build: (w, d, h) => [{ ...cy(0, 0, 0, w, h, 'a'), d }] },
  { id: 'lshape', name: 'L-shaped block', cat: 'Custom', w: 2, d: 1.6, h: 0.9, color: '#b9b2a6', build: (w, d, h) => [bx(0, 0, -d / 2 + d * 0.2, w, h, d * 0.4, 'a'), bx(-w / 2 + w * 0.2, 0, d * 0.2, w * 0.4, h, d * 0.6, 'a')] },
  { id: 'product', name: 'Product from web', cat: 'Custom', w: 1, d: 0.6, h: 0.8, color: '#d8d3c8', hidden: true, build: (w, d, h) => [bx(0, 0, 0, w, h, d, 'a')] },
  { id: 'model', name: '3D model', cat: 'Custom', w: 1, d: 1, h: 1, color: '#c8ccd2', hidden: true },
];

export const CATALOG = DEFS;
export const CATEGORIES = [...new Set(DEFS.map(d => d.cat))];
// `like: 'other_id'` reuses another piece's model and behaviour (mounting, resting on furniture, textures) with its own size, colours and link
const POTS = [['Black', '#1d1d1f'], ['White ceramic', '#f2f0eb'], ['Stone grey', '#9a9a96'], ['Terracotta', '#b5643c'], ['Walnut', '#6b4a35'], ['Woven', '#c9b28c']];
{ const base = Object.fromEntries(DEFS.map(d => [d.id, d]));
  DEFS.forEach((d, i) => { if (d.like && base[d.like]) { const { id, name, cat, url, colors, note, sizes, ...b } = base[d.like]; DEFS[i] = { ...b, ...d }; } });
  const plantish = new Set(['plant', 'plant_small', 'plant_snake', 'plant_fiddle', 'pothos']);
  DEFS.forEach(d => { if (plantish.has(d.id) || plantish.has(d.like)) d.pots ??= POTS; }); }
const byId = Object.fromEntries(DEFS.map(d => [d.id, d]));
export const getDef = type => byId[type] || byId.box;

const NAMED = { metal: '#b9bdc3', steel: '#c9ccd1', alu: '#c5c8cc', display: '#3b5f8f', led: '#fff1d0', dark: '#2b2d31', black: '#141416', white: '#f6f5f2', glass: '#a9d4e6', screen: '#0c1016', mirror: '#cfe3ea' };
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
    if (p.s === 'cyl' || p.s === 'sph') { const k = p.s === 'cyl' && p.t > 1 ? p.t : 1; ctx.ellipse(0, 0, (p.w / 2) * k, (p.d / 2) * k, 0, 0, Math.PI * 2); }
    else ctx.rect(-p.w / 2, -p.d / 2, p.w, p.d);
    ctx.fill();
    if (Math.max(p.w, p.d) > lw * 4) ctx.stroke(); // outlines would swamp fine detail such as keyboard keys
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

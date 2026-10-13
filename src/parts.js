// Solids that furniture is assembled from. Local axes: x = width, y = up (a part's y is its underside), z = depth.
// Optional `rx` / `ry` / `rz` rotate a part about its own centre (radians).
export const bx = (x, y, z, w, h, d, c, o) => ({ s: 'box', x, y, z, w, h, d, c, ...o });
export const rb = (x, y, z, w, h, d, c, r = 0.01, o) => ({ s: 'rbox', x, y, z, w, h, d, c, r, ...o }); // box with rounded edges of radius r
export const cy = (x, y, z, dia, h, c, o) => ({ s: 'cyl', x, y, z, w: dia, h, d: dia, c, ...o });
export const sp = (x, y, z, w, h, d, c) => ({ s: 'sph', x, y, z, w, h, d, c });
export const disc = (x, y, z, dia, t, c) => ({ s: 'disc', x, y, z, w: dia, h: dia, d: t, c }); // round face pointing forward
export const hex = (x, y, z, dia, t, c) => ({ s: 'hex', x, y, z, w: dia, h: dia, d: t, c }); // hexagonal face pointing forward (point up)
export const legs = (w, d, h, t, c, i = 0.03) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => bx(sx * (w / 2 - i - t / 2), 0, sz * (d / 2 - i - t / 2), t, h, t, c));
/** A thin rod of length `len` rising from (x, y, z) and leaning by `rz` (sideways) and `rx` (front/back). */
export const stalk = (x, y, z, dia, len, c, rz = 0, rx = 0, o) => ({ ...cy(x - (Math.sin(rz) * len) / 2, y + (Math.cos(rz) * Math.cos(rx) * len) / 2 - len / 2, z + (Math.cos(rz) * Math.sin(rx) * len) / 2, dia, len, c, o), rz, rx });
/** A row of upright books filling `w`, deterministic from `seed`. */
export function books(x, y, z, w, hmax, d, seed = 0) {
  const cols = ['#8c4a3c', '#3f5f7a', '#d9c9a5', '#56715a', '#c98b3f', '#4a4458', '#e8e4dc', '#2f3338'], out = [];
  for (let k = seed, px = x - w / 2; ; k++) {
    const bw = 0.022 + ((k * 7) % 5) * 0.006, bh = hmax * (0.72 + ((k * 5) % 4) * 0.09);
    if (px + bw > x + w / 2) break;
    out.push(bx(px + bw / 2, y, z, bw, bh, d * (0.8 + ((k * 3) % 3) * 0.08), cols[(k * 3 + seed) % cols.length]));
    px += bw + 0.002;
  }
  return out;
}

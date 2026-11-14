// First-person walking: pointer-lock look, smoothed movement, crouch / sprint / fly, and collision with walls and furniture.
// Plan coordinates: x right, y down; in 3D the plan's y is z.
import { S } from './state.js';
import { getDef } from './catalog.js';
import { rot, sub, clamp } from './util.js';

export const walk = { yaw: 0, pitch: 0, keys: {}, vx: 0, vz: 0, vy: 0, eye: 1.6, fly: false, speed: 1 };
const BODY = 0.22;         // body radius (m)
const STAND = 1.6, CROUCH = 1.1;

let solids = null, solidsVer = -1;
/** Walls (with door gaps left open) as thick segments, and furniture footprints that stand in the way, as rotated boxes. */
function buildSolids() {
  const segs = [], boxes = [];
  for (const w of S.doc.walls) {
    const g = S.wallGeom.get(w.id); if (!g || g.len < 0.02) continue;
    const gaps = S.doc.openings.filter(o => o.wallId === w.id && o.type === 'door')
      .map(o => [o.pos - o.width / 2 + 0.04, o.pos + o.width / 2 - 0.04]).sort((a, b) => a[0] - b[0]);
    let t = 0;
    for (const [g0, g1] of [...gaps, [g.len, g.len]]) {
      if (g0 > t + 0.01) segs.push({ ax: w.a.x + g.dir.x * t, ay: w.a.y + g.dir.y * t, bx: w.a.x + g.dir.x * g0, by: w.a.y + g.dir.y * g0, r: w.thickness / 2 });
      t = Math.max(t, g1);
    }
  }
  for (const it of S.doc.items) {
    const def = getDef(it.type), lo = it.elev || 0, hi = lo + it.h;
    if (def.flat || hi < 0.3 || lo > STAND || it.w < 0.05 || it.d < 0.05) continue; // rugs, low trim and anything overhead are walked over / under
    boxes.push({ x: it.x, y: it.y, rot: it.rot || 0, hw: it.w / 2, hd: it.d / 2 });
  }
  return { segs, boxes };
}

/** Push a body at p (plan coords, mutated) out of every wall and piece it overlaps. */
export function collide(p, r = BODY) {
  if (solidsVer !== S.version || !solids) { solids = buildSolids(); solidsVer = S.version; }
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    for (const s of solids.segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((p.x - s.ax) * dx + (p.y - s.ay) * dy) / L2, 0, 1), cx = s.ax + dx * t, cy = s.ay + dy * t;
      const ox = p.x - cx, oy = p.y - cy, d = Math.hypot(ox, oy), need = s.r + r;
      if (d < need) { const k = d > 1e-6 ? (need - d) / d : 0; p.x += ox * k; p.y += oy * k; if (d <= 1e-6) p.x += need; hit = true; }
    }
    for (const b of solids.boxes) {
      const l = rot(sub(p, b), -b.rot), cx = clamp(l.x, -b.hw, b.hw), cy = clamp(l.y, -b.hd, b.hd);
      let ox = l.x - cx, oy = l.y - cy, d = Math.hypot(ox, oy);
      if (d >= r) continue;
      if (d < 1e-6) { // centre inside the box: leave by the nearest side
        const ex = b.hw - Math.abs(l.x), ey = b.hd - Math.abs(l.y);
        if (ex < ey) { ox = Math.sign(l.x) || 1; oy = 0; d = -ex; } else { ox = 0; oy = Math.sign(l.y) || 1; d = -ey; }
      } else { ox /= d; oy /= d; }
      const push = rot({ x: ox * (r - d), y: oy * (r - d) }, b.rot);
      p.x += push.x; p.y += push.y; hit = true;
    }
    if (!hit) break;
  }
  return p;
}

/** Advance the walker by dt seconds and pose the camera. */
export function walkStep(camera, dt) {
  const k = walk.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  walk.yaw += ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * dt * 1.8;
  const crouch = !walk.fly && k.KeyC, sprint = k.ShiftLeft || k.ShiftRight;
  const top = (sprint ? 3.6 : 1.5) * (crouch ? 0.5 : 1) * walk.speed;
  const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
  let tx = -sy * f + cy * s, tz = -cy * f - sy * s; const n = Math.hypot(tx, tz); if (n > 1) { tx /= n; tz /= n; }
  const ease = 1 - Math.exp(-dt * (f || s ? 10 : 14)); // quick to start, quicker to stop: no ice-skating
  walk.vx += (tx * top - walk.vx) * ease; walk.vz += (tz * top - walk.vz) * ease;
  const pos = camera.position;
  if (walk.fly) {
    const up = (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0);
    walk.vy += (up * top - walk.vy) * ease;
    pos.x += walk.vx * dt; pos.z += walk.vz * dt; pos.y = clamp(pos.y + walk.vy * dt, 0.3, 60);
  } else {
    const steps = Math.max(1, Math.ceil(Math.hypot(walk.vx, walk.vz) * dt / 0.08)), p = { x: pos.x, y: pos.z };
    for (let i = 0; i < steps; i++) { p.x += walk.vx * dt / steps; p.y += walk.vz * dt / steps; collide(p); }
    pos.x = p.x; pos.z = p.y;
    walk.eye += ((crouch ? CROUCH : STAND) - walk.eye) * (1 - Math.exp(-dt * 10));
    pos.y = walk.eye;
  }
  camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
}

/** Mouse / touch look: dx, dy in screen pixels. */
export function look(dx, dy) {
  const k = 0.0022 * (S.prefs.walkSens || 1);
  walk.yaw -= dx * k; walk.pitch = clamp(walk.pitch - dy * k * (S.prefs.walkInvertY ? -1 : 1), -1.45, 1.45);
}

/** A spot to stand at the start: the given point pushed clear of furniture and walls. */
export function standAt(x, y) { return collide({ x, y }); }

// self-check: a body walked into a wall stops in front of it
{
  const p = { x: 0, y: 0 }, saved = solids, savedVer = solidsVer;
  solids = { segs: [{ ax: -1, ay: 0.1, bx: 1, by: 0.1, r: 0.05 }], boxes: [] }; solidsVer = S.version;
  collide(p); console.assert(p.y < 0.1 - 0.05 - BODY + 1e-6, 'walk: collision should push the body out of the wall', p);
  solids = saved; solidsVer = savedVer;
}

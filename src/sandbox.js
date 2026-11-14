// Build and edit from first person: what the crosshair is on, a ghost of the piece about to be placed, picking pieces up
// and carrying them, painting walls and floors. The walk HUD (hud/) drives it; with no HUD it stays off.
import * as THREE from 'three';
import { S, emit, touch, commit, revert, select, find, setPref } from './state.js';
import { getDef } from './catalog.js';
import { makeItem, addItem, sits, surfaceUnder, riders, wallMagnet, deleteSelection } from './ops.js';
import { clamp, deg, normDeg, sub, dot, uid } from './util.js';

const DEFAULT_BAR = ['armchair', 'sofa3', 'coffee', 'desk', 'plant', 'plant_small', 'tv', 'mirror', 'box'];
export const sb = {
  enabled: false, hud: true, mode: 'build', slot: 0, rot: 0,
  bar: (S.prefs.walkBar?.length === 9 ? S.prefs.walkBar : DEFAULT_BAR).slice(),
  paint: { color: '#e6e0d4', floor: 'oak', target: 'wall' },
  hover: null, carry: null,
};
let C = null; // { camera, itemsGroup, structure, scene, buildItem, shadowsDirty }
let ghost = null, ghostType = '', ghostItem = null;
const ray = new THREE.Raycaster(), centre = new THREE.Vector2(0, 0), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp = new THREE.Vector3();
const changed = () => emit('sb', sb);
const REACH = 7;

export function initSandbox(ctx) {
  C = ctx;
  // runs before the app's own shortcuts (capture phase) so walking keys never reach the 2D editor
  addEventListener('keydown', e => {
    if (!sb.enabled || !S.walk || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey) return;
    const k = e.code, done = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === 'Tab') { setHud(!sb.hud); return done(); }
    if (k === 'F1') { emit('sbphoto'); return done(); }
    if (!sb.hud) return;
    if (k === 'Escape' && (cancelCarry() || sb.panel)) { if (sb.panel) setPanel(null); return done(); }
    if (/^Digit[1-9]$/.test(k)) { setSlot(+k.slice(5) - 1); return done(); }
    if (e.repeat && k !== 'KeyR') return;
    const act = { KeyB: () => setMode('build'), KeyE: () => setMode('edit'), KeyP: () => setMode('paint'), KeyR: () => rotate(e.shiftKey ? 90 : 15),
      KeyX: removeHovered, Delete: removeHovered, KeyF: duplicateHovered, KeyT: () => setPanel(sb.panel === 'catalog' ? null : 'catalog'),
      KeyO: () => setPanel(sb.panel === 'settings' ? null : 'settings'), KeyG: () => { setPref('snapGrid', !S.prefs.snapGrid); emit('toast', `Grid snap ${S.prefs.snapGrid ? 'on' : 'off'}`, 1000); } }[k];
    if (act) { act(); done(); }
  }, true);
}
/** An overlay panel (catalogue, settings) frees the mouse; closing it lets you click back into the view. */
export function setPanel(p) { sb.panel = p; if (p && document.pointerLockElement) document.exitPointerLock(); changed(); }
export function enableSandbox(on = true) { sb.enabled = on; if (!on) clearGhost(); changed(); }

// ---- what the crosshair is pointing at ----
function itemOf(o) { while (o && !o.userData.itemId) o = o.parent; return o?.userData.itemId; }
function pick() {
  ray.setFromCamera(centre, C.camera); ray.far = REACH;
  const skip = new Set([ghost, sb.carry && find('item', sb.carry.id) && itemObjOf(sb.carry.id)].filter(Boolean));
  const hits = ray.intersectObjects([C.itemsGroup, C.structure], true).filter(h => h.object.visible && ![...skip].some(s => isUnder(h.object, s)));
  const h = hits[0];
  if (!h) return null;
  const p = h.point, n = h.face ? tmp.copy(h.face.normal).transformDirection(h.object.matrixWorld) : null;
  const base = { point: { x: p.x, y: p.z }, y: p.y, dist: h.distance, normal: n && { x: n.x, y: n.z, up: n.y } };
  const id = itemOf(h.object);
  if (id) return { ...base, k: 'item', id };
  let o = h.object; while (o && !o.userData.wallId && o.userData.roomId == null) o = o.parent;
  if (o?.userData.wallId) {
    const w = find('wall', o.userData.wallId), g = S.wallGeom.get(w?.id);
    return w && g ? { ...base, k: 'wall', id: w.id, side: dot(sub(base.point, w.a), g.n) >= 0 ? 'n' : 'm' } : null;
  }
  if (o?.userData.roomId != null) return { ...base, k: 'floor', id: o.userData.roomId };
  return null;
}
const isUnder = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
const itemObjOf = id => C.itemsGroup.children.find(g => g.userData.itemId === id);

/** Where the crosshair meets the floor (or a point ahead when looking up), in plan coordinates. */
function floorPoint() {
  ray.setFromCamera(centre, C.camera);
  const p = ray.ray.intersectPlane(floorPlane, tmp);
  const cam = C.camera.position, dir = ray.ray.direction;
  if (p && p.distanceTo(cam) < REACH) return { x: p.x, y: p.z };
  const flat = Math.hypot(dir.x, dir.z) || 1;
  return { x: cam.x + (dir.x / flat) * 2, y: cam.z + (dir.z / flat) * 2 };
}

/** Pose a piece at the crosshair: on the floor (snapped to walls), on the furniture under it, or flat on the wall in view. */
function poseAt(it, h) {
  const def = getDef(it.type);
  const w = h?.k === 'wall' && find('wall', h.id), g = w && S.wallGeom.get(w.id);
  if (def.mount === 'wall' && g) { // onto the wall face (not the hit point: that may be window glass in the middle of the wall)
    const s = h.side === 'n' ? 1 : -1, along = clamp(dot(sub(h.point, w.a), g.dir), 0, g.len), off = w.thickness / 2 + it.d / 2 + 0.005;
    it.x = w.a.x + g.dir.x * along + g.n.x * s * off; it.y = w.a.y + g.dir.y * along + g.n.y * s * off;
    it.rot = normDeg(deg(Math.atan2(-g.n.x * s, g.n.y * s))); // back to the wall, as wallMagnet turns pieces
    it.elev = clamp(h.y - it.h / 2, 0, (S.doc.settings.wallHeight || 2.6) - it.h);
    return;
  }
  // on the furniture you look at (small pieces), at the foot of the wall you look at, or where the gaze meets the floor
  const p = (sits(it) && h?.k === 'item') || h?.k === 'wall' ? h.point : floorPoint();
  const step = S.doc.settings.snap, sn = v => (S.prefs.snapGrid ? Math.round(v / step) * step : v);
  it.x = sn(p.x); it.y = sn(p.y);
  if (def.mount === 'wall') Object.assign(it, wallMagnet(it, true, 0.8)); // a mirror or TV goes onto the nearest wall, facing out
  else if (S.prefs.magnet !== false) Object.assign(it, wallMagnet(it, false));
  it.elev = sits(it) ? surfaceUnder(it) : def.elev || 0;
}

// ---- ghost of the piece in the current hotbar slot ----
function clearGhost() { if (ghost) { C.scene.remove(ghost); ghost.traverse(o => o.userData.own && o.geometry.dispose()); } ghost = null; ghostType = ''; ghostItem = null; }
function ensureGhost(type) {
  if (ghost && ghostType === type) return;
  clearGhost();
  ghostItem = makeItem(type, { id: '_ghost' }); ghostType = type;
  ghost = C.buildItem(ghostItem);
  const glass = new Map();
  ghost.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.raycast = () => {}; // never picked or shadowed
    const swap = m => glass.get(m) || glass.set(m, Object.assign(m.clone(), { transparent: true, opacity: 0.55, depthWrite: false })).get(m);
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  C.scene.add(ghost);
}

/** Called every frame while walking. */
export function sandboxFrame() {
  if (!C || !sb.enabled || !S.walk) { if (ghost) clearGhost(); return; }
  const h = pick(), key = h ? `${h.k}:${h.id}:${h.side || ''}` : '';
  if (key !== (sb.hover?.key || '')) { sb.hover = h && { ...h, key }; changed(); } else if (h) Object.assign(sb.hover, h, { key });
  if (sb.carry) {
    const it = find('item', sb.carry.id); if (!it) { sb.carry = null; changed(); return; }
    const x0 = it.x, y0 = it.y;
    poseAt(it, h); it.rot = getDef(it.type).mount === 'wall' && h?.k === 'wall' ? it.rot : normDeg(sb.carry.rot);
    for (const r of sb.carry.riders) { r.it.x += it.x - x0; r.it.y += it.y - y0; }
    touch();
  }
  const type = sb.mode === 'build' && !sb.carry ? sb.bar[sb.slot] : null;
  if (!type) { if (ghost) clearGhost(); return; }
  ensureGhost(type);
  ghostItem.rot = sb.rot; poseAt(ghostItem, h);
  if (getDef(type).mount !== 'wall' || h?.k !== 'wall') ghostItem.rot = sb.rot;
  ghost.position.set(ghostItem.x, ghostItem.elev || 0, ghostItem.y); ghost.rotation.y = -ghostItem.rot * Math.PI / 180;
}

// ---- actions (mouse buttons and keys while the HUD is on) ----
export function primary() {
  if (sb.carry) return drop();
  const h = sb.hover;
  if (sb.mode === 'build') {
    if (!ghostItem) return;
    const { id, ...pose } = ghostItem;
    addItem({ ...makeItem(ghostItem.type), x: pose.x, y: pose.y, rot: pose.rot, elev: pose.elev });
    emit('toast', `Placed ${getDef(ghostItem.type).name}`);
  } else if (sb.mode === 'edit') { if (h?.k === 'item') pickUp(h.id); }
  else if (sb.mode === 'paint') paint(h);
}
/** Right click: cancel a carry, otherwise take the piece under the crosshair into the current slot (like a pick-block). */
export function secondary() {
  if (sb.carry) return cancelCarry();
  const h = sb.hover;
  if (h?.k === 'item') { const it = find('item', h.id); if (it && !['model', 'product'].includes(it.type)) { setSlotType(sb.slot, it.type); sb.rot = it.rot || 0; setMode('build'); } }
  else if (h?.k === 'wall' && sb.mode === 'paint') { const sd = find('wall', h.id)?.sides?.[h.side]; sb.paint.color = sd?.color || find('wall', h.id)?.color || S.doc.settings.wallColor; changed(); }
}
export function pickUp(id) {
  const it = find('item', id); if (!it) return;
  if (it.locked) { emit('toast', `${it.name || getDef(it.type).name} is locked`); return; }
  select([{ k: 'item', id }]);
  sb.carry = { id, rot: it.rot || 0, riders: riders([it]).map(r => ({ it: r })) };
  changed();
}
function drop() { sb.carry = null; commit(); changed(); }
export function cancelCarry() { if (!sb.carry) return false; sb.carry = null; revert(); changed(); return true; }
export function rotate(by) {
  if (sb.carry) { sb.carry.rot = normDeg(sb.carry.rot + by); return; }
  const h = sb.hover;
  if (sb.mode !== 'build' && h?.k === 'item') { const it = find('item', h.id); if (it && !it.locked) { it.rot = normDeg((it.rot || 0) + by); commit(); } return; }
  sb.rot = normDeg(sb.rot + by); changed();
}
export function removeHovered() {
  const h = sb.hover; if (h?.k !== 'item') return;
  const it = find('item', h.id); if (!it || it.locked) return;
  select([{ k: 'item', id: it.id }]); deleteSelection(); emit('toast', `Removed ${it.name || getDef(it.type).name}`);
}
export function duplicateHovered() {
  const h = sb.hover; if (h?.k !== 'item') return;
  const src = find('item', h.id); if (!src) return;
  const copy = { ...JSON.parse(JSON.stringify(src)), id: uid('it'), locked: false };
  S.doc.items.push(copy); setMode('edit'); pickUp(copy.id);
}
function paint(h) {
  if (h?.k === 'wall') { const w = find('wall', h.id); w.sides ??= {}; w.sides[h.side] = { ...w.sides[h.side], color: sb.paint.color }; commit(); }
  else if (h?.k === 'floor') { const r = S.rooms.find(r => r.id === h.id); if (r) { r.meta.floor = sb.paint.floor; commit(); } }
}

export function setMode(m) { if (sb.carry) cancelCarry(); sb.mode = m; changed(); }
export function setSlot(i) { sb.slot = (i + 9) % 9; if (sb.mode !== 'build') sb.mode = 'build'; changed(); }
export function setSlotType(i, type) { sb.bar[i] = type; setPref('walkBar', sb.bar.slice()); changed(); }
export function setPaint(patch) { Object.assign(sb.paint, patch); changed(); }
export const setHud = v => { sb.hud = v; changed(); };

// Central document store: the plan model, derived geometry, selection, undo history and autosave.
import { migrate } from './migrate.js';
import { uid, computeRooms, computeWallGeom, polyArea, polyPerimeter, polyLabelPoint, polyBBox, pointInPoly } from './util.js';

export const S = {
  doc: null,
  assets: {},        // id -> { name, kind: 'image' | 'glb' | 'gltf' | 'obj', data: dataURL }
  sel: [],           // [{ k: 'item' | 'wall' | 'opening' | 'room' | 'label' | 'dim', id }]
  tool: 'select',
  toolOpt: {},
  rooms: [],         // derived: [{ id, meta, poly, area, perimeter, c, bbox }]
  wallGeom: new Map(),
  version: 0,
  library: [],       // user-saved furniture templates
  walk: false,
  prefs: { snapGrid: true, snapAngle: true, magnet: true, showDims: true, showClear: false, showIssues: true, showLabels: true, view: 'split' },
};

const listeners = {};
export const on = (ev, fn) => (listeners[ev] ??= []).push(fn);
export const emit = (ev, data) => (listeners[ev] || []).forEach(fn => fn(data));

export function newDoc() {
  return {
    app: 'interior-designer', version: 1, name: 'Untitled plan', units: 'imperial',
    settings: { wallHeight: 2.6, wallThickness: 0.15, wallColor: '#f3f0ea', snap: 0.0254 },
    walls: [], openings: [], roomMeta: [], items: [], labels: [], dims: [], trace: null, fixes: ['nook1', 'layout2', 'details1', 'curtain1', 'baldoor1', 'kitchen2'],
  };
}

function derive(prune) {
  const d = S.doc;
  S.wallGeom = computeWallGeom(d.walls);
  const used = new Set();
  S.rooms = computeRooms(d.walls).map(poly => {
    let meta = d.roomMeta.find(m => !used.has(m.id) && pointInPoly({ x: m.px, y: m.py }, poly));
    const c = polyLabelPoint(poly);
    if (!meta) { meta = { id: uid('rm'), name: 'Room', floor: 'oak' }; d.roomMeta.push(meta); }
    used.add(meta.id); meta.px = c.x; meta.py = c.y;
    const perimeter = polyPerimeter(poly);
    // polygons follow wall centre-lines, so trim half a wall all round for usable floor area
    const area = Math.max(0, polyArea(poly) - (perimeter * d.settings.wallThickness) / 2);
    return { id: meta.id, meta, poly, area, perimeter, c, bbox: polyBBox(poly) };
  });
  if (prune) d.roomMeta = d.roomMeta.filter(m => used.has(m.id));
}

// ---- history ----
let past = [], future = [], current = '';
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

/** Record the current state as an undo step (call after finishing an edit). */
export function commit() {
  derive(true);
  const s = JSON.stringify(S.doc);
  if (s !== current) { past.push(current); if (past.length > 200) past.shift(); current = s; future = []; scheduleSave(); }
  S.version++; emit('doc'); emit('history');
}
/** Refresh views mid-drag without creating an undo step. */
export function touch() { derive(false); S.version++; emit('doc'); }

function restore() {
  S.doc = JSON.parse(current);
  S.sel = S.sel.filter(s => find(s.k, s.id));
  derive(false); S.version++;
  emit('doc'); emit('sel'); emit('history'); scheduleSave();
}
export function undo() { if (past.length) { future.push(current); current = past.pop(); restore(); } }
export function redo() { if (future.length) { past.push(current); current = future.pop(); restore(); } }
/** Abandon uncommitted changes (e.g. Esc during a drag). */
export function revert() { if (current) restore(); }

export function setDoc(doc, assets = {}) {
  migrate(doc);
  S.doc = { ...newDoc(), ...doc, settings: { ...newDoc().settings, ...(doc.settings || {}) } };
  S.assets = assets; S.sel = [];
  derive(true);
  current = JSON.stringify(S.doc); past = []; future = [];
  S.version++;
  emit('doc'); emit('sel'); emit('history'); emit('load'); scheduleSave();
}

// ---- lookup & selection ----
const coll = { item: 'items', wall: 'walls', opening: 'openings', label: 'labels', dim: 'dims' };
export function find(k, id) {
  if (k === 'room') return S.rooms.find(r => r.id === id);
  return S.doc[coll[k]]?.find(o => o.id === id);
}
export const isSel = (k, id) => S.sel.some(s => s.k === k && s.id === id);
export function select(list) { S.sel = list || []; emit('sel'); }
export function toggleSel(e) { select(isSel(e.k, e.id) ? S.sel.filter(s => !(s.k === e.k && s.id === e.id)) : [...S.sel, e]); }
export const selOf = k => S.sel.filter(s => s.k === k).map(s => find(k, s.id)).filter(Boolean);
export function setTool(tool, opt = {}) { S.tool = tool; S.toolOpt = opt; emit('tool'); }
export function setPref(k, v) { S.prefs[k] = v; emit('prefs'); try { localStorage.setItem('id-prefs', JSON.stringify(S.prefs)); } catch {} }

// ---- persistence (IndexedDB so embedded images / 3D models fit) ----
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('interior-designer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function kvGet(key) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export async function kvSet(key, val) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

let saveTimer = 0;
const saveNow = () => { clearTimeout(saveTimer); saveTimer = 0; return kvSet('autosave', { doc: S.doc, assets: S.assets, slot: S.slot }).then(() => emit('saved')).catch(() => {}); };
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}
// iPad: switching apps or closing the tab can freeze the page at any moment, so write pending changes straight away
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer && S.doc) saveNow(); });
addEventListener('pagehide', () => { if (saveTimer && S.doc) saveNow(); });
export const saveLibrary = () => kvSet('library', S.library).catch(() => {});
export const exportProject = () => JSON.stringify({ ...S.doc, assets: S.assets });

// ---- named projects kept on this device ----
export const listProjects = async () => (await kvGet('projects').catch(() => null)) || [];
/** Save the current plan as a named project on this device (overwrites the slot it was opened from). Returns the slot record. */
export async function saveSlot(name, asNew = false) {
  const list = await listProjects();
  let rec = !asNew && S.slot && list.find(p => p.id === S.slot);
  if (!rec) { rec = { id: uid('pj') }; list.unshift(rec); }
  Object.assign(rec, { name: name || S.doc.name, saved: Date.now(), items: S.doc.items.length, rooms: S.rooms.length });
  await kvSet('proj:' + rec.id, { doc: { ...S.doc, name: rec.name }, assets: S.assets });
  await kvSet('projects', [rec, ...list.filter(p => p !== rec)]);
  S.slot = rec.id; S.doc.name = rec.name; emit('history'); scheduleSave();
  return rec;
}
export async function openSlot(id) {
  const data = await kvGet('proj:' + id);
  if (!data?.doc) throw new Error('missing');
  setDoc(data.doc, data.assets || {}); S.slot = id;
  return data.doc;
}
export async function deleteSlot(id) {
  await kvSet('projects', (await listProjects()).filter(p => p.id !== id));
  const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').delete('proj:' + id);
  if (S.slot === id) S.slot = null;
}

export async function boot() {
  try { navigator.storage?.persist?.(); } catch {} // ask the browser not to clear saved projects (Safari evicts unused site data)
  try { Object.assign(S.prefs, JSON.parse(localStorage.getItem('id-prefs') || '{}')); } catch {}
  S.prefs.showClear = false;
  try { S.library = (await kvGet('library')) || []; } catch {}
  try { return await kvGet('autosave'); } catch { return null; }
}

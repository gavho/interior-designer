// Application chrome: top bar, tool rail, catalogue / build / style / objects / insights tabs,
// the properties inspector, dialogs, context menu and toasts.
import { S, on, emit, commit, touch, undo, redo, canUndo, canRedo, select, selOf, find, isSel, setTool, setPref, setDoc, newDoc, exportProject, parseProject, exportBackup, importBackup, restoreSnapshot, kvGet, kvSet, saveLibrary, listProjects, saveSlot, openSlot, deleteSlot } from './state.js';
import { h, uid, fmtLen, parseLen, fmtArea, fmtMoney, download, readAsDataURL, pickFile, normDeg, dist, clamp, add, sub, mul, rot, phone } from './util.js';
import { CATALOG, CATEGORIES, getDef, thumbnail, lightOf, KELVIN, MODULE_TYPES, moduleBounds, moduleLayout } from './catalog.js';
import { FLOORS, PALETTES, SWATCHES, floorCanvas, WALL_FINISHES, WOODS, COUNTERS } from './materials.js';
import * as ops from './ops.js';
import { analyze } from './analysis.js';
import * as ed from './editor2d.js';
import { loadSample, loadMine } from './sample.js';
import { POINT_KINDS, CABLE_KINDS, ROUTES, elec, schedule, cableLength, fmtFt } from './electrical.js';

let api3d = null;
export const set3d = m => { api3d = m; build3dHud(); };
const $ = id => document.getElementById(id);
const units = () => S.doc.units;
const L = m => fmtLen(m, units());

const ICONS = {
  select: 'M5 3l14 8-6 2-2 6z', pan: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  wall: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6', arc: 'M4 20A16 16 0 0 1 20 4M2 20h4M20 2v4', room: 'M4 4h16v16H4zM4 14h8v6', door: 'M5 20V4h2v16M7 4a13 13 0 0 1 13 16H7',
  window: 'M4 5h16v14H4zM12 5v14M4 12h16', measure: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2', label: 'M5 6h14M12 6v13M9 19h6',
  outlet: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 8v3M14 8v3M12 15v1', cable: 'M4 20c4 0 4-6 8-6s4 6 8 6M4 20v-3M20 20v-6M8 4h8v5H8z',
  undo: 'M8 5L3 10l5 5M3 10h11a5.5 5.5 0 0 1 0 11h-3', redo: 'M16 5l5 5-5 5M21 10H10a5.5 5.5 0 0 0 0 11h3',
};
const icon = n => h('span.ico', { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>` });

// ------------------------------------------------------------------ toasts, menus, dialogs
export function toast(msg, ms = 2600) {
  const t = h('div.toast', null, msg);
  $('toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

let openMenu = null;
function closeMenu() { openMenu?.remove(); openMenu = null; }
function menu(x, y, entries) {
  closeMenu();
  openMenu = h('div.menu', null, entries.filter(Boolean).map(e => e === '-' ? h('hr') : h('button', { disabled: e.disabled, onclick: () => { closeMenu(); e.run(); } }, h('span', null, e.label), e.key && h('kbd', null, e.key))));
  document.body.append(openMenu);
  const r = openMenu.getBoundingClientRect();
  openMenu.style.left = Math.min(x, innerWidth - r.width - 6) + 'px'; openMenu.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
}
addEventListener('pointerdown', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);

function dialog(title, body, buttons = [], cls = '') {
  const close = () => back.remove();
  const back = h('div.modal-back', { onpointerdown: e => e.target === back && close() },
    h('div.modal' + cls, null, h('header', null, h('h2', null, title), h('button.x', { onclick: close }, '×')), h('div.modal-body', null, body),
      buttons.length ? h('footer', null, buttons.map(b => h('button' + (b.primary ? '.primary' : ''), { onclick: async () => { if ((await b.run?.()) !== false) close(); } }, b.label))) : null));
  document.body.append(back);
  back.querySelector('input,select,textarea')?.focus();
  return close;
}

// ------------------------------------------------------------------ form controls
const row = (label, ...c) => h('label.row', null, h('span', null, label), h('div.ctl', null, ...c));
function lenInput(v, set, small = true) {
  const i = h('input', { type: 'text', value: L(v), onfocus: () => i.select(), onchange: () => { const m = parseLen(i.value, units(), small); if (m == null || !isFinite(m)) i.value = L(v); else set(m); } });
  return i;
}
const numInput = (v, set, o = {}) => { const i = h('input', { type: 'number', value: v, step: o.step || 1, min: o.min, max: o.max, onchange: () => isFinite(+i.value) && set(+i.value) }); return i; };
const textInput = (v, set, o = {}) => { const i = h('input', { type: o.type || 'text', value: v ?? '', placeholder: o.placeholder, list: o.list, onchange: () => set(i.value) }); return i; };
const selectInput = (opts, v, set) => { const s = h('select', { onchange: () => set(s.value) }, opts.map(([val, lab]) => h('option', { value: val, selected: val === v }, lab))); return s; };
const check = (label, v, set) => { const i = h('input', { type: 'checkbox', checked: !!v, onchange: () => set(i.checked) }); return h('label.check', null, i, label); };
function colorInput(v, live, done) {
  const i = h('input', { type: 'color', value: v || '#cccccc', oninput: () => live(i.value), onchange: () => done(i.value) });
  return h('div.color', null, i, h('div.swatches', null, SWATCHES.map(c => h('button', { title: c, style: { background: c }, onclick: e => { e.preventDefault(); done(c); } }))));
}
const btn = (label, run, o = {}) => h('button' + (o.cls ? '.' + o.cls : ''), { title: o.title, disabled: o.disabled, onclick: run }, label);
const section = (title, ...kids) => h('section.sec', null, title && h('h3', null, title), ...kids);
/** Apply a mutation and record it. */
const edit = fn => v => { fn(v); commit(); };
const live = fn => v => { fn(v); touch(); };

// ------------------------------------------------------------------ top bar
function buildTopbar() {
  const name = h('input.docname', { value: S.doc.name, title: 'Project name', onchange: () => { S.doc.name = name.value || 'Untitled plan'; commit(); } });
  const undoB = h('button.icon', { title: 'Undo (Ctrl+Z)', onclick: undo }, icon('undo')), redoB = h('button.icon', { title: 'Redo (Ctrl+Y)', onclick: redo }, icon('redo'));
  const tog = (key, label, title) => { const b = h('button.toggle', { title, onclick: () => setPref(key, !S.prefs[key]) }, label); b.dataset.pref = key; return b; };
  const viewSeg = h('div.seg', null, [['2d', '2D'], ['split', 'Split'], ['3d', '3D']].map(([v, l]) => { const b = h('button', { onclick: () => setView(v) }, l); b.dataset.view = v; return b; }));
  const unit = selectInput([['imperial', 'ft / in'], ['metric', 'Metric']], S.doc.units, v => { S.doc.units = v; S.doc.settings.snap = v === 'imperial' ? 0.0254 : 0.01; commit(); });
  const saved = h('span.saved', null, '');
  $('topbar').replaceChildren(
    h('div.brand', null, h('span.logo', null, '⌂'), h('span.brandname', null, 'Interior Designer')),
    h('button.drawer-btn.dl', { title: 'Show the catalogue and tools panel', onclick: () => setPanel('left') }, '☰ Panel'),
    h('button.menu-btn', { onclick: e => fileMenu(e.currentTarget) }, 'File ▾'), name, saved,
    h('div.sep'), undoB, redoB, h('div.sep'),
    tog('snapGrid', 'Grid snap', 'Snap to the measurement grid (G)'), tog('snapAngle', 'Angle snap', 'Snap walls to 15° steps'), tog('magnet', 'Wall magnet', 'Furniture snaps flush to walls'),
    tog('showDims', 'Dimensions', 'Show wall lengths'), tog('showLabels', 'Labels', 'Show room names and areas'), tog('showElec', 'Electrical', 'Show outlets and cable runs'),
    h('button.menu-btn.optmenu', { onclick: e => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 4, [...document.querySelectorAll('#topbar .toggle')].map(b => ({ label: (S.prefs[b.dataset.pref] ? '✓ ' : '\u2003 ') + b.textContent, run: () => setPref(b.dataset.pref, !S.prefs[b.dataset.pref]) }))); } }, 'Options ▾'),
    h('div.grow'), h('button.drawer-btn.dr', { title: 'Show the properties panel', onclick: () => setPanel('right') }, 'Properties'), unit, viewSeg, h('button.menu-btn', { onclick: helpDialog, title: 'Keyboard shortcuts (?)' }, '?'));
  const sync = () => {
    undoB.disabled = !canUndo(); redoB.disabled = !canRedo();
    document.querySelectorAll('#topbar .toggle').forEach(b => b.classList.toggle('on', !!S.prefs[b.dataset.pref]));
    viewSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === S.prefs.view));
    if (document.activeElement !== name) name.value = S.doc.name;
    unit.value = S.doc.units;
  };
  on('history', sync); on('prefs', sync); on('load', sync);
  on('saved', kind => { saved.textContent = kind === 'file' ? 'Saved to file' : 'Saved'; saved.title = S.file ? `File: ${S.file.name}` : S.slot ? 'Saving automatically to My projects' : 'Autosaved on this device'; clearTimeout(saved._t); saved._t = setTimeout(() => (saved.textContent = ''), 1800); });
  sync();
}

/** On narrow screens (iPad portrait) the side panels slide over the plan instead of taking room from it. */
export function toggleDrawer(side, open) {
  const app = $('app'), key = 'drawer' + side;
  const v = open ?? !app.classList.contains(key);
  app.classList.remove('drawerleft', 'drawerright');
  app.classList.toggle(key, v);
  placeTabs();
}
// Side panels are either docked (they take room from the plan; closing collapses them) or drawers (they slide over the plan).
const docked = side => !matchMedia('(max-width: 1000px)').matches && (side === 'left' || !matchMedia('(pointer: coarse) and (max-width: 1366px)').matches);
const panelOpen = side => (docked(side) ? !$('app').classList.contains(side + 'closed') : $('app').classList.contains('drawer' + side));
export function setPanel(side, open = !panelOpen(side)) {
  if (docked(side)) { $('app').classList.toggle(side + 'closed', !open); placeTabs(); }
  else toggleDrawer(side, open);
  try { localStorage.setItem('id-closed', ['left', 'right'].filter(s => $('app').classList.contains(s + 'closed')).join(',')); } catch {}
}
const tabs = {};
function placeTabs() {
  if (!tabs.left) return;
  const go = () => {
    const st = $('stage').getBoundingClientRect(), top = st.top + st.height / 2 - tabs.left.offsetHeight / 2;
    for (const side of ['left', 'right']) {
      const t = tabs[side], open = panelOpen(side), p = $(side).getBoundingClientRect(), w = t.offsetWidth;
      t.style.top = top + 'px';
      t.style.left = (side === 'left' ? (open ? p.right : st.left) : (open ? p.left - w : st.right - w)) + 'px';
      t.textContent = (side === 'left') === open ? '‹' : '›';
      t.title = `${open ? 'Hide' : 'Show'} the ${side === 'left' ? 'catalogue and tools' : 'properties'} panel`;
    }
  };
  requestAnimationFrame(go); setTimeout(go, 230); // again once a sliding drawer has settled
}
function buildPanelTabs() {
  for (const side of ['left', 'right']) { tabs[side] = h('button.panel-tab.' + side[0], { onclick: () => setPanel(side) }); document.body.append(tabs[side]); }
  try { for (const s of (localStorage.getItem('id-closed') || '').split(',')) if (s === 'left' || s === 'right') $('app').classList.add(s + 'closed'); } catch {}
  addEventListener('resize', placeTabs); new ResizeObserver(placeTabs).observe($('stage'));
  for (const side of ['left', 'right']) $(side).addEventListener('transitionend', e => e.target === $(side) && e.propertyName === 'transform' && placeTabs());
  placeTabs();
}
const narrow = () => matchMedia('(max-width: 1000px)').matches;
export const isTouch = matchMedia('(pointer: coarse)').matches;

export function setView(v) { $('app').dataset.view = v; setPref('view', v); placeTabs(); }

async function fileMenu(anchor) {
  const r = anchor.getBoundingClientRect(), recents = await recentFiles(), canFile = !!(window.desktop || (window.showSaveFilePicker && !isTouch));
  menu(r.left, r.bottom + 4, [
    { label: 'New empty plan', run: () => confirm('Start a new empty plan? Save the current one first if you want to keep it.') && (setDoc(newDoc()), S.slot = null, S.file = null) },
    { label: 'New from my apartment (980 sq ft)', run: () => confirm('Start a fresh copy of your apartment? Save the current plan first if you want to keep it.') && loadMine().then(() => { S.slot = null; S.file = null; ed.zoomFit(); toast('Your apartment is ready to furnish'); }) },
    '-',
    { label: S.file ? `Save to ${S.file.name}` : S.slot ? 'Save (My projects)' : 'Save…', key: 'Ctrl+S', run: saveSmart },
    canFile ? { label: 'Save as file…', key: 'Ctrl+Shift+S', run: () => saveFile(true) } : { label: 'Save a copy to Files (.json)', run: () => saveFile(true) },
    { label: 'Open file…', key: 'Ctrl+O', run: openProject },
    ...recents.slice(0, 5).map(f => ({ label: `   ${f.name}`, run: () => openRecent(f) })),
    '-',
    { label: S.slot ? 'Save as a new project…' : 'Save to My projects…', run: () => saveToDevice(true) },
    { label: 'My projects & history…', run: projectsDialog },
    { label: 'Back up all projects…', run: backupAll },
    '-',
    { label: 'Load sample apartment', run: () => loadSample().then(() => { S.slot = null; S.file = null; ed.zoomFit(); toast('Sample apartment loaded'); }) },
    { label: 'Import floor plan image to trace…', run: importTrace },
    '-',
    { label: 'Export 2D plan (PNG)', run: () => download(`${S.doc.name}-plan.png`, ed.exportPNG()) },
    { label: 'Export 3D view (PNG)', disabled: !api3d, run: () => { if (S.prefs.view === '2d') setView('split'); setTimeout(() => download(`${S.doc.name}-3d.png`, api3d.snapshot()), 150); } },
    { label: 'Export shopping list (CSV)', run: exportCSV },
    { label: 'Export cable list (CSV)', run: exportCablesCSV },
    { label: 'Print plan', key: 'Ctrl+P', run: printPlan },
  ]);
}

// ------------------------------------------------------------------ saving: files, My projects, history, backups
const fileName = () => `${S.doc.name.replace(/[^\w -]+/g, '').trim() || 'plan'}.interior.json`;
const canPickFiles = () => !!(window.desktop || (window.showSaveFilePicker && !isTouch));
async function recentFiles() { try { return (await kvGet('recentFiles')) || []; } catch { return []; } }
async function remember(f) {
  const list = (await recentFiles()).filter(r => (f.path ? r.path !== f.path : r.name !== f.name));
  try { await kvSet('recentFiles', [{ ...f, t: Date.now() }, ...list].slice(0, 8)); } catch {}
}
/** Ctrl+S: back to the open file; or the open My projects entry (already autosaved); otherwise ask where. */
export async function saveSmart() {
  if (S.file) return saveFile(false);
  if (S.slot) return saveToDevice();
  return canPickFiles() ? saveFile(true) : saveToDevice();
}
/** Save the project as a real file: desktop app / Chrome / Edge write to disk (and Ctrl+S re-saves there); iPad uses the share sheet. */
export async function saveFile(as = false) {
  const data = exportProject(), name = fileName();
  try {
    if (window.desktop) {
      const res = !as && S.file?.path ? await window.desktop.saveFile(S.file.path, data) : await window.desktop.saveFileAs(name, data);
      if (!res) return;
      S.file = { path: res.path, name: res.name }; remember(S.file);
    } else if (window.showSaveFilePicker && !isTouch) {
      let handle = !as && S.file?.handle;
      if (!handle) handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Interior Designer project', accept: { 'application/json': ['.json'] } }] });
      const w = await handle.createWritable(); await w.write(data); await w.close();
      S.file = { handle, name: handle.name }; remember(S.file);
    } else return shareCopy(name, data);
    emit('saved', 'file'); toast(`Saved to ${S.file.name}`);
  } catch (e) { if (e?.name !== 'AbortError') toast('Could not save the file: ' + (e?.message || e), 4000); }
}
/** iPad / other browsers: share sheet (Save to Files, AirDrop, email) or a download. */
async function shareCopy(name, data) {
  if (isTouch && navigator.canShare) {
    const file = new File([data], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: S.doc.name }); toast('Project copy saved'); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
  }
  download(name, data, 'application/json'); toast(isTouch ? 'Saved to Files → Downloads' : 'Project saved to your downloads');
}
export const saveProject = () => saveFile(true);
/** Save into the app's own storage on this device; the entry then keeps itself up to date as you work. */
export async function saveToDevice(asNew = false) {
  let name = S.doc.name;
  if (asNew === true || !S.slot) { name = prompt('Save this project in My projects as:', S.doc.name); if (!name) return; }
  try { const rec = await saveSlot(name.trim(), asNew === true); S.file = null; toast(`Saved “${rec.name}” to My projects. Changes now save automatically.`, 3200); }
  catch { toast('Could not save on this device (storage may be full or blocked in private browsing)', 4000); }
}
async function loadProjectText(text, file) {
  try {
    const { doc, assets } = parseProject(text);
    setDoc(doc, assets); S.slot = null; S.file = file || null; if (file) remember(file);
    ed.zoomFit(); toast(`Opened “${doc.name}”`);
  } catch (e) {
    if (e.backup) { if (confirm(`This is a backup of ${e.backup.projects?.length || 0} projects. Add them to My projects on this device?`)) { const n = await importBackup(e.backup); toast(`Restored ${n} project${n === 1 ? '' : 's'} into My projects`); projectsDialog(); } return; }
    toast('That file is not an Interior Designer project');
  }
}
export async function openProject() {
  try {
    if (window.desktop) { const f = await window.desktop.openFile(); if (f) await loadProjectText(f.text, { path: f.path, name: f.name }); return; }
    if (window.showOpenFilePicker && !isTouch) {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Interior Designer project', accept: { 'application/json': ['.json'] } }] });
      return loadProjectText(await (await handle.getFile()).text(), { handle, name: handle.name });
    }
  } catch (e) { if (e?.name === 'AbortError') return; }
  const f = await pickFile(isTouch ? null : '.json,application/json'); if (!f) return; // iPad Files greys out .json when filtered by type
  loadProjectText(await f.text());
}
async function openRecent(f) {
  try {
    if (f.path && window.desktop) { const r = await window.desktop.readFile(f.path); if (r) return loadProjectText(r.text, { path: f.path, name: f.name }); }
    if (f.handle) {
      if ((await f.handle.queryPermission?.({ mode: 'readwrite' })) !== 'granted' && (await f.handle.requestPermission?.({ mode: 'readwrite' })) !== 'granted') return;
      return loadProjectText(await (await f.handle.getFile()).text(), { handle: f.handle, name: f.name });
    }
  } catch {}
  toast(`Could not open ${f.name}; it may have been moved or deleted`);
}
async function backupAll() {
  const data = await exportBackup(), name = `interior-designer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (window.desktop) { const r = await window.desktop.saveFileAs(name, data); if (r) toast(`Backup saved to ${r.name}`); return; }
  if (window.showSaveFilePicker && !isTouch) {
    try { const hd = await window.showSaveFilePicker({ suggestedName: name }); const w = await hd.createWritable(); await w.write(data); await w.close(); toast(`Backup saved to ${hd.name}`); } catch (e) { if (e?.name !== 'AbortError') toast('Could not save the backup'); }
    return;
  }
  shareCopy(name, data);
}
const when = t => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
async function projectsDialog() {
  const list = await listProjects();
  let close = null;
  const rows = list.length ? list.map(p => h('div.projrow', null,
    h('div', null, h('b', null, p.name, p.id === S.slot ? ' (open now)' : ''), h('div.hint', null, `${when(p.saved)} · ${p.rooms || 0} rooms · ${p.items || 0} pieces${p.snaps?.length ? ` · ${p.snaps.length} versions` : ''}`)),
    h('div.stack', null,
      btn('Open', async () => { try { await openSlot(p.id); S.file = null; ed.zoomFit(); close(); toast(`Opened “${p.name}”`); } catch { toast('That project could not be read'); } }, { cls: 'primary' }),
      p.snaps?.length ? btn('History', () => { close(); historyDialog(p); }) : null,
      btn('Delete', async () => { if (confirm(`Delete “${p.name}” and its history from this device?`)) { await deleteSlot(p.id); close(); projectsDialog(); } }, { cls: 'danger' }))))
    : [h('p.hint', null, 'No saved projects yet. Use File → Save to My projects.')];
  close = dialog('My projects', h('div', null, h('p.hint', null, 'Projects kept on this device. An open project saves itself as you work and keeps a version every 10 minutes (the last 30). Use Back up all projects to move them to another device.'), ...rows),
    [{ label: 'Back up all…', run: backupAll }, { label: 'Save current plan here', run: () => saveToDevice(true) }, { label: 'Close' }]);
}
function historyDialog(p) {
  let close = null;
  const rows = [...(p.snaps || [])].reverse().map(sn => h('div.projrow', null, h('div', null, h('b', null, when(sn.t)), h('div.hint', null, `${sn.items ?? '?'} pieces`)),
    btn('Restore', async () => {
      if (!confirm(`Restore “${p.name}” to ${when(sn.t)}? The current state stays in the history.`)) return;
      try { if (S.slot === p.id) await saveSlot(p.name); await restoreSnapshot(p.id, sn.key); S.file = null; ed.zoomFit(); close(); toast(`Restored the version from ${when(sn.t)}`); } catch { toast('That version could not be read'); }
    })));
  close = dialog(`History: ${p.name}`, h('div', null, h('p.hint', null, 'Versions are kept every 10 minutes of editing.'), ...rows), [{ label: 'Back', run: () => { projectsDialog(); } }, { label: 'Close' }]);
}
async function importTrace() {
  const f = await pickFile('image/*'); if (!f) return;
  const id = uid('as'), c = ed.viewCenter();
  S.assets[id] = { name: f.name, kind: 'image', data: await readAsDataURL(f) };
  const im = new Image(); im.src = S.assets[id].data; await im.decode().catch(() => {});
  const scale = 12 / Math.max(im.naturalWidth || 1000, 1); // start ~12 m wide; calibrate afterwards
  S.doc.trace = { assetId: id, x: c.x - 6, y: c.y - ((im.naturalHeight || 1000) * scale) / 2, scale, opacity: 0.5, visible: true };
  commit(); ed.zoomFit(); select([]);
  toast('Image added. Use “Calibrate scale” so one known dimension matches.', 5000);
}
function exportCSV() {
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['Item', 'Room', 'Width', 'Depth', 'Height', 'Price', 'Link', 'Notes'], ...S.doc.items.filter(i => !['column', 'column_sq', 'stairs'].includes(i.type)).map(i => [i.name, ops.roomAt(i)?.meta.name || '', L(i.w), L(i.d), L(i.h), i.price || '', i.url || '', i.notes || ''])];
  download(`${S.doc.name}-shopping-list.csv`, rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
}
export function printPlan() { const im = $('printimg'); im.onload = () => { print(); im.onload = null; }; im.src = ed.exportPNG(2); }

function helpDialog() {
  const keys = [['V', 'Select / move'], ['W', 'Draw walls'], ['A', 'Curved wall (start, end, then bend)'], ['R', 'Rectangle room'], ['D', 'Door'], ['N', 'Window'], ['M', 'Measure / dimension'], ['T', 'Text label'], ['O', 'Outlet / jack / switch'], ['K', 'Cable run'], ['H or Space-drag', 'Pan'], ['Scroll', 'Zoom'], ['F', 'Zoom to fit'],
    ['Q / E', 'Rotate selection 90° (Shift: 15°, Alt: 1°)'], ['Rotate handle', 'Drag in 1° steps, snapping to the angle of nearby furniture and walls (Shift: 15°, Alt: free)'], ['Arrows', 'Nudge (Shift: larger)'], ['Ctrl+D', 'Duplicate'], ['Ctrl+C / V', 'Copy / paste'], ['Del', 'Delete'], ['Ctrl+Z / Y', 'Undo / redo'], ['Ctrl+S', 'Save (to the open file or project)'], ['Ctrl+Shift+S', 'Save as a file'], ['Ctrl+O', 'Open a file'], ['Ctrl+A', 'Select all furniture'],
    ['G', 'Toggle grid snap'], ['1 / 2 / 3', '2D / split / 3D view'], ['Esc', 'Cancel / deselect'], ['Double-click wall', 'Split wall'], ['Double-click in 3D', 'Zoom in on a piece'], ['Double-click room', 'Rename room'], ['Shift while drawing', 'Lock to 45° steps'], ['Alt while dragging', 'Ignore snapping']];
  const gestures = [['Tap', 'Select (tap again and drag to move)'], ['Drag on the floor', 'Pan the plan (Apple Pencil: box-select)'], ['Pinch', 'Zoom'], ['Two-finger drag', 'Pan while drawing'], ['Long-press', 'Actions menu (split wall, add door, lock…)'],
    ['Double-tap', 'Rename room / split wall / zoom to a piece in 3D'], ['Drawing tools', 'Touch, slide to aim, lift to place; tap ✓ Done to finish'], ['‹ › edge tabs', 'Hide or show the side panels'], ['⇄ on the toolbar', 'Flip a sofa between left- and right-hand facing'], ['☰ Panel / Properties', 'Open the side panels on a narrow screen']];
  dialog('Shortcuts & tips', h('div', null, isTouch && h('h3', null, 'Touch'), isTouch && h('div.keys', null, gestures.map(([k, d]) => [h('kbd', null, k), h('span', null, d)])),
    isTouch && h('h3', null, 'Keyboard'), h('div.keys', null, keys.map(([k, d]) => [h('kbd', null, k), h('span', null, d)])),
    h('p.hint', null, 'While drawing a wall, type a length such as 12\'6" or 3.8m and press Enter to place it exactly. Click a piece to select it; a toolbar appears above it with Move, rotate, centre, duplicate and delete. Drag the Move grip (or the piece itself once selected) to move it. In 3D, switch to Walk and use W A S D, or press Photo render for a path-traced image.')));
}

// ------------------------------------------------------------------ tool rail
const TOOLS = [['select', 'Select (V)'], ['pan', 'Pan (H)'], ['wall', 'Draw walls (W)'], ['arc', 'Curved wall (A)'], ['room', 'Rectangle room (R)'], ['door', 'Door (D)'], ['window', 'Window (N)'], ['measure', 'Measure (M)'], ['label', 'Text label (T)'], ['outlet', 'Outlet / jack / switch (O)'], ['cable', 'Cable run (K)']];
function buildRail() {
  $('rail').replaceChildren(...TOOLS.map(([t, title]) => { const b = h('button', { title, onclick: () => setTool(t) }, icon(t)); b.dataset.tool = t; return b; }));
  const sync = () => $('rail').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  on('tool', sync); sync();
}

// ------------------------------------------------------------------ left panel
let tab = 'furnish', cat = 'All', query = '';
const TABS = [['furnish', 'Furnish'], ['build', 'Build'], ['style', 'Style'], ['power', 'Power'], ['objects', 'Objects'], ['insights', 'Insights']];
function buildLeft() {
  const body = h('div.tab-body');
  const tabs = h('div.tabs', null, TABS.map(([id, label]) => { const b = h('button', { onclick: () => { tab = id; render(); } }, label); b.dataset.tab = id; return b; }));
  $('left').replaceChildren(tabs, body);
  const render = () => {
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const top = body.scrollTop;
    body.replaceChildren(...{ furnish: furnishTab, build: buildTab, style: styleTab, power: powerTab, objects: objectsTab, insights: insightsTab }[tab]());
    body.scrollTop = top;
  };
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(() => { if (!$('left').contains(document.activeElement) || !/color|range|text|search/.test(document.activeElement.type)) render(); }, 60); };
  on('history', later); on('sel', () => (tab === 'objects' || tab === 'style' || tab === 'power') && later()); on('load', later); on('library', render); on('prefs', () => tab === 'insights' && later());
  render();
}

function place(item) { setTool('place', { item }); }

// ------------------------------------------------------------------ electrical: points, cables, cable schedule
function powerTab() {
  const E = elec(), rows = schedule(), FT = 0.3048;
  const tot = {}; for (const r of rows) if (r.L) { const t = (tot[r.kind] ||= { n: 0, m: 0, color: r.color }); t.n++; t.m += r.L.need; }
  return [
    section('Add outlets, jacks and switches', h('div.btnwrap', null, Object.entries(POINT_KINDS).map(([k, d]) => btn(d.name, () => setTool('outlet', { kind: k }), { cls: S.tool === 'outlet' && S.toolOpt.kind === k ? 'on' : '' }))),
      h('p.hint', null, 'Wall points snap to the nearest wall face at their usual height (outlets 12", switches 48"); change it in Properties.')),
    section('Draw a cable run', h('div.btnwrap', null, Object.entries(CABLE_KINDS).map(([k, d]) => h('button' + (S.tool === 'cable' && S.toolOpt.kind === k ? '.on' : ''), { onclick: () => setTool('cable', { kind: k }) }, h('i.swatch', { style: { background: d.color } }), d.name))),
      h('p.hint', null, 'Start on an outlet or a piece of furniture, tap to add bends, finish on the other end. Length counts the drop from each end to the floor (or across a desk) plus slack.')),
    section(`Cable schedule (${rows.length})`,
      rows.length ? h('div.sched', null, rows.map(r => h('button.schedrow' + (isSelC(r.c.id) ? '.on' : ''), { onclick: () => { select([{ k: 'cable', id: r.c.id }]); if (r.L) ed.centerOn(r.L.pts[Math.floor(r.L.pts.length / 2)]); } },
        h('i.swatch', { style: { background: r.color } }), h('span', null, h('b', null, r.c.label || r.kind), h('small', null, `${r.from} → ${r.to}`)),
        h('span.len', null, r.L ? fmtFt(r.L.measured) : '–', h('small', null, r.L ? (r.L.buyFt ? `buy ${r.L.buyFt} ft` : `≈ ${Math.ceil(r.L.need / FT)} ft`) : '')))))
        : h('p.hint', null, 'No cables yet.'),
      Object.keys(tot).length && h('div.kv', null, Object.entries(tot).map(([k, t]) => [h('span', null, h('i.swatch', { style: { background: t.color } }), `${k} × ${t.n}`), h('b', null, `${Math.ceil(t.m / FT)} ft incl. slack`)])),
      h('div.stack', null, btn('Export cable list (CSV)', exportCablesCSV, { disabled: !rows.length }), check('Show electrical layer', S.prefs.showElec !== false, v => setPref('showElec', v)))),
    section(`Points (${E.points.length})`, h('div.list', null, E.points.map(q => h('button.listrow' + (isSel('elec', q.id) ? '.on' : ''), { onclick: () => { select([{ k: 'elec', id: q.id }]); ed.centerOn(q); } },
      `${q.label || POINT_KINDS[q.kind]?.name || q.kind}`, h('small', null, ` ${L(q.z)} high${q.circuit ? ' · ' + q.circuit : ''}`))))),
  ];
}
const isSelC = id => S.sel.some(s => s.k === 'cable' && s.id === id);
function exportCablesCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, FT = 0.3048;
  const rows = [['Label', 'Kind', 'From', 'To', 'Route', 'Measured (ft)', 'Measured (m)', 'Slack %', 'Needed (ft)', 'Buy (ft)'],
    ...schedule().map(r => [r.c.label, r.kind, r.from, r.to, r.route, r.L && (r.L.measured / FT).toFixed(1), r.L && r.L.measured.toFixed(2), Math.round((r.c.slack ?? 0.15) * 100), r.L && (r.L.need / FT).toFixed(1), r.L?.buyFt ?? (r.L && Math.ceil(r.L.need / FT))])];
  download(`${S.doc.name}-cables.csv`, rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
}
// ---- modular sofa editor: rearrange the pieces on a grid ----
let modCell = null;
const MOD_PRESETS = {
  'U-shape (as shipped)': [[0, 0, 'seat', 0], [1, 0, 'seat', 0], [2, 0, 'seat', 0], [3, 0, 'seat', 0], [0, 1, 'ottoman', 0], [3, 1, 'ottoman', 0]],
  'Sofa + double chaise': [[0, 0, 'seat', 0], [1, 0, 'seat', 0], [2, 0, 'seat', 0], [3, 0, 'seat', 0], [3, 1, 'ottoman', 0], [3, 2, 'ottoman', 0]],
  'Long sofa, ottomans in front': [[0, 0, 'seat', 0], [1, 0, 'seat', 0], [2, 0, 'seat', 0], [3, 0, 'seat', 0], [1, 1, 'ottoman', 0], [2, 1, 'ottoman', 0]],
  'L-shape + ottoman': [[0, 0, 'seat', 0], [1, 0, 'seat', 0], [2, 0, 'seat', 0], [0, 1, 'seat', 3], [1, 1, 'ottoman', 0], [0, 2, 'ottoman', 0]],
  'Two loveseats facing': [[0, 0, 'seat', 0], [1, 0, 'seat', 0], [0, 1, 'ottoman', 0], [1, 1, 'ottoman', 0], [0, 2, 'seat', 2], [1, 2, 'seat', 2]],
  'Pit / daybed': [[0, 0, 'seat', 0], [1, 0, 'seat', 0], [0, 1, 'ottoman', 0], [1, 1, 'ottoman', 0], [0, 2, 'seat', 2], [1, 2, 'seat', 2]],
};
/** Replace the pieces; resize the footprint to the real pieces and keep the ones that stay where they are on the plan. */
function setModules(it, def, mods) {
  if (!mods.length) { toast('A sofa needs at least one piece'); return; }
  const before = moduleLayout(it), sx = it.w / before.W, sz = it.d / before.D;
  const after = moduleLayout({ ...it, modules: mods });
  const key = m => m.x + ',' + m.y, old = new Map(before.info.map(i => [key(i.m), i])), keep = after.info.find(i => old.has(key(i.m)));
  const o = keep ? old.get(key(keep.m)) : { cx: 0, cz: 0 }, n = keep || { cx: 0, cz: 0 };
  const shift = rot({ x: (o.cx - n.cx) * sx, y: (o.cz - n.cz) * sz }, it.rot);
  it.modules = mods; it.w = after.W * sx; it.d = after.D * sz; it.x += shift.x; it.y += shift.y;
  commit();
}
function moduleEditor(it, def) {
  const mods = it.modules || [], B = moduleBounds(mods), at = (x, y) => mods.find(m => m.x === x && m.y === y);
  const arrow = ['↓', '←', '↑', '→'], count = t => mods.filter(m => m.t === t).length;
  const sel = modCell && at(modCell.x, modCell.y);
  const grid = h('div.modgrid', { style: { gridTemplateColumns: `repeat(${B.x1 - B.x0 + 3}, 1fr)` } });
  for (let y = B.y0 - 1; y <= B.y1 + 1; y++) for (let x = B.x0 - 1; x <= B.x1 + 1; x++) {
    const m = at(x, y), on = modCell && modCell.x === x && modCell.y === y;
    grid.append(h('button.modcell' + (m ? '.' + m.t : '.empty') + (on ? '.on' : ''), { title: m ? MODULE_TYPES[m.t] : 'Empty: tap, then add a piece', onclick: () => { modCell = { x, y }; emit('sel'); } },
      m ? (m.t === 'ottoman' ? '▢' : (m.t === 'corner' ? '◰ ' : '') + arrow[m.r]) : '+'));
  }
  const put = (t) => { if (!modCell) return toast('Tap a square in the grid first'); const rest = mods.filter(m => !(m.x === modCell.x && m.y === modCell.y)); setModules(it, def, [...rest, { x: modCell.x, y: modCell.y, t, r: sel?.r ?? 0 }]); };
  return section('Pieces',
    h('p.hint', null, 'Tap a square, then choose what goes there. Arrows show which way each seat faces (↓ = toward the front of the sofa).'),
    grid,
    h('div.btnwrap', null, btn('Seat', () => put('seat')), btn('Corner seat', () => put('corner')), btn('Ottoman', () => put('ottoman')),
      btn('Rotate ⟳', () => { if (!sel) return toast('Tap a piece first'); setModules(it, def, mods.map(m => (m === sel ? { ...m, r: (m.r + 3) % 4 } : m))); }, { disabled: !sel || sel.t === 'ottoman' }),
      btn('Remove', () => { if (!sel) return; modCell = null; setModules(it, def, mods.filter(m => m !== sel)); }, { disabled: !sel, cls: 'danger' })),
    row('Layout', selectInput([['', 'Choose a layout…'], ...Object.keys(MOD_PRESETS).map(k => [k, k])], '', v => { if (!v) return; modCell = null; setModules(it, def, MOD_PRESETS[v].map(([x, y, t, r]) => ({ x, y, t, r }))); })),
    check('Arms on open ends', it.arms !== false, v => { const L0 = moduleLayout(it), sx = it.w / L0.W, sz = it.d / L0.D; it.arms = v; const L1 = moduleLayout(it); it.w = L1.W * sx; it.d = L1.D * sz; commit(); }),
    h('p.hint', null, `Uses ${count('seat') + count('corner')} seat${count('seat') + count('corner') === 1 ? '' : 's'}${count('corner') ? ` (${count('corner')} corner)` : ''} and ${count('ottoman')} ottoman${count('ottoman') === 1 ? '' : 's'}: ${L(it.w)} × ${L(it.d)}. The set comes with 4 seats and 2 ottomans${count('seat') + count('corner') > 4 || count('ottoman') > 2 || count('corner') ? '; this layout needs extra or different pieces' : ''}.`));
}

function pointProps(q) {
  const k = POINT_KINDS[q.kind] || POINT_KINDS.outlet;
  return [h('h2', null, k.name),
    section(null, row('Type', selectInput(Object.entries(POINT_KINDS).map(([id, d]) => [id, d.name]), q.kind, edit(v => (q.kind = v)))),
      row('Label', textInput(q.label, edit(v => (q.label = v)), { placeholder: 'e.g. TV wall, desk left' })),
      row('Height', lenInput(q.z, edit(v => (q.z = Math.max(0, v))))),
      row('Circuit', textInput(q.circuit, edit(v => (q.circuit = v)), { placeholder: 'e.g. Breaker 7' })),
      h('p.hint', null, k.wall ? 'Centre height above the floor. Drag the point to slide it along the wall or onto another wall.' : 'Height of the point above the floor.'),
      check('Lock position', q.locked, edit(v => (q.locked = v)))),
    section('Cables', (() => { const cs = elec().cables.filter(c => c.from?.point === q.id || c.to?.point === q.id);
      return cs.length ? cs.map(c => h('div.kv', null, h('span', null, CABLE_KINDS[c.kind]?.name), h('b', null, fmtFt(cableLength(c)?.measured || 0)))) : h('p.hint', null, 'No cables to this point yet.'); })(),
      btn('Start a cable here', () => setTool('cable', { kind: q.kind === 'data' ? 'ethernet' : q.kind === 'hdmi' ? 'hdmi' : 'power' }))),
    btn('Delete', ops.deleteSelection, { cls: 'danger' })];
}
function cableProps(c) {
  const Lc = cableLength(c), FT = 0.3048, endRow = (lab, end, z) => end?.item ? row(lab + ' height', lenInput(end.z ?? z ?? 0, edit(v => (end.z = Math.max(0, v))))) : null;
  return [h('h2', null, c.label || CABLE_KINDS[c.kind]?.name || 'Cable'),
    Lc && section(null, h('div.kv', null, h('span', null, 'From'), h('b', null, Lc.a.label), h('span', null, 'To'), h('b', null, Lc.b.label),
      h('span', null, 'Measured'), h('b', null, `${fmtFt(Lc.measured)} (${Lc.measured.toFixed(2)} m)`), h('span', null, 'With slack'), h('b', null, fmtFt(Lc.need)),
      h('span', null, 'Buy'), h('b', null, Lc.buyFt ? `${Lc.buyFt} ft cable` : `${Math.ceil(Lc.need / FT)} ft (by the foot)`))),
    section(null, row('Kind', selectInput(Object.entries(CABLE_KINDS).map(([id, d]) => [id, d.name]), c.kind, edit(v => (c.kind = v)))),
      row('Route', selectInput(Object.entries(ROUTES), c.route || 'floor', edit(v => (c.route = v)))),
      row('Slack', numInput(Math.round((c.slack ?? 0.15) * 100), edit(v => (c.slack = Math.max(0, v) / 100)), { step: 5, min: 0 }), h('span.unit', null, '%')),
      endRow('Start', c.from, Lc?.a.z), endRow('End', c.to, Lc?.b.z),
      row('Label', textInput(c.label, edit(v => (c.label = v)), { placeholder: 'e.g. TV power, desk to router' })),
      h('p.hint', null, 'Along the floor: drops from each end to the floor and back up. Across a surface: stays at desk height. Furniture ends start near the base of the piece; set the height where its port is.')),
    btn('Delete', ops.deleteSelection, { cls: 'danger' })];
}
function card(item, label, sub, onRemove, onClick) {
  return h('button.card', { title: `${label} — ${sub}`, onclick: onClick || (() => place({ ...item, id: uid('it') })) }, thumbnail(item, 60), h('b', null, label), h('small', null, sub),
    onRemove && h('span.rm', { title: 'Remove from library', onclick: e => { e.stopPropagation(); onRemove(); } }, '×'));
}
function furnishTab() {
  const cats = ['All', ...CATEGORIES, ...(S.library.length ? ['My library'] : [])];
  const grid = h('div.grid');
  const fill = () => {
    const q = query.trim().toLowerCase(), out = [];
    if (cat === 'All' || cat === 'My library') for (const [i, e] of S.library.entries()) {
      if (q && !e.tpl.name.toLowerCase().includes(q)) continue;
      out.push(card(e.tpl, e.tpl.name, `${L(e.tpl.w)} × ${L(e.tpl.d)}`, () => { S.library.splice(i, 1); saveLibrary(); emit('library'); },
        () => { if (e.asset) S.assets[e.tpl.assetId] ??= e.asset; place({ ...e.tpl, id: uid('it') }); }));
    }
    if (cat !== 'My library') for (const d of CATALOG) {
      if (d.hidden || (cat !== 'All' && d.cat !== cat) || (q && !`${d.name} ${d.cat}`.toLowerCase().includes(q))) continue;
      out.push(card(ops.makeItem(d.id), d.name, `${L(d.w)} × ${L(d.d)}`));
    }
    grid.replaceChildren(...(out.length ? out : [h('p.hint', null, 'Nothing matches. Try “Custom shape” below to make your own piece.')]));
  };
  const chips = h('div.chips', null, cats.map(c => h('button' + (c === cat ? '.on' : ''), { onclick: e => { cat = c; chips.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); fill(); } }, c)));
  fill();
  return [
    h('input.search', { type: 'search', placeholder: 'Search furniture…', value: query, oninput: e => { query = e.target.value; fill(); } }), chips, grid,
    section('Add your own',
      h('div.stack', null, btn('＋ Custom shape', customDialog, { title: 'A box, cylinder or L-shape at any size' }),
        btn('＋ Product from the web', productDialog, { title: 'Paste a product link, photo and dimensions' }),
        btn('＋ Import 3D model', modelDialog, { title: 'GLB / glTF / OBJ file or direct link' }),
        btn('★ Browse free realistic 3D models', libraryDialog, { cls: 'primary', title: 'Poly Haven library — detailed, textured models, free to use' }),
        btn('★ Search Sketchfab models', sketchfabDialog, { cls: 'primary', title: 'A very large library of downloadable models: modern furniture, desk setups, appliances' })),
      h('p.hint', null, 'Click a piece, then click on the plan to place it. Shift-click places several in a row. Desk-setup pieces land on the desk or shelf under them and move with it.')),
  ];
}

function buildTab() {
  const s = S.doc.settings, t = S.doc.trace;
  const door = (label, o) => btn(label, () => setTool('door', o)), win = (label, o) => btn(label, () => setTool('window', o));
  return [
    section('Walls & rooms',
      h('div.stack', null, btn('Draw walls', () => setTool('wall'), { cls: 'primary' }), btn('Curved wall', () => setTool('arc')), btn('Rectangle room', () => setTool('room')), btn('L-shaped room', () => insertShape('L')), btn('U-shaped room', () => insertShape('U')), btn('Round room', () => insertShape('O'))),
      h('p.hint', null, 'Snaps: corners (□), wall midpoints (△), wall faces (○) and pink alignment guides. Furniture snaps to the centre line between walls while you drag it.'),
      row('New wall thickness', lenInput(s.wallThickness, edit(v => (s.wallThickness = Math.max(0.02, v))))),
      row('Wall height', lenInput(s.wallHeight, edit(v => { s.wallHeight = Math.max(0.5, v); S.doc.walls.forEach(w => (w.height = s.wallHeight)); }), false)),
      row('Snap increment', selectInput(units() === 'imperial' ? [['0.0127', '½ inch'], ['0.0254', '1 inch'], ['0.0762', '3 inches'], ['0.1524', '6 inches'], ['0.3048', '1 foot']] : [['0.01', '1 cm'], ['0.05', '5 cm'], ['0.1', '10 cm'], ['0.5', '50 cm']], String(s.snap), edit(v => (s.snap = +v))))),
    section('Doors', h('div.stack', null, door('Single door', { style: 'single', width: 0.81 }), door('Double door', { style: 'double', width: 1.52 }), door('Sliding glass', { style: 'sliding', width: 1.83 }), door('Bifold closet', { style: 'bifold', width: 1.22 }), door('Cased opening', { style: 'opening', width: 1.0, height: 2.1 }))),
    section('Windows', h('div.stack', null, win('Standard', { style: 'standard', width: 1.2, height: 1.2, sill: 0.9 }), win('Picture', { style: 'picture', width: 1.8, height: 1.4, sill: 0.75 }), win('Floor-to-ceiling', { style: 'picture', width: 1.5, height: 2.2, sill: 0.08 }), win('High / small', { style: 'standard', width: 0.7, height: 0.5, sill: 1.5 }), win('Window wall pane', { style: 'curtain', width: 1.15, height: 1.98, sill: 0.5 }))),
    section('Trace a floor plan image',
      t ? [row('Visible', check('', t.visible, edit(v => (t.visible = v)))),
        row('Opacity', h('input', { type: 'range', min: 0.05, max: 1, step: 0.05, value: t.opacity, oninput: e => { t.opacity = +e.target.value; touch(); }, onchange: () => commit() })),
        h('div.stack', null, btn('Calibrate scale', () => { t.visible = true; setTool('calibrate'); }, { title: 'Click two points a known distance apart' }), btn('Replace…', importTrace), btn('Remove', edit(() => (S.doc.trace = null))))]
        : [h('p.hint', null, 'Import a scan, photo or listing floor plan, set its scale, then draw walls over it.'), btn('Import image…', importTrace)]),
  ];
}

function insertShape(kind) {
  const c = ed.viewCenter(), ft = 0.3048, P = (x, y) => ({ x: c.x + x * ft, y: c.y + y * ft });
  if (kind === 'O') {
    const n = 32, r = 6 * ft, walls = ops.addPolyWalls(Array.from({ length: n }, (_, i) => ({ x: c.x + r * Math.cos((i / n) * Math.PI * 2), y: c.y + r * Math.sin((i / n) * Math.PI * 2) })), true);
    select(walls.map(w => ({ k: 'wall', id: w.id }))); setTool('select'); toast('Round room added'); return;
  }
  const pts = kind === 'L' ? [P(-8, -7), P(2, -7), P(2, 0), P(8, 0), P(8, 7), P(-8, 7)] : [P(-9, -7), P(-3, -7), P(-3, 0), P(3, 0), P(3, -7), P(9, -7), P(9, 7), P(-9, 7)];
  const walls = pts.map((p, i) => ops.addWall(p, pts[(i + 1) % pts.length]));
  select(walls.map(w => ({ k: 'wall', id: w.id }))); commit(); setTool('select');
  toast('Room added — drag corners or walls to reshape it');
}

function styleTab() {
  const rooms = selOf('room');
  return [
    section('Style palettes', h('p.hint', null, 'Recolour walls, floors and furniture together. Undo restores the previous look.'),
      h('div.palettes', null, PALETTES.map(p => h('button.palette', { onclick: () => { ops.applyPalette(p); toast(`${p.name} palette applied`); } },
        h('div.chipsrow', null, [p.wall, p.wood, ...p.fabric, p.accent[0], p.accent[1]].map(c => h('i', { style: { background: c } }))), h('b', null, p.name))))),
    section(rooms.length ? `Floor — ${rooms.map(r => r.meta.name).join(', ')}` : 'Floor finishes',
      rooms.length ? null : h('p.hint', null, 'Select a room on the plan (click its floor) to change its finish, or apply one to every room.'),
      h('div.floors', null, FLOORS.map(f => { const b = h('button' + (rooms.length && rooms.every(r => r.meta.floor === f.id) ? '.on' : ''), { title: f.name, onclick: () => {
        if (!rooms.length && !confirm(`Apply ${f.name} to every room?`)) return;
        (rooms.length ? rooms.map(r => r.meta) : S.doc.roomMeta).forEach(m => (m.floor = f.id)); commit(); } }, h('span', null, f.name));
        b.style.backgroundImage = `url(${floorCanvas(f.id).toDataURL()})`; return b; }))),
    section('Wall paint', row('All walls', colorInput(S.doc.settings.wallColor, live(v => (S.doc.settings.wallColor = v)), edit(v => { S.doc.settings.wallColor = v; S.doc.walls.forEach(w => delete w.color); }))),
      h('p.hint', null, 'Select individual walls to paint an accent wall.')),
  ];
}

function focusOn(e, p) { select([e]); if (p) ed.centerOn(p); }
function objectsTab() {
  const d = S.doc, groups = new Map(S.rooms.map(r => [r.id, []])), loose = [];
  for (const it of d.items) { const r = ops.roomAt(it); (r ? groups.get(r.id) : loose).push(it); }
  const itemRow = it => h('div.obj' + (S.sel.some(s => s.id === it.id) ? '.on' : ''), { onclick: () => focusOn({ k: 'item', id: it.id }, it) },
    h('i.dot', { style: { background: it.color } }), h('span', null, it.name), h('small', null, `${L(it.w)} × ${L(it.d)}`),
    h('button.mini', { title: it.locked ? 'Unlock' : 'Lock in place', onclick: e => { e.stopPropagation(); it.locked = !it.locked; commit(); } }, it.locked ? '🔒' : '·'));
  return [
    h('p.hint', null, `${S.rooms.length} rooms · ${d.items.length} objects · ${d.walls.length} walls`),
    ...S.rooms.map(r => section(null, h('div.obj.head' + (S.sel.some(s => s.id === r.id) ? '.on' : ''), { onclick: () => focusOn({ k: 'room', id: r.id }, r.c) }, h('b', null, r.meta.name), h('small', null, fmtArea(r.area, units()))), groups.get(r.id).map(itemRow))),
    loose.length ? section('Outside rooms', loose.map(itemRow)) : null,
    d.labels.length + d.dims.length ? section('Annotations', d.labels.map(l => h('div.obj', { onclick: () => focusOn({ k: 'label', id: l.id }, l) }, h('span', null, `“${l.text}”`))), d.dims.map(m => h('div.obj', { onclick: () => focusOn({ k: 'dim', id: m.id }, m.a) }, h('span', null, `Dimension ${L(dist(m.a, m.b))}`)))) : null,
  ];
}

function insightsTab() {
  const a = analyze(), d = S.doc;
  const lv = { bad: '⛔', warn: '⚠️', info: 'ℹ️' };
  return [
    h('div.stats', null, [[fmtArea(a.totalArea, units()), 'floor area'], [S.rooms.length, 'rooms'], [d.items.length, 'objects'], [fmtMoney(a.budget), 'budget']].map(([v, l]) => h('div', null, h('b', null, v), h('small', null, l)))),
    section('Space utilisation', h('p.hint', null, 'Share of each room’s floor covered by furniture. Roughly 20–35 % feels furnished but easy to move through.'),
      a.rooms.length ? a.rooms.map(r => h('div.util', { onclick: () => focusOn({ k: 'room', id: r.room.id }, r.room.c) }, h('div', null, h('span', null, r.room.meta.name), h('small', null, `${Math.round(r.pct * 100)} % · ${r.verdict}`)),
        h('div.bar', null, h('i', { style: { width: Math.min(100, r.pct * 200) + '%', background: r.pct > 0.5 ? '#e2493b' : r.pct > 0.33 ? '#f0ad30' : '#4fae6b' } })))) : h('p.hint', null, 'Draw a closed room to see its stats.')),
    section('Layout checks',
      h('div.stack', null, check('Walkway width map', S.prefs.showClear, v => setPref('showClear', v)), check('Outline problem pieces', S.prefs.showIssues, v => setPref('showIssues', v))),
      S.prefs.showClear ? h('div.legend', null, h('i', { style: { background: '#e2493b' } }), 'under 24" / 60 cm', h('i', { style: { background: '#f0ad30' } }), 'tight', h('i', { style: { background: '#56b26c' } }), 'comfortable') : null,
      a.issues.length ? a.issues.map(i => h('div.issue.' + i.level, { onclick: () => { select(i.sel); const it = find('item', i.sel[0].id); it && ed.centerOn(it); } }, h('span', null, lv[i.level]), i.msg)) : h('p.ok', null, '✓ No collisions, blocked doors or clearance problems found.')),
    section('Shopping list', a.priced.length ? [...a.priced.map(it => h('div.obj', { onclick: () => focusOn({ k: 'item', id: it.id }, it) }, h('span', null, it.name), it.url && h('a', { href: it.url, target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, 'link ↗'), h('small', null, it.price ? fmtMoney(it.price) : '—'))),
      h('div.obj.head', null, h('b', null, 'Total'), h('small', null, fmtMoney(a.budget)))] : h('p.hint', null, 'Add a price or product link to any piece (in its properties) and it shows up here.'),
      btn('Export CSV', exportCSV)),
  ];
}

// ------------------------------------------------------------------ add-your-own dialogs
function dimsFields(o, small = true) {
  return h('div.dims3', null, ...[['w', 'Width'], ['d', 'Depth'], ['h', 'Height']].map(([k, lab]) => h('label', null, lab, lenInput(o[k], v => (o[k] = Math.max(0.01, v)), small))));
}
function customDialog() {
  const o = { type: 'box', name: 'Custom piece', w: 1, d: 0.6, h: 0.8, color: '#b9b2a6', elev: 0 };
  dialog('Custom shape', h('div.form', null,
    row('Name', textInput(o.name, v => (o.name = v))),
    row('Shape', selectInput([['box', 'Box'], ['cyl', 'Cylinder / round'], ['lshape', 'L-shape']], o.type, v => (o.type = v))),
    dimsFields(o), row('Height off floor', lenInput(0, v => (o.elev = v))),
    row('Colour', h('input', { type: 'color', value: o.color, oninput: e => (o.color = e.target.value) }))),
    [{ label: 'Place on plan', primary: true, run: () => place(ops.makeItem(o.type, o)) }]);
}
function productDialog() {
  const o = { name: '', url: '', image: '', price: '', w: 1, d: 0.6, h: 0.8, color: '#d8d3c8', lib: false };
  let upload = null;
  dialog('Product from the web', h('div.form', null,
    h('p.hint', null, 'Found something at a store? Paste its details to get a true-to-size stand-in you can lay out, with the link and price tracked in your shopping list.'),
    row('Name', textInput('', v => (o.name = v), { placeholder: 'e.g. Walnut 3-seat sofa' })),
    row('Product link', textInput('', v => (o.url = v), { placeholder: 'https://…', type: 'url' })),
    row('Photo URL', textInput('', v => (o.image = v), { placeholder: 'Right-click the photo → Copy image address' })),
    row('…or upload', h('input', { type: 'file', accept: 'image/*', onchange: e => (upload = e.target.files[0]) })),
    dimsFields(o), row('Price', numInput('', v => (o.price = v), { step: 0.01, min: 0 })),
    check('Also save to My library', false, v => (o.lib = v))),
    [{ label: 'Place on plan', primary: true, run: async () => {
      const { lib, ...rest } = o, it = ops.makeItem('product', { ...rest, name: o.name || 'Product' });
      if (upload) { it.assetId = uid('as'); S.assets[it.assetId] = { name: upload.name, kind: 'image', data: await readAsDataURL(upload) }; it.image = ''; }
      if (lib) addToLibrary(it);
      place(it);
    } }]);
}
function modelDialog() {
  let file = null, url = '';
  dialog('Import a 3D model', h('div.form', null,
    h('p.hint', null, 'Use any GLB, glTF (single-file) or OBJ model. Free furniture models are available from sites such as Poly Pizza, Sketchfab (downloadable models), Kenney and many manufacturers’ “3D / CAD download” pages.'),
    row('Model file', h('input', { type: 'file', accept: '.glb,.gltf,.obj', onchange: e => (file = e.target.files[0]) })),
    row('…or direct URL', textInput('', v => (url = v), { placeholder: 'https://…/chair.glb', type: 'url' })),
    h('p.hint', null, 'The model is scaled to real size automatically; adjust its width, depth and height afterwards in the properties panel.')),
    [{ label: 'Import', primary: true, run: async () => {
      if (!api3d) { toast('The 3D engine is not loaded (are you offline?)'); return false; }
      try {
        let blob = file, name = file?.name;
        if (!blob && url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status); blob = await r.blob(); name = url.split('/').pop().split('?')[0]; }
        if (!blob) { toast('Choose a file or enter a URL'); return false; }
        const ext = (name.match(/\.(glb|gltf|obj)$/i)?.[1] || 'glb').toLowerCase(), id = uid('as');
        S.assets[id] = { name, kind: ext, data: await readAsDataURL(blob) };
        const m = await api3d.measureModel(id);
        S.assets[id].thumb = m.thumb;
        place(ops.makeItem('model', { assetId: id, name: name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' '), w: m.w, d: m.d, h: m.h }));
        toast(`Imported at ${L(m.w)} × ${L(m.d)} × ${L(m.h)} — click to place`);
      } catch (e) { toast(url ? 'Could not download that URL (the site may block cross-site requests). Download the file and import it instead.' : 'That model could not be read.', 5000); return false; }
    } }]);
}
function addToLibrary(it) {
  const { id, x, y, rot, locked, ...tpl } = it;
  S.library.push({ tpl: { ...tpl, x: 0, y: 0, rot: 0 }, asset: it.assetId ? S.assets[it.assetId] : null });
  saveLibrary(); emit('library'); toast('Saved to My library');
}

// a lamp's or fixture's light: on/off, colour (white temperatures or any RGB), brightness and effects
const EFFECTS = [['static', 'Steady'], ['breathe', 'Breathe (slow pulse)'], ['flicker', 'Candle flicker'], ['cycle', 'Colour cycle'], ['rainbow', 'Rainbow wave (strips)']];
function lightSection(it, def) {
  const L = lightOf(it), set = patch => (it.light = { ...it.light, ...patch });
  return section('Light',
    check('On', L.on, edit(v => set({ on: v }))),
    h('div.presets.retail', null, h('span', null, 'White'), KELVIN.map(([k, c, n]) => h('button.named', { title: `${k} K`, onclick: edit(() => set({ color: c })) }, h('i', { style: { background: c } }), n))),
    row('Colour', colorInput(L.color, live(v => set({ color: v })), edit(v => set({ color: v })))),
    row('Brightness', numInput(L.lm, edit(v => set({ lm: Math.max(0, v) })), { min: 0, max: 20000, step: 50 }), h('small', null, ' lumens')),
    row('Effect', selectInput(EFFECTS, L.effect, edit(v => set({ effect: v })))),
    L.effect !== 'static' && row('Speed', h('input', { type: 'range', min: 0.2, max: 4, step: 0.1, value: L.speed, oninput: e => { set({ speed: +e.target.value }); touch(); }, onchange: () => commit() })),
    def.light.kind === 'strip' && row('Shines', selectInput([['up', 'Up (cove, top of a cabinet)'], ['down', 'Down (under a cabinet or shelf)'], ['back', 'Back (behind a TV or desk)'], ['front', 'Forward']], L.face || 'up', edit(v => set({ face: v })))),
    h('p.hint', null, def.light.kind === 'strip' ? 'Stretch the strip to its real length; set its height off the floor to mount it under a cabinet or up in a cove.' : 'A 60 W bulb gives about 800 lumens. Lights brighten as the sun goes down; the Lights switch in the 3D bar turns them all on or off.'));
}

// ------------------------------------------------------------------ properties inspector
function itemProps(items) {
  const it = items[0], def = getDef(it.type), many = items.length > 1;
  const all = fn => v => items.forEach(i => fn(i, v));
  if (many) return [
    h('h2', null, `${items.length} objects`),
    section('Arrange', h('div.btnrow', null, [['left', '⇤', 'Align left'], ['hcenter', '↔', 'Centre horizontally'], ['right', '⇥', 'Align right'], ['top', '⤒', 'Align top'], ['vcenter', '↕', 'Centre vertically'], ['bottom', '⤓', 'Align bottom']].map(([m, g, t]) => btn(g, () => ops.alignItems(m), { title: t }))),
      h('div.stack', null, btn('Distribute ↔', () => ops.alignItems('disth'), { disabled: items.length < 3 }), btn('Distribute ↕', () => ops.alignItems('distv'), { disabled: items.length < 3 }))),
    section('Colour', colorInput(it.color, live(all((i, v) => (i.color = v))), edit(all((i, v) => (i.color = v))))),
    section(null, h('div.stack', null, btn('Rotate 90°', () => ops.rotateSelection(90)), btn('Duplicate', ops.duplicateSelection), btn('Delete', ops.deleteSelection, { cls: 'danger' }))),
  ];
  return [
    h('h2', null, def.cat === 'Custom' ? 'Custom piece' : def.name),
    section(null, row('Name', textInput(it.name, edit(v => (it.name = v || def.name)))),
      def.sizes && row('Standard size', selectInput([['', 'Custom'], ...def.sizes.map((s, i) => [String(i), s[0]])], String(def.sizes.findIndex(s => Math.abs(s[1] - it.w) < 0.02 && Math.abs(s[2] - it.d) < 0.02)).replace('-1', ''), edit(v => { if (v !== '') { it.w = def.sizes[v][1]; it.d = def.sizes[v][2]; if (def.sizes[v][3]) it.h = def.sizes[v][3]; } }))),
      row('Width', lenInput(it.w, edit(v => (it.w = Math.max(0.02, v))))), row('Depth', lenInput(it.d, edit(v => (it.d = Math.max(0.02, v))))), row('Height', lenInput(it.h, edit(v => { const on = ops.riders([it]); it.h = Math.max(0.002, v); on.forEach(r => (r.elev = ops.surfaceUnder(r))); }))),
      row('Off floor', lenInput(it.elev || 0, edit(v => { const on = ops.riders([it]), by = Math.max(0, v) - (it.elev || 0); it.elev = Math.max(0, v); on.forEach(r => (r.elev += by)); }))),
      row('Rotation', numInput(Math.round(it.rot * 10) / 10, edit(v => (it.rot = normDeg(v))), { step: 1 }), h('span.unit', null, '°'))),
    section('Position', (() => {
        const g = ops.itemGaps(it), f = (lab, side) => isFinite(g[side]) && h('label', null, lab, lenInput(Math.max(0, g[side]), v => ops.setItemGap(it, side, v)));
        return [h('div.stack', null, btn('Centre ↔', () => ops.centerItems('x'), { title: 'Centre between the walls to its left and right' }), btn('Centre ↕', () => ops.centerItems('y'), { title: 'Centre between the walls in front and behind' }), btn('Centre both', () => ops.centerItems('both'))),
          h('div.dims4', null, f('Left gap', 'left'), f('Right gap', 'right'), f('Back gap', 'back'), f('Front gap', 'front')),
          h('p.hint', null, 'Gaps are the clear distance to the facing wall. Type a value to position the piece exactly.')];
      })()),
    def.note && h('p.hint.note', null, def.note),
    def.modular && !many && moduleEditor(it, def),
    def.hand && section('Chaise side', h('div.seg2', null, [['left', 'Left-hand facing'], ['right', 'Right-hand facing']].map(([v, l]) =>
      h('button' + (ops.handOf(it) === v ? '.on' : ''), { onclick: () => ops.setHand([it], v) }, l))), h('p.hint', null, 'As you face the front of the sofa: right-hand facing has the chaise on your right.')),
    section('Finish', row(def.color2 ? 'Main' : 'Colour', colorInput(it.color, live(v => (it.color = v)), edit(v => (it.color = v)))),
      def.colors?.length && h('div.presets.retail', null, h('span', null, 'Retailer colours'), def.colors.map(([n, c]) => h('button.named', { title: n, onclick: edit(() => { it.color = c; if (def.color2 === def.color) it.color2 = c; it.colorName = n; }) }, h('i', { style: { background: c } }), n))),
      def.mat === 'cab' && check('Flat-panel doors (modern)', it.slab, edit(v => (it.slab = v))),
      (it.type === 'basecab' || it.type === 'sinkcab') && check('Drawer above the doors', it.drawerTop, edit(v => (it.drawerTop = v))),
      def.heights && h('div.presets.retail', null, h('span', null, def.heightLabel || 'Desk height'), def.heights.map(([n, v]) => h('button.named', { onclick: edit(() => { const on = ops.riders([it]); it.h = v; on.forEach(r => (r.elev = ops.surfaceUnder(r))); }) }, n))),
      def.pots && h('div.presets.retail', null, h('span', null, 'Pot'), def.pots.map(([n, c]) => h('button.named', { onclick: edit(() => (it.color2 = c)) }, h('i', { style: { background: c } }), n))),
      def.bedD && check('Opened as a bed', it.bed, edit(v => { it.bed = v; it.d = v ? def.bedD : def.d; })),
      def.shelfOpt && check('Lower shelf', it.shelf, edit(v => (it.shelf = v))),
      it.type === 'tube_coffee' && check('LED lights under the base', it.led, edit(v => (it.led = v))),
      it.type === 'allewie_bed' && check('Show mattress', !it.noMattress, edit(v => (it.noMattress = !v))),
      it.type === 'shintenchi_island' && check('Leaf raised', it.leafDown !== true, edit(v => (it.leafDown = !v))),
      it.type !== 'model' && !(it.tex ?? def.tex) && h('div.presets', null, h('span', null, 'Wood'), WOODS.map(([n, c]) => h('button', { title: n, style: { background: c }, onclick: edit(() => { if (def.mat === 'bed' || def.mat === 'fabric') it.color2 = c; else it.color = c; it.grain = true; }) }))),
      it.type !== 'model' && !(it.tex ?? def.tex) && check('Show wood grain in 3D', it.grain, edit(v => (it.grain = v))),
      (it.tex ?? def.tex) && row('Surface', selectInput(WALL_FINISHES.filter(f => f.id !== 'paint').map(f => [f.id, f.name]), it.tex ?? def.tex, edit(v => (it.tex = v)))),
      def.mat === 'cab' && def.color2 && h('div.presets', null, h('span', null, 'Counter'), COUNTERS.map(([n, c]) => h('button', { title: n, style: { background: c }, onclick: edit(() => (it.color2 = c)) }))),
      (def.color2 || it.color2) && row('Secondary', colorInput(it.color2 || def.color2, live(v => (it.color2 = v)), edit(v => (it.color2 = v)))),
      h('div.stack', null, !def.hand && check('Mirror', it.flip, edit(v => (it.flip = v))), check('Lock position', it.locked, edit(v => (it.locked = v))),
        check('Rest on furniture', ops.sits(it), edit(v => { it.on = v; if (v) it.elev = ops.surfaceUnder(it); })))),
    def.light && lightSection(it, def),
    section('Shopping', row('Price', numInput(it.price ?? '', edit(v => (it.price = v || undefined)), { step: 0.01, min: 0 })),
      row('Link', textInput(it.url, edit(v => (it.url = v || undefined)), { placeholder: 'https://…', type: 'url' }), it.url && h('a.go', { href: it.url, target: '_blank', rel: 'noopener' }, '↗')),
      it.type === 'product' && row('Photo URL', textInput(it.image, edit(v => (it.image = v)), { placeholder: 'https://…' })),
      row('Notes', textInput(it.notes, edit(v => (it.notes = v || undefined))))),
    section(null, h('div.stack', null, btn('Rotate 90°', () => ops.rotateSelection(90)), btn('Duplicate', ops.duplicateSelection), btn('To front', () => ops.reorder(true)), btn('To back', () => ops.reorder(false)),
      btn('Save to library', () => addToLibrary(it)), btn('Delete', ops.deleteSelection, { cls: 'danger' }))),
  ];
}

function wallProps(walls) {
  const w = walls[0], g = S.wallGeom.get(w.id), all = fn => v => walls.forEach(x => fn(x, v));
  return [
    h('h2', null, walls.length > 1 ? `${walls.length} walls` : 'Wall'),
    section(null, walls.length === 1 && row('Length', lenInput(g.len, v => ops.setWallLength(w, v), false)),
      row('Thickness', lenInput(w.thickness, edit(all((x, v) => (x.thickness = Math.max(0.02, v)))))),
      row('Height', lenInput(w.height || S.doc.settings.wallHeight, edit(all((x, v) => (x.height = Math.max(0.3, v)))), false)),
      row('Paint', colorInput(w.color || S.doc.settings.wallColor, live(all((x, v) => (x.color = v))), edit(all((x, v) => (x.color = v)))))),
    ...['n', 'm'].map(key => {
      const mid = mul(add(w.a, w.b), 0.5), off = mul(g.n, w.thickness / 2 + 0.12), room = ops.roomAt(key === 'n' ? add(mid, off) : sub(mid, off)), sd = w.sides?.[key] || {};
      const set = patch => walls.forEach(x => { x.sides ??= {}; x.sides[key] = { ...x.sides[key], ...patch }; });
      return section(room ? `Side facing ${room.meta.name}` : 'Outside face',
        row('Finish', selectInput(WALL_FINISHES.map(f => [f.id, f.name]), sd.finish || 'paint', edit(v => set({ finish: v })))),
        row(sd.finish && sd.finish !== 'paint' ? 'Tint' : 'Colour', colorInput(sd.color || (sd.finish && sd.finish !== 'paint' ? '#ffffff' : w.color || S.doc.settings.wallColor), live(v => set({ color: v })), edit(v => set({ color: v })))));
    }),
    section(null, h('div.stack', null, walls.length === 1 && btn('Split in half', () => ops.splitWall(w.id)), walls.length === 1 && btn('Add door', () => { ops.addOpening(w.id, g.len / 2, { type: 'door' }); commit(); }, { disabled: g.len < 1 }),
      walls.length === 1 && btn('Add window', () => { ops.addOpening(w.id, g.len / 2, { type: 'window' }); commit(); }, { disabled: g.len < 1.4 }),
      btn('Reset finishes', edit(() => walls.forEach(x => { delete x.color; delete x.sides; }))), btn('Delete', ops.deleteSelection, { cls: 'danger' }))),
    h('p.hint', null, 'Drag a wall to move it with its neighbours, drag a corner to reshape, or double-click to split.'),
  ];
}

function openingProps(o) {
  const door = o.type === 'door', w = find('wall', o.wallId), g = S.wallGeom.get(w.id);
  return [
    h('h2', null, door ? 'Door' : 'Window'),
    section(null, row('Style', selectInput(door ? [['single', 'Single swing'], ['double', 'Double swing'], ['glass', 'Glass swing (window wall)'], ['sliding', 'Sliding glass'], ['bifold', 'Bifold'], ['opening', 'Cased opening']] : [['standard', 'Standard (divided)'], ['picture', 'Picture (single pane)'], ['curtain', 'Window wall (dark mullions)']], o.style, edit(v => (o.style = v)))),
      row('Width', lenInput(o.width, edit(v => (o.width = Math.min(Math.max(0.2, v), g.len - 0.1))))), row('Height', lenInput(o.height, edit(v => (o.height = Math.max(0.2, v))))),
      !door && row('Sill height', lenInput(o.sill, edit(v => (o.sill = Math.max(0, v))))),
      row('From wall start', lenInput(o.pos - o.width / 2, edit(v => (o.pos = v + o.width / 2)), false))),
    section('Centre', h('div.stack', null, btn('On the wall', () => ops.centerOpening(o, false), { title: 'Middle of this wall segment' }), btn('Between side walls', () => ops.centerOpening(o, true), { title: 'Middle of the room it opens into' }))),
    section(null, h('div.stack', null, door && btn('Flip hinge side', edit(() => (o.hinge = o.hinge === 'left' ? 'right' : 'left'))), door && btn('Flip swing', edit(() => (o.side = -o.side))), btn('Delete', ops.deleteSelection, { cls: 'danger' }))),
  ];
}

function roomProps(rooms) {
  const r = rooms[0], m = r.meta, a = analyze().rooms.find(x => x.room.id === r.id);
  return [
    h('h2', null, 'Room'),
    h('datalist', { id: 'roomnames' }, ['Living room', 'Kitchen', 'Dining room', 'Bedroom', 'Primary bedroom', 'Bathroom', 'Closet', 'Hallway', 'Entry', 'Office', 'Laundry', 'Balcony', 'Garage', 'Pantry', 'Nursery'].map(n => h('option', { value: n }))),
    section(null, row('Name', textInput(m.name, edit(v => (m.name = v || 'Room')), { list: 'roomnames' })),
      row('Floor', selectInput(FLOORS.map(f => [f.id, f.name]), m.floor, edit(v => rooms.forEach(x => (x.meta.floor = v)))))),
    section('Walls of this room', row('Finish', selectInput([['', 'Choose…'], ...WALL_FINISHES.map(f => [f.id, f.name])], '', v => v && rooms.forEach(x => ops.paintRoom(x, { finish: v, color: undefined })))),
      row('Paint colour', colorInput(S.doc.settings.wallColor, () => {}, v => rooms.forEach(x => ops.paintRoom(x, { finish: 'paint', color: v })))),
      h('p.hint', null, 'Applies to every wall face looking into this room. Select a single wall to style one side, e.g. an accent wall or a tiled kitchen wall.')),
    section('Measurements', h('div.kv', null, h('span', null, 'Floor area'), h('b', null, fmtArea(r.area, units())), h('span', null, 'Overall size'), h('b', null, `${L(r.bbox.w)} × ${L(r.bbox.h)}`), h('span', null, 'Perimeter'), h('b', null, L(r.perimeter)),
      h('span', null, 'Furnished'), h('b', null, a ? `${Math.round(a.pct * 100)} % · ${a.verdict}` : '—'))),
    h('p.hint', null, 'Rooms are detected automatically wherever walls form a closed loop.'),
  ];
}

function projectProps() {
  const d = S.doc, a = analyze();
  return [
    h('h2', null, 'Project'),
    section(null, h('div.kv', null, h('span', null, 'Floor area'), h('b', null, fmtArea(a.totalArea, units())), h('span', null, 'Rooms'), h('b', null, S.rooms.length), h('span', null, 'Objects'), h('b', null, d.items.length), h('span', null, 'Budget'), h('b', null, fmtMoney(a.budget)))),
    section('Getting started', h('ol.steps', null,
      h('li', null, h('b', null, 'Build'), ' — draw walls (W) or a rectangle room (R). Type a length while drawing for exact sizes, or trace an imported floor plan image.'),
      h('li', null, h('b', null, 'Openings'), ' — add doors (D) and windows (N) by clicking on walls.'),
      h('li', null, h('b', null, 'Furnish'), ' — pick pieces from the catalogue, resize them here, or add your own from a product link or 3D model.'),
      h('li', null, h('b', null, 'Check'), ' — the Insights tab flags collisions, blocked doors and tight walkways.'))),
    h('p.hint', null, isTouch ? 'Select anything on the plan to edit it here. Long-press for more actions.' : 'Select anything on the plan to edit it here. Right-click for more actions.'),
  ];
}

function buildRight() {
  const el = $('right');
  let t = 0, hard = false;
  const render = () => {
    t = 0;
    const act = document.activeElement, inside = el.contains(act);
    if (!hard && inside && /color|range/.test(act.type)) return;
    hard = false;
    const idx = inside ? [...el.querySelectorAll('input,select')].indexOf(act) : -1, top = el.scrollTop;
    const items = selOf('item'), walls = selOf('wall'), ops_ = selOf('opening'), rooms = selOf('room'), labels = selOf('label'), dims = selOf('dim');
    let kids;
    const eps = selOf('elec'), cbs = selOf('cable');
    if (eps.length) kids = pointProps(eps[0]);
    else if (cbs.length) kids = cableProps(cbs[0]);
    else if (items.length) kids = itemProps(items);
    else if (walls.length) kids = wallProps(walls);
    else if (ops_.length) kids = openingProps(ops_[0]);
    else if (rooms.length) kids = roomProps(rooms);
    else if (labels.length) { const l = labels[0]; kids = [h('h2', null, 'Label'), section(null, row('Text', textInput(l.text, edit(v => (l.text = v || l.text)))), row('Size', lenInput(l.size, edit(v => (l.size = Math.max(0.05, v))))), row('Colour', h('input', { type: 'color', value: l.color || '#22262b', onchange: e => { l.color = e.target.value; commit(); } }))), btn('Delete', ops.deleteSelection, { cls: 'danger' })]; }
    else if (dims.length) kids = [h('h2', null, 'Dimension'), section(null, h('div.kv', null, h('span', null, 'Length'), h('b', null, L(dist(dims[0].a, dims[0].b))))), btn('Delete', ops.deleteSelection, { cls: 'danger' })];
    else kids = projectProps();
    el.replaceChildren(...kids.filter(Boolean));
    el.scrollTop = top;
    if (idx >= 0) el.querySelectorAll('input,select')[idx]?.focus();
  };
  const later = isHard => { hard ||= isHard; if (!t) t = setTimeout(render, 30); };
  on('doc', () => later(false)); on('sel', () => later(true)); on('history', () => later(true)); on('load', () => later(true));
  render();
}

// ------------------------------------------------------------------ HUDs, status bar, context menu
function build2dHud() {
  const done = h('div.hudgroup.donebar', null, btn('✓ Done', () => { ed.finishDrawing(); setTool('select'); }, { cls: 'primary', title: 'Finish drawing and go back to Select (Esc)' }));
  $('hud2d').replaceChildren(h('div.hudgroup', null, btn('−', () => ed.zoomBy(1 / 1.25), { title: 'Zoom out' }), btn('Fit', ed.zoomFit, { title: 'Zoom to fit (F)' }), btn('+', () => ed.zoomBy(1.25), { title: 'Zoom in' })), done);
  const sync = () => (done.style.display = S.tool === 'select' ? 'none' : 'flex');
  on('tool', () => { sync(); if (narrow() && S.tool !== 'select') toggleDrawer('left', false); }); // close the catalogue so the plan can be tapped
  sync();
}
function build3dHud() {
  if (!api3d) { $('hud3d').replaceChildren(h('div.hudmsg', null, 'Loading 3D…')); return; }
  const samples = h('b', null, '0'), renderBar = h('div.hudgroup.renderbar', { style: { display: 'none' } }, h('span', null, 'Rendering — '), samples, h('span', null, ' samples. It keeps refining; orbit to reframe.'),
    btn('Save image', () => download(`${S.doc.name}-render.png`, api3d.snapshot()), { cls: 'primary' }), btn('Done', () => api3d.stopRender()));
  let tick = 0;
  on('render', () => { const a = api3d.renderInfo().active; renderBar.style.display = a ? 'flex' : 'none'; clearInterval(tick); if (a) tick = setInterval(() => (samples.textContent = api3d.renderInfo().samples), 400); });
  const walkB = btn('Walk', () => api3d.setWalk(!S.walk), { title: 'First-person walkthrough: W A S D to move, drag to look, Esc to leave' });
  const hold = (label, code, title) => h('button', { title, onpointerdown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); api3d.setWalkKey(code, true); },
    onpointerup: () => api3d.setWalkKey(code, false), onpointercancel: () => api3d.setWalkKey(code, false), oncontextmenu: e => e.preventDefault() }, label);
  const pad = h('div.walkpad', { style: { display: 'none' } },
    h('div.hudgroup', null, hold('◀', 'KeyA', 'Step left'), h('div.walkcol', null, hold('▲', 'KeyW', 'Forward'), hold('▼', 'KeyS', 'Back')), hold('▶', 'KeyD', 'Step right')),
    h('div.hudgroup', null, hold('⟲', 'ArrowLeft', 'Turn left'), hold('⟳', 'ArrowRight', 'Turn right'), btn('Exit', () => api3d.setWalk(false))));
  on('walk', () => {
    walkB.classList.toggle('on', S.walk); pad.style.display = S.walk ? 'flex' : 'none';
    S.walk && toast(isTouch ? 'Walk mode — use the arrows to move, drag to look around' : 'Walk mode — W A S D to move, drag to look around, Esc to exit', 4000);
  });
  $('hud3d').replaceChildren(
    h('div.hudgroup', null, btn('Orbit', () => api3d.setCamera('iso'), { title: 'Reset to an overview' }), btn('Top', () => api3d.setCamera('top')), btn('Front', () => api3d.setCamera('front')), walkB),
    h('div.hudgroup', null, h('span', null, 'Walls'), selectInput([['auto', 'Cut-away'], ['full', 'All'], ['none', 'Hidden']], 'auto', v => api3d.setWallMode(v)),
      check('Shadows', true, v => api3d.setShadows(v)), check('Neighbours', S.prefs.showContext, v => { setPref('showContext', v); api3d.showContext(v); }),
      h('span', null, 'Lights'), selectInput([['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], S.prefs.lights || 'auto', v => { setPref('lights', v); api3d.setLights(v); })),
    sunBar(),
    h('div.hudgroup', null, h('span', null, 'Quality'), selectInput([['standard', 'Standard'], ['high', 'High (ambient occlusion)']], 'standard', v => api3d.setQuality(v)),
      btn('📷 Photo render', () => { toast('Preparing the render…'); api3d.startRender().catch(() => toast('The photo renderer could not start on this device')); }, { cls: 'primary', title: 'Path-traced render of this view: real light bounces, soft shadows and reflections' })),
    renderBar, pad);
}

// ---- sun: date, time of day (local time at the site), play a day; the Site dialog places the plan on Earth ----
const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
function sunBar() {
  const t0 = api3d.getSunTime();
  const time = h('input', { type: 'range', min: 0, max: 1439, step: 5, value: t0.minutes, title: 'Time of day at the site', oninput: () => { stop(); api3d.setSunTime({ minutes: +time.value }); } });
  const date = h('input', { type: 'date', value: t0.date, title: 'Date', onchange: () => date.value && api3d.setSunTime({ date: date.value }) });
  const label = h('b.suntime'), play = btn('▶', () => (timer ? stop() : start()), { title: 'Play the day' });
  let timer = 0;
  const start = () => { play.textContent = '❚❚'; let m = +time.value; timer = setInterval(() => { m = (m + 6) % 1440; time.value = m; api3d.setSunTime({ minutes: m }); }, 50); };
  const stop = () => { clearInterval(timer); timer = 0; play.textContent = '▶'; };
  on('sun', p => { label.textContent = `${hhmm(p.minutes)} · sun ${p.el > 0 ? `${Math.round(p.el)}° up, ${compass(p.az)}` : 'down'}`; if (+time.value !== p.minutes) time.value = p.minutes; if (date.value !== p.date) date.value = p.date; });
  setTimeout(() => api3d.setSunTime({}), 0); // fill in the read-out
  let key = null;
  const off = () => { api3d.clearSunHours(); hoursB.classList.remove('on'); key?.remove(); key = null; };
  const hoursB = btn('Sun hours', async () => {
    if (hoursB.classList.contains('on')) return off();
    hoursB.disabled = true; hoursB.textContent = 'Working…';
    const r = await api3d.sunHours(f => (hoursB.textContent = `${Math.round(f * 100)}%`));
    hoursB.disabled = false; hoursB.textContent = 'Sun hours';
    if (!r) return toast('The sun does not rise on that day here');
    hoursB.classList.add('on'); key = sunKey(r, date.value, off); $('pane3d').append(key);
  }, { title: 'Map how many hours of direct sun each spot of floor and furniture gets on this date' });
  on('doc', () => { hoursB.classList.remove('on'); key?.remove(); key = null; });
  return h('div.hudgroup.sunbar', null, h('span', null, 'Sun'), date, time, play, label, hoursB, btn('Site…', siteDialog, { title: 'Address, north and which floor the unit is on' }));
}
// the key to the sun-hours colours, with each room's share of sun
function sunKey(r, day, close) {
  const rgb = c => `rgb(${c.join(',')})`, full = api3d.SUN_FULL, when = new Date(day + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const scale = h('div.sunscale', { style: { background: `linear-gradient(to right, ${api3d.SUN_RAMP.map(rgb).join(', ')})` } });
  const ticks = h('div.sunticks', null, ...[0, 2, 4].map(t => h('span', null, `${t} h`)), h('span', null, `${full}+ h`));
  const rows = r.rooms.map(m => h('tr', null, h('td', null, m.name), h('td', null, h('i', { style: { background: rgb(api3d.SUN_RAMP[Math.min(3, Math.round((m.avg / full) * 3))]) } })),
    h('td.num', null, `${m.avg.toFixed(1)} h`), h('td.num', null, `${Math.round(m.sunny * 100)}%`)));
  return h('div.sunkey', null,
    h('div.sunkeyhead', null, h('b', null, `Hours of direct sun · ${when}`), btn('×', close, { title: 'Hide the sun hours' })),
    scale, ticks,
    h('p.hint', null, `Each tile is one 25 cm spot of floor, or the top of the furniture standing there. ${r.day.toFixed(1)} h of daylight that day; the sunniest spot gets ${r.max.toFixed(1)} h.`),
    h('table', null, h('tr', null, h('th', null, 'Room'), h('th'), h('th.num', null, 'Average'), h('th.num', { title: 'Share of the room with 2 hours of sun or more' }, '2 h+')), ...rows));
}
const compass = az => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(az / 45) % 8];

async function siteDialog() {
  const { site, geocode, fetchBuildings, floorElev, cornerSite } = await import('./site.js');
  const st = site(), save = patch => { S.doc.settings.site = { ...site(), ...patch }; commit(); draw(); };
  const results = h('div.siteresults'), info = h('p.hint');
  const q = h('input', { type: 'search', placeholder: 'Search an address or place…', value: st.address || '', onkeydown: e => e.key === 'Enter' && search() });
  async function search() {
    results.replaceChildren(h('p.hint', null, 'Searching…'));
    try {
      const found = await geocode(q.value);
      results.replaceChildren(...(found.length ? found.map(f => h('button.siteresult', { onclick: () => { save({ lat: f.lat, lon: f.lon, address: f.name, buildings: null }); lat.value = f.lat.toFixed(5); lon.value = f.lon.toFixed(5); results.replaceChildren(); info.textContent = 'Location set. Load the neighbouring buildings to see their shadows.'; } }, f.name)) : [h('p.hint', null, 'Nothing found.')]));
    } catch { results.replaceChildren(h('p.hint', null, 'Could not reach OpenStreetMap. Check your connection.')); }
  }
  // nudging the unit within its block keeps the buildings; a jump further than 100 m needs them loaded again
  const move = (la, lo) => { const s = site(), far = Math.hypot((la - s.lat) * 110540, (lo - s.lon) * 111320 * Math.cos(s.lat * Math.PI / 180)) > 100; save({ lat: la, lon: lo, ...(far && { buildings: null }) }); };
  const lat = numInput(st.lat.toFixed(5), v => move(v, site().lon), { step: 0.0001 }), lon = numInput(st.lon.toFixed(5), v => move(site().lat, v), { step: 0.0001 });
  const zones = (Intl.supportedValuesOf?.('timeZone') || [st.tz]).map(z => [z, z.replace(/_/g, ' ')]);
  const north = h('input', { type: 'range', min: 0, max: 359, step: 1, value: st.north, oninput: () => { S.doc.settings.site = { ...site(), north: +north.value }; nlab.textContent = `${north.value}°`; draw(); touch(); }, onchange: () => commit() });
  const nlab = h('b', null, `${st.north}°`);
  // preview: the plan outline with a north arrow, turned as the slider says
  const cv = h('canvas', { width: 220, height: 220, style: { width: '110px', height: '110px' } });
  function draw() {
    const g = cv.getContext('2d'), b = ed.contentBounds(), s = 180 / Math.max(b.x1 - b.x0, b.y1 - b.y0, 1), n = site().north;
    g.clearRect(0, 0, 220, 220); g.save(); g.translate(110, 110); g.lineWidth = 3; g.strokeStyle = '#3a3f47';
    for (const w of S.doc.walls) { g.beginPath(); g.moveTo((w.a.x - (b.x0 + b.x1) / 2) * s, (w.a.y - (b.y0 + b.y1) / 2) * s); g.lineTo((w.b.x - (b.x0 + b.x1) / 2) * s, (w.b.y - (b.y0 + b.y1) / 2) * s); g.stroke(); }
    g.rotate(-n * Math.PI / 180); g.fillStyle = '#d6453d'; g.beginPath(); g.moveTo(0, -100); g.lineTo(-9, -76); g.lineTo(9, -76); g.closePath(); g.fill();
    g.font = 'bold 18px system-ui'; g.textAlign = 'center'; g.fillText('N', 0, -58); g.restore();
  }
  draw();
  const status = h('p.hint', null, st.buildings ? `${st.buildings.length} neighbouring buildings loaded.` : 'No neighbouring buildings loaded.');
  const load = btn('Load neighbouring buildings', async () => {
    const r = Math.min(site().radius || 250, phone ? 500 : Infinity);
    load.disabled = true; status.textContent = `Asking OpenStreetMap for buildings within ${r} m… (this can take up to a minute)`;
    try { const b = await fetchBuildings(site().lat, site().lon, r); save({ buildings: b }); status.textContent = `${b.length} buildings loaded; they cast shadows on the unit.`; }
    catch { status.textContent = 'The buildings service did not answer. Try again in a minute.'; }
    load.disabled = false;
  });
  // slide the unit into a corner of your own building (the footprint the site sits in)
  const snap = bearing => {
    const p = cornerSite(site(), ed.contentBounds(), bearing);
    if (!p) { status.textContent = 'Load the buildings first, with the site inside your own building.'; return; }
    move(p.lat, p.lon); lat.value = p.lat.toFixed(6); lon.value = p.lon.toFixed(6);
    status.textContent = `Unit moved to the building's ${compass(bearing)} corner.`;
  };
  const corners = h('div.siterow', null, h('span', null, 'Put the unit in the corner:'), ...[315, 45, 225, 135].map(a => btn(compass(a), () => snap(a))));
  dialog('Site: where the unit is', h('div', null,
    h('p.hint', null, 'Puts the plan on the map so the sun comes from the right side at the right time, at your floor\'s height, with the neighbours\' shadows. Search, then turn the plan until the red arrow points north.'),
    h('div.siterow', null, q, btn('Search', search, { cls: 'primary' })), results, info,
    row('Latitude', lat), row('Longitude', lon),
    row('Time zone', selectInput(zones, st.tz, v => save({ tz: v }))),
    h('div.sitenorth', null, cv, h('div', null, row('North', north, nlab), h('p.hint', null, 'Which way the top of the plan faces. 0° = up is north, 90° = up is east.'))),
    row('Floor', numInput(st.floor, v => save({ floor: Math.max(1, Math.round(v)) }), { min: 1, max: 200 })),
    row('Storeys in your building', numInput(st.storeys || 0, v => save({ storeys: Math.max(0, Math.round(v)) }), { min: 0, max: 200, title: '0 = use OpenStreetMap\'s height' })),
    row('Floor-to-floor height', lenInput(st.floorHeight, v => save({ floorHeight: v }), false)),
    h('p.hint', null, `Floor ${st.floor} puts your floor about ${fmtLen(floorElev(st), units())} above the street.`),
    row('Buildings within', selectInput([['250', '250 m'], ['500', '500 m'], ...(phone ? [] : [['1000', '1 km'], ['1500', '1.5 km']])], String(Math.min(st.radius || 250, phone ? 500 : 1500)), v => { save({ radius: +v }); status.textContent = 'Load the buildings again to fill the wider area.'; })),
    load, corners, status,
    row('Ground', selectInput([['', 'Plain'], ['satellite', 'Satellite imagery'], ['map', 'Street map']], st.imagery || '', v => save({ imagery: v || null }))),
    row('Ground detail', selectInput([['17', 'Low (~1 m)'], ['18', 'Medium (~50 cm)'], ['19', 'High (~25 cm)']], String(st.detail || 17), v => save({ detail: +v }))),
    h('p.hint', null, 'High detail is capped at a 4096-pixel picture, so over a wide area it falls back to less detail.'),
    h('p.hint', null, 'Map data © OpenStreetMap contributors (ODbL). Satellite imagery © Esri, Maxar, Earthstar Geographics.')), [{ label: 'Done', primary: true }]);
}

function buildStatus() {
  const hint = h('span.hint'), pos = h('span'), zoom = h('span'), area = h('span');
  $('status').replaceChildren(hint, h('div.grow'), area, pos, zoom);
  on('status', t => (hint.textContent = t || (isTouch ? 'Drag to pan · Pinch to zoom · Long-press for actions · Double-tap a room to rename' : 'Right-click for actions · Scroll to zoom · Space-drag to pan')));
  on('cursor', p => (pos.textContent = `X ${L(p.x)}   Y ${L(p.y)}`));
  const z = () => (zoom.textContent = `${Math.round(ed.view.zoom)} px/m`);
  on('view', z); z();
  const ar = () => (area.textContent = S.rooms.length ? `${S.rooms.length} rooms · ${fmtArea(S.rooms.reduce((s, r) => s + r.area, 0), units())}` : '');
  on('doc', ar); ar();
  emit('status', '');
}

function contextMenu({ x, y, world, hit }) {
  const items = selOf('item'), any = S.sel.some(s => s.k !== 'room');
  const e = [];
  if (hit?.k === 'wall') e.push({ label: 'Split wall here', run: () => ops.splitWall(hit.id, world) }, { label: 'Add door here', run: () => { const w = find('wall', hit.id); ops.addOpening(w.id, dist(w.a, world), { type: 'door' }); commit(); } },
    { label: 'Add window here', run: () => { const w = find('wall', hit.id); ops.addOpening(w.id, dist(w.a, world), { type: 'window' }); commit(); } }, '-');
  if (hit?.k === 'opening' && find('opening', hit.id).type === 'door') { const o = find('opening', hit.id); e.push({ label: 'Flip hinge side', run: edit(() => (o.hinge = o.hinge === 'left' ? 'right' : 'left')) }, { label: 'Flip swing direction', run: edit(() => (o.side = -o.side)) }, '-'); }
  if (items.some(i => getDef(i.type).hand)) e.push({ label: items.length === 1 ? `Flip to ${ops.handOf(items[0]) === 'right' ? 'left' : 'right'}-hand facing` : 'Switch chaise side', run: () => ops.setHand(items) });
  if (items.length) e.push({ label: 'Rotate 90°', key: 'E', run: () => ops.rotateSelection(90) }, { label: 'Duplicate', key: 'Ctrl+D', run: ops.duplicateSelection }, { label: 'Bring to front', run: () => ops.reorder(true) }, { label: 'Send to back', run: () => ops.reorder(false) },
    { label: items.every(i => i.locked) ? 'Unlock' : 'Lock position', run: edit(() => { const v = !items.every(i => i.locked); items.forEach(i => (i.locked = v)); }) }, '-');
  if (hit?.k === 'room') { const r = find('room', hit.id); e.push({ label: `Rename “${r.meta.name}”…`, run: () => { const n = prompt('Room name:', r.meta.name); if (n) { r.meta.name = n; commit(); } } }, '-'); }
  if (any) e.push({ label: 'Copy', key: 'Ctrl+C', run: ops.copySelection }, { label: 'Delete', key: 'Del', run: ops.deleteSelection }, '-');
  e.push({ label: 'Paste here', key: 'Ctrl+V', run: () => ops.paste({ x: 0.3, y: 0.3 }) }, { label: 'Add label here', run: () => { const t = prompt('Label text:'); if (t) { S.doc.labels.push({ id: uid('lb'), x: world.x, y: world.y, text: t, size: 0.22 }); commit(); } } }, { label: 'Zoom to fit', key: 'F', run: ed.zoomFit });
  menu(x, y, e);
}

// Floating toolbar above the selected piece: the piece is only moved on purpose (grip, or dragging it once selected).
function buildSelectionBar() {
  const mk = (pane, is3d) => {
    const el = h('div.selbar', { style: { display: 'none' } },
      is3d ? h('span', null, 'Drag piece to move') : h('button.grip', { title: 'Drag to move', onpointerdown: e => { e.preventDefault(); ed.beginMove(e); } }, '✥ Move'),
      btn('⟲', () => ops.rotateSelection(-90), { title: 'Rotate left 90° (Q)' }), btn('⟳', () => ops.rotateSelection(90), { title: 'Rotate right 90° (E)' }),
      h('button.flipbtn', { title: 'Switch chaise side (left / right-hand facing)', onclick: () => ops.setHand(selOf('item')) }, '⇄'),
      btn('⊕', () => ops.centerItems('both'), { title: 'Centre between walls' }), btn('⧉', ops.duplicateSelection, { title: 'Duplicate (Ctrl+D)' }), btn('🗑', ops.deleteSelection, { title: 'Delete (Del)', cls: 'danger' }));
    pane.append(el);
    return el;
  };
  const bars = [[mk($('pane2d'), false), $('pane2d'), it => S.tool === 'select' && ed.itemAnchor(it)], [mk($('pane3d'), true), $('pane3d'), it => api3d?.projectItem(it)]];
  const frame = () => {
    requestAnimationFrame(frame);
    const it = selOf('item').find(i => !i.locked);
    for (const [el, pane, where] of bars) {
      const pos = it && pane.offsetWidth ? where(it) : null;
      if (!pos) { el.style.display = 'none'; continue; }
      el.style.display = 'flex';
      const fb = el.querySelector('.flipbtn'), hand = !!getDef(it.type).hand; if (fb.hidden === hand) fb.hidden = !hand;
      el.style.left = clamp(pos.x, 120, Math.max(120, pane.clientWidth - 120)) + 'px'; el.style.top = clamp(pos.y - 58, 50, Math.max(50, pane.clientHeight - 50)) + 'px';
    }
  };
  frame();
}

// Online library of free, realistic models (Poly Haven, CC0). Models stay on their servers and are loaded by URL.
let phCatalog = null;
async function libraryDialog() {
  if (!api3d) { toast('The 3D engine is not loaded (are you offline?)'); return; }
  const CATS = [['furniture', 'All furniture'], ['seating', 'Seating'], ['table', 'Tables'], ['shelves', 'Storage'], ['bed', 'Beds'], ['lighting', 'Lighting'], ['appliances', 'Appliances'], ['electronics', 'Electronics'], ['decorative', 'Decor'], ['wall decoration', 'Wall decor'], ['potted plants', 'Plants'], ['vases', 'Vases']];
  let cat = 'furniture', q = '', busy = false;
  const grid = h('div.grid.ph'), info = h('p.hint', null, 'Loading the catalogue…');
  const fill = () => {
    if (!phCatalog) return;
    const list = Object.entries(phCatalog).filter(([id, a]) => a.categories.includes(cat) && (!q || `${a.name} ${a.tags?.join(' ')}`.toLowerCase().includes(q)));
    info.textContent = `${list.length} models. Click one to bring it into your plan at real size.`;
    grid.replaceChildren(...list.map(([id, a]) => h('button.card', { title: a.name, onclick: () => pick(id, a) }, h('img', { loading: 'lazy', src: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=160&height=160`, alt: a.name }), h('b', null, a.name))));
  };
  const pick = async (id, a) => {
    if (busy) return; busy = true; info.textContent = `Downloading “${a.name}”…`;
    try {
      const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json(), g = files.gltf['1k'].gltf, aid = uid('as');
      S.assets[aid] = { name: a.name, kind: 'remote', url: g.url, include: Object.fromEntries(Object.entries(g.include || {}).map(([rel, v]) => [rel, v.url])), credit: 'Poly Haven (CC0)' };
      const m = await api3d.measureModel(aid);
      S.assets[aid].thumb = m.thumb;
      place(ops.makeItem('model', { assetId: aid, name: a.name, w: m.w, d: m.d, h: m.h, url: `https://polyhaven.com/a/${id}` }));
      close(); toast(`${a.name} ready (${L(m.w)} × ${L(m.d)} × ${L(m.h)}) — click on the plan to place it`, 4000);
    } catch (e) { console.error(e); info.textContent = 'That model could not be downloaded. Try another one.'; }
    busy = false;
  };
  const chips = h('div.chips', null, CATS.map(([id, label]) => h('button' + (id === cat ? '.on' : ''), { onclick: e => { cat = id; chips.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); fill(); } }, label)));
  const close = dialog('Free realistic 3D models', h('div', null,
    h('p.hint', null, 'Detailed, textured models from Poly Haven, free for any use (CC0). They load from polyhaven.com, so an internet connection is needed whenever the plan is opened.'),
    h('input.search', { type: 'search', placeholder: 'Search, e.g. sofa, lamp, chair…', oninput: e => { q = e.target.value.trim().toLowerCase(); fill(); } }), chips, info, grid), [], '.wide');
  try { phCatalog ??= await (await fetch('https://api.polyhaven.com/assets?t=models')).json(); fill(); }
  catch { info.textContent = 'Could not reach polyhaven.com. Check your connection and try again.'; }
}

// Sketchfab: searching is open to everyone; downloading a model needs the user's own (free) API token.
const SF_KEY = 'id-sketchfab-token';
function sketchfabDialog() {
  if (!api3d) { toast('The 3D engine is not loaded (are you offline?)'); return; }
  const QUICK = ['Office chair', 'Standing desk', 'Monitor', 'Mechanical keyboard', 'Desk setup', 'Bookshelf', 'Modern sofa', 'Floor lamp', 'Potted plant', 'Wall panel', 'Refrigerator', 'Coffee machine'];
  let q = 'office chair', lic = '', busy = false, seq = 0, token = '';
  try { token = localStorage.getItem(SF_KEY) || ''; } catch {}
  const grid = h('div.grid.ph'), info = h('p.hint', null, ''), mb = n => `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;
  const search = async () => {
    const mine = ++seq; info.textContent = 'Searching…';
    try {
      const r = await fetch(`https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&max_face_count=150000&q=${encodeURIComponent(q)}${lic ? '&license=' + lic : ''}`);
      const list = (await r.json()).results || [];
      if (mine !== seq) return;
      info.textContent = list.length ? `${list.length} best matches. ${token ? 'Click one to bring it into your plan.' : 'Add your API token below to import with one click, or click a model to open its page and download the GLB yourself.'}` : 'Nothing found. Try a simpler search.';
      grid.replaceChildren(...list.map(m => h('button.card', { title: `${m.name} — by ${m.user?.displayName}, ${m.license?.label || 'see page for licence'}`, onclick: () => pick(m) },
        h('img', { loading: 'lazy', src: (m.thumbnails?.images?.find(i => i.width <= 256) || m.thumbnails?.images?.[0])?.url, alt: m.name }), h('b', null, m.name),
        h('small', null, `${m.license?.label?.replace('CC ', '') || '?'}${m.archives?.glb?.size ? ' · ' + mb(m.archives.glb.size) : ''}`))));
    } catch { if (mine === seq) info.textContent = 'Could not reach sketchfab.com. Check your connection and try again.'; }
  };
  const pick = async m => {
    if (!token) { window.open(m.viewerUrl, '_blank', 'noopener'); return; }
    if (busy) return;
    if (m.archives?.glb?.size > 80e6 && !confirm(`“${m.name}” is ${mb(m.archives.glb.size)}. Large models make the plan slow to save and open. Import anyway?`)) return;
    busy = true; info.textContent = `Downloading “${m.name}”…`;
    try {
      const r = await fetch(`https://api.sketchfab.com/v3/models/${m.uid}/download`, { headers: { Authorization: `Token ${token}` } });
      if (r.status === 401 || r.status === 403) throw new Error('token');
      const glb = (await r.json()).glb?.url; if (!glb) throw new Error('format');
      const aid = uid('as'), credit = `${m.name} by ${m.user?.displayName} (${m.license?.label || 'see page'}), via Sketchfab`;
      S.assets[aid] = { name: m.name, kind: 'glb', data: await readAsDataURL(await (await fetch(glb)).blob()), credit };
      const sz = await api3d.measureModel(aid);
      S.assets[aid].thumb = sz.thumb;
      place(ops.makeItem('model', { assetId: aid, name: m.name, w: sz.w, d: sz.d, h: sz.h, url: m.viewerUrl, notes: credit }));
      close(); toast(`${m.name} ready (${L(sz.w)} × ${L(sz.d)} × ${L(sz.h)}) — click on the plan to place it, then check its size`, 5000);
    } catch (e) { console.error(e); info.textContent = e.message === 'token' ? 'Sketchfab did not accept that API token. Check it and try again.' : e.message === 'format' ? 'That model has no GLB download. Try another one.' : 'That model could not be downloaded. Try another one.'; }
    busy = false;
  };
  const quick = h('div.chips', null, QUICK.map(t => h('button', { onclick: () => { q = t.toLowerCase(); box.value = t; search(); } }, t)));
  const box = h('input.search', { type: 'search', value: q, placeholder: 'Search, e.g. minimal desk, monitor arm, pegboard…', onchange: e => { q = e.target.value.trim(); search(); } });
  const close = dialog('Sketchfab models', h('div', null,
    h('p.hint', null, 'Hundreds of thousands of downloadable models from Sketchfab artists. Most are licensed CC Attribution: credit the author if you publish renders (the credit is saved in each piece’s notes). Models vary in scale, so check the size after placing.'),
    box, quick,
    h('div.form', null, row('Licence', selectInput([['', 'Any downloadable'], ['cc0', 'CC0 (no credit needed)'], ['by', 'CC Attribution']], lic, v => { lic = v; search(); })),
      row('API token', textInput(token, v => { token = v.trim(); try { token ? localStorage.setItem(SF_KEY, token) : localStorage.removeItem(SF_KEY); } catch {} search(); }, { type: 'password', placeholder: 'From sketchfab.com → Settings → Password & API' }))),
    info, grid), [], '.wide');
  search();
}

export function initUI() {
  buildTopbar(); buildRail(); buildLeft(); buildRight(); build2dHud(); build3dHud(); buildStatus(); buildSelectionBar(); buildPanelTabs();
  on('contextmenu', contextMenu); on('toast', toast);
  on('load', () => { $('topbar').querySelector('.docname').value = S.doc.name; });
  $('app').dataset.view = S.prefs.view;
}

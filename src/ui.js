// Application chrome: top bar, tool rail, catalogue / build / style / objects / insights tabs,
// the properties inspector, dialogs, context menu and toasts.
import { S, on, emit, commit, touch, undo, redo, canUndo, canRedo, select, selOf, find, setTool, setPref, setDoc, newDoc, exportProject, saveLibrary } from './state.js';
import { h, uid, fmtLen, parseLen, fmtArea, fmtMoney, download, readAsDataURL, pickFile, normDeg, dist, clamp, add, sub, mul } from './util.js';
import { CATALOG, CATEGORIES, getDef, thumbnail } from './catalog.js';
import { FLOORS, PALETTES, SWATCHES, floorCanvas, WALL_FINISHES, WOODS, COUNTERS } from './materials.js';
import * as ops from './ops.js';
import { analyze } from './analysis.js';
import * as ed from './editor2d.js';
import { loadSample } from './sample.js';

let api3d = null;
export const set3d = m => { api3d = m; build3dHud(); };
const $ = id => document.getElementById(id);
const units = () => S.doc.units;
const L = m => fmtLen(m, units());

const ICONS = {
  select: 'M5 3l14 8-6 2-2 6z', pan: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  wall: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6', arc: 'M4 20A16 16 0 0 1 20 4M2 20h4M20 2v4', room: 'M4 4h16v16H4zM4 14h8v6', door: 'M5 20V4h2v16M7 4a13 13 0 0 1 13 16H7',
  window: 'M4 5h16v14H4zM12 5v14M4 12h16', measure: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2', label: 'M5 6h14M12 6v13M9 19h6',
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
    h('div.brand', null, h('span.logo', null, '⌂'), 'Interior Designer'),
    h('button.menu-btn', { onclick: e => fileMenu(e.currentTarget) }, 'File ▾'), name, saved,
    h('div.sep'), undoB, redoB, h('div.sep'),
    tog('snapGrid', 'Grid snap', 'Snap to the measurement grid (G)'), tog('snapAngle', 'Angle snap', 'Snap walls to 15° steps'), tog('magnet', 'Wall magnet', 'Furniture snaps flush to walls'),
    tog('showDims', 'Dimensions', 'Show wall lengths'), tog('showLabels', 'Labels', 'Show room names and areas'),
    h('div.grow'), unit, viewSeg, h('button.menu-btn', { onclick: helpDialog, title: 'Keyboard shortcuts (?)' }, '?'));
  const sync = () => {
    undoB.disabled = !canUndo(); redoB.disabled = !canRedo();
    document.querySelectorAll('#topbar .toggle').forEach(b => b.classList.toggle('on', !!S.prefs[b.dataset.pref]));
    viewSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === S.prefs.view));
    if (document.activeElement !== name) name.value = S.doc.name;
    unit.value = S.doc.units;
  };
  on('history', sync); on('prefs', sync); on('load', sync);
  on('saved', () => { saved.textContent = 'Saved'; clearTimeout(saved._t); saved._t = setTimeout(() => (saved.textContent = ''), 1500); });
  sync();
}

export function setView(v) { $('app').dataset.view = v; setPref('view', v); }

function fileMenu(anchor) {
  const r = anchor.getBoundingClientRect();
  menu(r.left, r.bottom + 4, [
    { label: 'New plan', run: () => confirm('Start a new empty plan? Save the current one first if you want to keep it.') && setDoc(newDoc()) },
    { label: 'Open project…', key: 'Ctrl+O', run: openProject },
    { label: 'Save project (.json)', key: 'Ctrl+S', run: saveProject },
    '-',
    { label: 'Load sample apartment', run: () => loadSample().then(() => { ed.zoomFit(); toast('Sample apartment loaded'); }) },
    { label: 'Import floor plan image to trace…', run: importTrace },
    '-',
    { label: 'Export 2D plan (PNG)', run: () => download(`${S.doc.name}-plan.png`, ed.exportPNG()) },
    { label: 'Export 3D view (PNG)', disabled: !api3d, run: () => { if (S.prefs.view === '2d') setView('split'); setTimeout(() => download(`${S.doc.name}-3d.png`, api3d.snapshot()), 150); } },
    { label: 'Export shopping list (CSV)', run: exportCSV },
    { label: 'Print plan', key: 'Ctrl+P', run: printPlan },
  ]);
}
export function saveProject() { download(`${S.doc.name.replace(/[^\w -]+/g, '') || 'plan'}.json`, exportProject(), 'application/json'); toast('Project saved to your downloads'); }
export async function openProject() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  try {
    const { assets, ...doc } = JSON.parse(await f.text());
    if (!Array.isArray(doc.walls) || !Array.isArray(doc.items)) throw new Error('not a plan');
    setDoc(doc, assets || {}); ed.zoomFit(); toast(`Opened “${doc.name}”`);
  } catch { toast('That file is not an Interior Designer project'); }
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
  const keys = [['V', 'Select / move'], ['W', 'Draw walls'], ['A', 'Curved wall (start, end, then bend)'], ['R', 'Rectangle room'], ['D', 'Door'], ['N', 'Window'], ['M', 'Measure / dimension'], ['T', 'Text label'], ['H or Space-drag', 'Pan'], ['Scroll', 'Zoom'], ['F', 'Zoom to fit'],
    ['Q / E', 'Rotate selection 90° (Shift: 15°)'], ['Arrows', 'Nudge (Shift: larger)'], ['Ctrl+D', 'Duplicate'], ['Ctrl+C / V', 'Copy / paste'], ['Del', 'Delete'], ['Ctrl+Z / Y', 'Undo / redo'], ['Ctrl+A', 'Select all furniture'],
    ['G', 'Toggle grid snap'], ['1 / 2 / 3', '2D / split / 3D view'], ['Esc', 'Cancel / deselect'], ['Double-click wall', 'Split wall'], ['Double-click room', 'Rename room'], ['Shift while drawing', 'Lock to 45° steps'], ['Alt while dragging', 'Ignore snapping']];
  dialog('Shortcuts & tips', h('div', null, h('div.keys', null, keys.map(([k, d]) => [h('kbd', null, k), h('span', null, d)])),
    h('p.hint', null, 'While drawing a wall, type a length such as 12\'6" or 3.8m and press Enter to place it exactly. Click a piece to select it; a toolbar appears above it with Move, rotate, centre, duplicate and delete. Drag the Move grip (or the piece itself once selected) to move it. In 3D, switch to Walk and use W A S D, or press Photo render for a path-traced image.')));
}

// ------------------------------------------------------------------ tool rail
const TOOLS = [['select', 'Select (V)'], ['pan', 'Pan (H)'], ['wall', 'Draw walls (W)'], ['arc', 'Curved wall (A)'], ['room', 'Rectangle room (R)'], ['door', 'Door (D)'], ['window', 'Window (N)'], ['measure', 'Measure (M)'], ['label', 'Text label (T)']];
function buildRail() {
  $('rail').replaceChildren(...TOOLS.map(([t, title]) => { const b = h('button', { title, onclick: () => setTool(t) }, icon(t)); b.dataset.tool = t; return b; }));
  const sync = () => $('rail').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  on('tool', sync); sync();
}

// ------------------------------------------------------------------ left panel
let tab = 'furnish', cat = 'All', query = '';
const TABS = [['furnish', 'Furnish'], ['build', 'Build'], ['style', 'Style'], ['objects', 'Objects'], ['insights', 'Insights']];
function buildLeft() {
  const body = h('div.tab-body');
  const tabs = h('div.tabs', null, TABS.map(([id, label]) => { const b = h('button', { onclick: () => { tab = id; render(); } }, label); b.dataset.tab = id; return b; }));
  $('left').replaceChildren(tabs, body);
  const render = () => {
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const top = body.scrollTop;
    body.replaceChildren(...{ furnish: furnishTab, build: buildTab, style: styleTab, objects: objectsTab, insights: insightsTab }[tab]());
    body.scrollTop = top;
  };
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(() => { if (!$('left').contains(document.activeElement) || !/color|range|text|search/.test(document.activeElement.type)) render(); }, 60); };
  on('history', later); on('sel', () => (tab === 'objects' || tab === 'style') && later()); on('load', later); on('library', render); on('prefs', () => tab === 'insights' && later());
  render();
}

function place(item) { setTool('place', { item }); }
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
        btn('★ Browse free realistic 3D models', libraryDialog, { cls: 'primary', title: 'Poly Haven library — detailed, textured models, free to use' })),
      h('p.hint', null, 'Click a piece, then click on the plan to place it. Shift-click places several in a row.')),
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
    section('Windows', h('div.stack', null, win('Standard', { style: 'standard', width: 1.2, height: 1.2, sill: 0.9 }), win('Picture', { style: 'picture', width: 1.8, height: 1.4, sill: 0.75 }), win('Floor-to-ceiling', { style: 'picture', width: 1.5, height: 2.2, sill: 0.08 }), win('High / small', { style: 'standard', width: 0.7, height: 0.5, sill: 1.5 }))),
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
      def.sizes && row('Standard size', selectInput([['', 'Custom'], ...def.sizes.map((s, i) => [String(i), s[0]])], String(def.sizes.findIndex(s => Math.abs(s[1] - it.w) < 0.02 && Math.abs(s[2] - it.d) < 0.02)).replace('-1', ''), edit(v => { if (v !== '') { it.w = def.sizes[v][1]; it.d = def.sizes[v][2]; } }))),
      row('Width', lenInput(it.w, edit(v => (it.w = Math.max(0.02, v))))), row('Depth', lenInput(it.d, edit(v => (it.d = Math.max(0.02, v))))), row('Height', lenInput(it.h, edit(v => (it.h = Math.max(0.005, v))))),
      row('Off floor', lenInput(it.elev || 0, edit(v => (it.elev = Math.max(0, v))))),
      row('Rotation', numInput(Math.round(it.rot * 10) / 10, edit(v => (it.rot = normDeg(v))), { step: 15 }), h('span.unit', null, '°'))),
    section('Position', (() => {
        const g = ops.itemGaps(it), f = (lab, side) => isFinite(g[side]) && h('label', null, lab, lenInput(Math.max(0, g[side]), v => ops.setItemGap(it, side, v)));
        return [h('div.stack', null, btn('Centre ↔', () => ops.centerItems('x'), { title: 'Centre between the walls to its left and right' }), btn('Centre ↕', () => ops.centerItems('y'), { title: 'Centre between the walls in front and behind' }), btn('Centre both', () => ops.centerItems('both'))),
          h('div.dims4', null, f('Left gap', 'left'), f('Right gap', 'right'), f('Back gap', 'back'), f('Front gap', 'front')),
          h('p.hint', null, 'Gaps are the clear distance to the facing wall. Type a value to position the piece exactly.')];
      })()),
    section('Finish', row(def.color2 ? 'Main' : 'Colour', colorInput(it.color, live(v => (it.color = v)), edit(v => (it.color = v)))),
      it.type !== 'model' && !(it.tex ?? def.tex) && h('div.presets', null, h('span', null, 'Wood'), WOODS.map(([n, c]) => h('button', { title: n, style: { background: c }, onclick: edit(() => { if (def.mat === 'bed' || def.mat === 'fabric') it.color2 = c; else it.color = c; it.grain = true; }) }))),
      it.type !== 'model' && !(it.tex ?? def.tex) && check('Show wood grain in 3D', it.grain, edit(v => (it.grain = v))),
      (it.tex ?? def.tex) && row('Surface', selectInput(WALL_FINISHES.filter(f => f.id !== 'paint').map(f => [f.id, f.name]), it.tex ?? def.tex, edit(v => (it.tex = v)))),
      def.mat === 'cab' && def.color2 && h('div.presets', null, h('span', null, 'Counter'), COUNTERS.map(([n, c]) => h('button', { title: n, style: { background: c }, onclick: edit(() => (it.color2 = c)) }))),
      (def.color2 || it.color2) && row('Secondary', colorInput(it.color2 || def.color2, live(v => (it.color2 = v)), edit(v => (it.color2 = v)))),
      h('div.stack', null, check('Mirror', it.flip, edit(v => (it.flip = v))), check('Lock position', it.locked, edit(v => (it.locked = v))))),
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
    section(null, row('Style', selectInput(door ? [['single', 'Single swing'], ['double', 'Double swing'], ['sliding', 'Sliding glass'], ['bifold', 'Bifold'], ['opening', 'Cased opening']] : [['standard', 'Standard (divided)'], ['picture', 'Picture (single pane)']], o.style, edit(v => (o.style = v)))),
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
    h('p.hint', null, 'Select anything on the plan to edit it here. Right-click for more actions.'),
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
    if (items.length) kids = itemProps(items);
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
  $('hud2d').replaceChildren(h('div.hudgroup', null, btn('−', () => ed.zoomBy(1 / 1.25), { title: 'Zoom out' }), btn('Fit', ed.zoomFit, { title: 'Zoom to fit (F)' }), btn('+', () => ed.zoomBy(1.25), { title: 'Zoom in' })));
}
function build3dHud() {
  if (!api3d) { $('hud3d').replaceChildren(h('div.hudmsg', null, 'Loading 3D…')); return; }
  const samples = h('b', null, '0'), renderBar = h('div.hudgroup.renderbar', { style: { display: 'none' } }, h('span', null, 'Rendering — '), samples, h('span', null, ' samples. It keeps refining; orbit to reframe.'),
    btn('Save image', () => download(`${S.doc.name}-render.png`, api3d.snapshot()), { cls: 'primary' }), btn('Done', () => api3d.stopRender()));
  let tick = 0;
  on('render', () => { const a = api3d.renderInfo().active; renderBar.style.display = a ? 'flex' : 'none'; clearInterval(tick); if (a) tick = setInterval(() => (samples.textContent = api3d.renderInfo().samples), 400); });
  const walkB = btn('Walk', () => api3d.setWalk(!S.walk), { title: 'First-person walkthrough: W A S D to move, drag to look, Esc to leave' });
  on('walk', () => { walkB.classList.toggle('on', S.walk); S.walk && toast('Walk mode — W A S D to move, drag to look around, Esc to exit', 4000); });
  $('hud3d').replaceChildren(
    h('div.hudgroup', null, btn('Orbit', () => api3d.setCamera('iso'), { title: 'Reset to an overview' }), btn('Top', () => api3d.setCamera('top')), btn('Front', () => api3d.setCamera('front')), walkB),
    h('div.hudgroup', null, h('span', null, 'Walls'), selectInput([['auto', 'Cut-away'], ['full', 'All'], ['none', 'Hidden']], 'auto', v => api3d.setWallMode(v)),
      h('span', null, 'Sun'), h('input', { type: 'range', min: 0.02, max: 0.98, step: 0.01, value: 0.42, title: 'Time of day', oninput: e => api3d.setSun(+e.target.value) }),
      check('Shadows', true, v => api3d.setShadows(v))),
    h('div.hudgroup', null, h('span', null, 'Quality'), selectInput([['standard', 'Standard'], ['high', 'High (ambient occlusion)']], 'standard', v => api3d.setQuality(v)),
      btn('📷 Photo render', () => { toast('Preparing the render…'); api3d.startRender().catch(() => toast('The photo renderer could not start on this device')); }, { cls: 'primary', title: 'Path-traced render of this view: real light bounces, soft shadows and reflections' })),
    renderBar);
}

function buildStatus() {
  const hint = h('span.hint'), pos = h('span'), zoom = h('span'), area = h('span');
  $('status').replaceChildren(hint, h('div.grow'), area, pos, zoom);
  on('status', t => (hint.textContent = t || 'Right-click for actions · Scroll to zoom · Space-drag to pan'));
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

export function initUI() {
  buildTopbar(); buildRail(); buildLeft(); buildRight(); build2dHud(); build3dHud(); buildStatus(); buildSelectionBar();
  on('contextmenu', contextMenu); on('toast', toast);
  on('load', () => { $('topbar').querySelector('.docname').value = S.doc.name; });
  $('app').dataset.view = S.prefs.view;
}

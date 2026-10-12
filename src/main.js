// Entry point: boot the store, wire up the editor, UI and (lazily) the 3D view, and global shortcuts.
import { S, boot, setDoc, setTool, setPref, undo, redo, select } from './state.js';
import { initEditor, handleKey, zoomFit } from './editor2d.js';
import { initUI, set3d, setView, toast, saveProject, openProject, printPlan } from './ui.js';
import { loadSample } from './sample.js';
import * as ops from './ops.js';

const TOOL_KEYS = { v: 'select', h: 'pan', w: 'wall', a: 'arc', r: 'room', d: 'door', n: 'window', m: 'measure', t: 'label' };
let api3d = null;

function onKey(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.querySelector('.modal-back');
  if (typing) { if (e.key === 'Escape') e.target.blur?.(); return; }
  if (S.walk) { if (e.key === 'Escape') api3d?.setWalk(false); return; }
  if (handleKey(e)) { e.preventDefault(); return; }
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, step = S.doc.settings.snap * (e.shiftKey ? 12 : 1);
  const done = () => e.preventDefault();
  if (mod) {
    if (k === 'z') { e.shiftKey ? redo() : undo(); return done(); }
    if (k === 'y') { redo(); return done(); }
    if (k === 'c') { ops.copySelection(); return done(); }
    if (k === 'x') { if (ops.copySelection()) ops.deleteSelection(); return done(); }
    if (k === 'v') { ops.paste(); return done(); }
    if (k === 'd') { ops.duplicateSelection(); return done(); }
    if (k === 'a') { select(S.doc.items.filter(i => !i.locked).map(i => ({ k: 'item', id: i.id }))); return done(); }
    if (k === 's') { saveProject(); return done(); }
    if (k === 'o') { openProject(); return done(); }
    if (k === 'p') { printPlan(); return done(); }
    return;
  }
  if (e.altKey) return;
  if (TOOL_KEYS[k]) { setTool(TOOL_KEYS[k]); return done(); }
  if (k === 'delete' || k === 'backspace') { ops.deleteSelection(); return done(); }
  if (k === 'q' || k === 'e') { ops.rotateSelection((k === 'e' ? 1 : -1) * (e.shiftKey ? 15 : 90)); return done(); }
  if (k === 'f') { zoomFit(); return done(); }
  if (k === 'g') { setPref('snapGrid', !S.prefs.snapGrid); toast(`Grid snap ${S.prefs.snapGrid ? 'on' : 'off'}`, 1200); return done(); }
  if (k === '1' || k === '2' || k === '3') { setView(['2d', 'split', '3d'][k - 1]); return done(); }
  if (k.startsWith('arrow')) { ops.nudge(k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0); return done(); }
}

async function start() {
  const saved = await boot();
  if (saved?.doc?.walls) setDoc(saved.doc, saved.assets || {}); else await loadSample();
  window.app = { S, ops }; // handy from the dev-tools console
  initUI();
  initEditor(document.getElementById('c2d'));
  requestAnimationFrame(zoomFit);
  addEventListener('keydown', onKey);
  addEventListener('keyup', e => handleKey(e));
  try {
    api3d = await import('./view3d.js');
    api3d.init3d(document.getElementById('pane3d'));
    set3d(api3d);
  } catch (err) {
    console.error(err);
    document.getElementById('hud3d').textContent = '3D view unavailable - it needs an internet connection to load three.js.';
  }
}
start();

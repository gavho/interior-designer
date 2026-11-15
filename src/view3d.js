// Live 3D view built from the same document as the 2D plan (three.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { S, on, emit, touch, commit, select, isSel, find } from './state.js';
import { rad, lerp, clamp, dot, sub, mul, add, pointInPoly } from './util.js';
import { partsFor, resolveColor, getDef } from './catalog.js';
import { getFloor, floorCanvas, getFinish, finishCanvas, grainCanvas } from './materials.js';
import { sits, surfaceUnder, riders } from './ops.js';
import { contentBounds } from './editor2d.js';
import { POINT_KINDS, CABLE_KINDS, cable3d } from './electrical.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunPosition, zonedInstant, daylight } from './sun.js';
import { site, floorElev, bearingDir, toPlan, fetchImagery } from './site.js';

let renderer, scene, camera, controls, pane, sun, hemi, structure, itemsGroup, helpers, ground;
let wallMode = 'auto', structSig = '', wallObjs = [], needFit = true;
let quality = 'standard', composer = null, pt = null, ptActive = false, ptEnv = null, ptSaved = null;
const itemObjs = new Map();
let sky = null, context = null, contextSig = '', sunInfo = { az: 180, el: 45 };
const today = new Date(), sunWhen = { date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, minutes: 14 * 60 };
let lastFrame = 0, wallVisSig = '', perfEl = null, dynScale = 1, slowFrames = 0, fastFrames = 0;
const _dir = new THREE.Vector3();
const walk = { yaw: 0, pitch: 0, keys: {} };
/** On-screen walk controls (touch): hold a movement key down or let it go. */
export function setWalkKey(code, down) { walk.keys[code] = down; }
// shadows are re-rendered only when something that casts them changes, not every frame
const shadowsDirty = () => { if (renderer) renderer.shadowMap.needsUpdate = true; };

// ---- shared geometry / materials ----
const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(0.5, 24, 16);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 32).rotateX(Math.PI / 2), HEX = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateX(Math.PI / 2);
const cyls = new Map(), rboxes = new Map(), mats = new Map(), floorTex = new Map();
const cylGeo = t => { if (!cyls.has(t)) cyls.set(t, new THREE.CylinderGeometry(0.5 * t, 0.5, 1, 32)); return cyls.get(t); };
// rounded boxes are built at their real size (scaling a shared one would squash the corner radius)
function rboxGeo(p) {
  const r = Math.min(p.r, Math.min(p.w, p.h, p.d) * 0.499), k = [p.w, p.h, p.d, r].map(v => v.toFixed(4)).join('|');
  if (!rboxes.has(k)) rboxes.set(k, new RoundedBoxGeometry(p.w, p.h, p.d, 3, r));
  return rboxes.get(k);
}
// what a switched-on monitor shows: a wallpaper with a couple of windows
let displayTex = null;
function displayMap() {
  if (displayTex) return displayTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const g = c.getContext('2d'), bg = g.createLinearGradient(0, 0, 512, 288);
  bg.addColorStop(0, '#27408b'); bg.addColorStop(0.55, '#7a5fc0'); bg.addColorStop(1, '#f0a37c'); g.fillStyle = bg; g.fillRect(0, 0, 512, 288);
  g.fillStyle = '#1b1e26'; g.fillRect(28, 26, 270, 206); g.fillStyle = '#2a2e3a'; g.fillRect(28, 26, 270, 16);
  ['#e0625a', '#e8b44a', '#5fbf6a'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(40 + i * 12, 34, 3.5, 0, 7); g.fill(); });
  for (let i = 0; i < 17; i++) { g.fillStyle = ['#7aa2f7', '#c0caf5', '#9ece6a', '#bb9af7', '#e0af68'][(i * 7) % 5]; g.fillRect(42 + ((i * 5) % 4) * 12, 52 + i * 10, 40 + ((i * 37) % 150), 4); }
  g.fillStyle = '#f4f4f1'; g.fillRect(318, 58, 168, 150); g.fillStyle = '#d9dbe0'; g.fillRect(318, 58, 168, 16);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 4 ? '#b9bcc4' : '#4a4f5c'; g.fillRect(332, 88 + i * 12, i % 4 ? 110 + ((i * 29) % 30) : 70, 4); }
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(156, 260, 200, 20);
  displayTex = new THREE.CanvasTexture(c); displayTex.colorSpace = THREE.SRGBColorSpace; displayTex.anisotropy = 8;
  return displayTex;
}
function mat(color, kind = 'std') {
  const k = color + kind;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial(
    kind === 'glass' ? { color, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }
    : kind === 'metal' ? { color, roughness: 0.3, metalness: 0.75 }
    : kind === 'gloss' ? { color, roughness: 0.15, metalness: 0.3 }
    : kind === 'led' ? { color, emissive: color, emissiveIntensity: 1.4, roughness: 0.5 }
    : kind === 'display' ? { map: displayMap(), emissiveMap: displayMap(), emissive: '#ffffff', emissiveIntensity: 0.85, roughness: 0.25 }
    : { color, roughness: 0.82 }));
  return mats.get(k);
}
// tiled / panelled surfaces (wall finishes, backsplashes) and wood grain for furniture
const texMats = new Map();
function texMat(color, texId, rx, ry) {
  const k = [color, texId, rx.toFixed(2), ry.toFixed(2)].join('|');
  if (!texMats.has(k)) {
    const tex = new THREE.CanvasTexture(finishCanvas(texId));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(rx, ry); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    texMats.set(k, new THREE.MeshStandardMaterial({ map: tex, color, roughness: /tile|subway|hex|marble/.test(texId) ? 0.22 : 0.85 }));
  }
  return texMats.get(k);
}
function grainMat(color, vertical) {
  const k = color + (vertical ? 'gv' : 'gh');
  if (!texMats.has(k)) {
    const tex = new THREE.CanvasTexture(grainCanvas());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (vertical) { tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2; }
    texMats.set(k, new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.55 }));
  }
  return texMats.get(k);
}
const kindOf = c => (c === 'glass' ? 'glass' : c === 'display' || c === 'led' ? c : c === 'metal' || c === 'steel' || c === 'alu' || c === 'mirror' ? 'metal' : c === 'screen' || c === 'black' ? 'gloss' : 'std');

function box(w, h, d, x, y, z, material, shadow = true) {
  const m = new THREE.Mesh(BOX, material);
  m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = shadow && !material.transparent; m.receiveShadow = true;
  return m;
}

// ---- furniture ----
const models = new Map();
function loadModel(assetId) {
  if (!models.has(assetId)) {
    const as = S.assets[assetId];
    const p = !as ? Promise.reject(new Error('missing asset'))
      : (as.kind === 'obj' ? new OBJLoader().loadAsync(as.data) : as.kind === 'remote' ? remoteLoader(as).loadAsync(as.url).then(g => g.scene) : new GLTFLoader().loadAsync(as.data).then(g => g.scene)).then(obj => {
        const b = new THREE.Box3().setFromObject(obj), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        obj.position.set(obj.position.x - c.x, obj.position.y - b.min.y, obj.position.z - c.z);
        obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (as.kind === 'obj') o.material = mat('#c8ccd2'); } });
        const holder = new THREE.Group(); holder.add(obj); holder.userData.size = size;
        return holder;
      });
    models.set(assetId, p);
  }
  return models.get(assetId);
}

// Models referenced by URL (e.g. Poly Haven) keep their textures in separate files listed in `include`.
function remoteLoader(as) {
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier(u => { for (const rel in as.include || {}) if (decodeURI(u).endsWith(rel)) return as.include[rel]; return u; });
  return new GLTFLoader(mgr);
}

/** Natural size (metres, guessing the unit) and a top-down thumbnail for a freshly imported model. */
export async function measureModel(assetId) {
  const holder = await loadModel(assetId), s = holder.userData.size, max = Math.max(s.x, s.y, s.z);
  const k = max > 400 ? 0.001 : max > 12 ? 0.01 : 1;
  let thumb = null;
  try {
    const N = 256, hgt = Math.max(16, Math.round((N * s.z) / s.x)), rt = new THREE.WebGLRenderTarget(N, hgt);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x999999, 2.4), holder);
    const cam = new THREE.OrthographicCamera(-s.x / 2, s.x / 2, s.z / 2, -s.z / 2, 0.01, s.y * 4 + 10);
    cam.position.set(0, s.y * 2 + 1, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
    const buf = new Uint8Array(N * hgt * 4); renderer.readRenderTargetPixels(rt, 0, 0, N, hgt, buf);
    renderer.setRenderTarget(null); rt.dispose(); sc.remove(holder);
    const cv = document.createElement('canvas'); cv.width = N; cv.height = hgt;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, hgt);
    for (let y = 0; y < hgt; y++) img.data.set(buf.subarray((hgt - 1 - y) * N * 4, (hgt - y) * N * 4), y * N * 4);
    ctx.putImageData(img, 0, 0); thumb = cv.toDataURL('image/png');
  } catch (e) { renderer.setRenderTarget(null); }
  return { w: s.x * k, h: s.y * k, d: s.z * k, thumb };
}

const texLoader = new THREE.TextureLoader();
function buildItem(it) {
  const g = new THREE.Group();
  if (it.type === 'model') {
    const ph = box(it.w, it.h, it.d, 0, it.h / 2, 0, mat(it.color, 'glass'), false);
    g.add(ph);
    loadModel(it.assetId).then(holder => {
      if (itemObjs.get(it.id)?.group !== g) return;
      const inst = holder.clone(true), s = holder.userData.size;
      inst.scale.set(it.w / (s.x || 1), it.h / (s.y || 1), it.d / (s.z || 1));
      g.remove(ph); g.add(inst); shadowsDirty();
    }).catch(() => {});
    return g;
  }
  if (it.type === 'product') {
    const base = mat(it.color), src = it.image || S.assets[it.assetId]?.data;
    let faces = base;
    if (src) {
      const tex = texLoader.load(src, undefined, undefined, () => {}); tex.colorSpace = THREE.SRGBColorSpace;
      const pic = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      faces = [base, base, pic, base, pic, base];
    }
    const m = new THREE.Mesh(BOX, faces); m.scale.set(it.w, it.h, it.d); m.position.y = it.h / 2; m.castShadow = m.receiveShadow = true;
    g.add(m);
    return g;
  }
  const def = getDef(it.type), texId = it.tex ?? def.tex, grainFam = it.grain ? (def.mat === 'fabric' || def.mat === 'bed' ? 'b' : 'a') : null;
  const byMat = new Map(); // parts are baked into one mesh per material: far fewer draw calls (a keyboard is dozens of keys)
  for (const p of partsFor(it)) {
    const fam = /^[ab][+-]?$/.test(p.c) ? p.c[0] : null;
    const material = texId && texId !== 'paint' && p.c === 'a' && p.s === 'box' ? texMat(resolveColor('a', it), texId, p.w / getFinish(texId).size, p.h / getFinish(texId).size)
      : grainFam && fam === grainFam ? grainMat(resolveColor(p.c, it), p.h > Math.max(p.w, p.d) * 1.3)
      : mat(resolveColor(p.c, it), kindOf(p.c));
    const geo = p.s === 'box' ? BOX : p.s === 'rbox' ? rboxGeo(p) : p.s === 'sph' ? SPH : p.s === 'disc' ? DISC : p.s === 'hex' ? HEX : cylGeo(p.t ?? 1);
    const m = new THREE.Mesh(geo, material);
    if (p.s !== 'rbox') m.scale.set(p.w, p.h, p.d);
    m.position.set(p.x, p.y + p.h / 2, p.z);
    if (p.rx || p.ry || p.rz) m.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
    m.updateMatrix();
    const geo1 = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m.matrix); geo1.clearGroups();
    for (const a of Object.keys(geo1.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo1.deleteAttribute(a);
    (byMat.get(material) || byMat.set(material, []).get(material)).push(geo1);
  }
  for (const [material, geos] of byMat) {
    const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
    if (geos.length > 1) geos.forEach(q => q.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = !material.transparent; m.receiveShadow = true; m.userData.own = true;
    m.matrixAutoUpdate = false; m.updateMatrix();
    g.add(m);
  }
  return g;
}
const disposeItem = grp => grp.traverse(o => { if (o.userData.own) o.geometry.dispose(); });

function syncItems() {
  const seen = new Set();
  for (const it of S.doc.items) {
    seen.add(it.id);
    const sig = [it.type, it.w, it.d, it.h, it.color, it.color2, it.flip, it.assetId, it.image, it.tex, it.grain, it.slab, it.chaiseW, it.seatH, it.armH, it.seatD, it.leafDown, it.noMattress, it.bed, it.shelf, it.drawerTop, it.led].join('|');
    let o = itemObjs.get(it.id);
    if (!o || o.sig !== sig) {
      if (o) { itemsGroup.remove(o.group); disposeItem(o.group); }
      o = { sig, group: null }; itemObjs.set(it.id, o);
      o.group = buildItem(it); o.group.userData.itemId = it.id; itemsGroup.add(o.group);
    }
    o.group.position.set(it.x, it.elev || 0, it.y); o.group.rotation.y = -rad(it.rot);
  }
  for (const [id, o] of itemObjs) if (!seen.has(id)) { itemsGroup.remove(o.group); disposeItem(o.group); itemObjs.delete(id); }
  syncSelection(); shadowsDirty();
}

// ---- electrical layer: wall plates, floor boxes, power strips and cable runs ----
let elecGroup = null, elecSig = '';
function syncElec() {
  const E = S.doc.elec, show = S.prefs.showElec !== false;
  const sig = show && E ? JSON.stringify([E, S.doc.items.map(i => [i.id, i.x, i.y, i.rot, i.w, i.d, i.elev, i.h]), S.sel.filter(s => s.k === 'elec' || s.k === 'cable')]) : '';
  if (sig === elecSig) return;
  elecSig = sig;
  if (elecGroup) { scene.remove(elecGroup); elecGroup.traverse(o => o.geometry?.dispose?.()); }
  elecGroup = new THREE.Group(); scene.add(elecGroup);
  if (!sig) return;
  const plate = mat('#f6f5f2'), slot = mat('#2b2d31'), hi = mat('#2f7df6');
  for (const q of E.points) {
    const k = POINT_KINDS[q.kind] || POINT_KINDS.outlet, g = new THREE.Group(), sel = isSel('elec', q.id);
    if (k.wall) {
      g.add(box(0.075, 0.12, 0.008, 0, 0, 0.004, sel ? hi : plate, false));
      if (q.kind === 'switch') g.add(box(0.012, 0.03, 0.01, 0, 0, 0.01, slot, false));
      else if (['data', 'coax', 'hdmi'].includes(q.kind)) g.add(box(0.022, 0.02, 0.006, 0, 0, 0.009, slot, false));
      else for (const dy of [-0.025, 0.025]) g.add(box(0.03, 0.02, 0.006, 0, dy, 0.009, slot, false));
      g.position.set(q.x, q.z, q.y);
    } else if (q.kind === 'strip') { g.add(box(0.3, 0.04, 0.06, 0, 0.02, 0, sel ? hi : mat('#2b2d31'), false)); g.position.set(q.x, q.z - 0.02, q.y); }
    else if (q.kind === 'ceiling') { g.add(box(0.12, 0.01, 0.12, 0, 0, 0, sel ? hi : plate, false)); g.position.set(q.x, q.z, q.y); }
    else { g.add(box(0.12, 0.008, 0.12, 0, 0.004, 0, sel ? hi : mat('#b9bdc3', 'metal'), false)); g.position.set(q.x, 0, q.y); }
    g.rotation.y = -rad(q.rot || 0);
    elecGroup.add(g);
  }
  for (const c of E.cables) {
    const pts = cable3d(c); if (!pts || pts.length < 2) continue;
    const path = new THREE.CurvePath();
    for (let i = 1; i < pts.length; i++) {
      const a = new THREE.Vector3(pts[i - 1].x, pts[i - 1].z, pts[i - 1].y), b = new THREE.Vector3(pts[i].x, pts[i].z, pts[i].y);
      if (a.distanceTo(b) > 1e-4) path.add(new THREE.LineCurve3(a, b));
    }
    if (!path.curves.length) continue;
    const m = isSel('cable', c.id) ? hi : mat((CABLE_KINDS[c.kind] || CABLE_KINDS.other).color);
    elecGroup.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, path.curves.length * 6), 0.006, 6, false), m));
  }
}

// ---- walls, openings, floors ----
function buildOpening(o, x0, x1, top, t, group) {
  const w = x1 - x0, cx = (x0 + x1) / 2, fr = mat(o.style === 'glass' ? '#2b2d31' : '#f4f1ea'), ft = 0.05, fd = t + 0.03;
  if (o.style === 'opening') return;
  const y0 = o.sill, hgt = top - y0;
  if (o.style === 'curtain') { // window wall: thin dark mullions reaching over the pier to the next pane, so the glass reads as one run
    const dk = mat('#2b2d31'), m = 0.035, ex = 0.02;
    group.add(box(m, hgt, fd, x0 + m / 2 - ex, y0 + hgt / 2, 0, dk), box(m, hgt, fd, x1 - m / 2 + ex, y0 + hgt / 2, 0, dk),
      box(w + 2 * ex, m, fd, cx, top - m / 2, 0, dk), box(w + 2 * ex, m, fd + 0.02, cx, y0 + m / 2, 0, dk),
      box(w - 2 * m + 2 * ex, hgt - 2 * m, 0.012, cx, y0 + hgt / 2, 0, mat('#a9d4e6', 'glass'), false));
    return;
  }
  group.add(box(ft, hgt, fd, x0 + ft / 2, y0 + hgt / 2, 0, fr), box(ft, hgt, fd, x1 - ft / 2, y0 + hgt / 2, 0, fr), box(w, ft, fd, cx, top - ft / 2, 0, fr));
  if (o.type === 'window') {
    group.add(box(w, ft, fd + 0.04, cx, y0 + ft / 2, 0, fr), box(w - 2 * ft, hgt - 2 * ft, 0.012, cx, y0 + hgt / 2, 0, mat('#a9d4e6', 'glass'), false));
    if (o.style !== 'picture') group.add(box(0.035, hgt - 2 * ft, 0.04, cx, y0 + hgt / 2, 0, fr), box(w - 2 * ft, 0.035, 0.04, cx, y0 + hgt / 2, 0, fr));
    return;
  }
  const iw = w - 2 * ft, ih = hgt - ft;
  if (o.style === 'sliding') {
    const gl = mat('#a9d4e6', 'glass');
    for (const s of [-1, 1]) group.add(box(iw / 2 + 0.03, ih, 0.012, cx + (s * iw) / 4, y0 + ih / 2, s * 0.02, gl, false), box(0.04, ih, 0.035, cx + s * 0.02, y0 + ih / 2, s * 0.02, mat('#2b2d31')));
    return;
  }
  if (o.style === 'glass') { // full-glass swing door in a window wall: dark frame and the same glass as the panes
    const dk = mat('#2b2d31'), m = 0.05, lx = x0 + ft;
    group.add(box(iw, 0.06, 0.05, cx, y0 + 0.03, 0, dk), box(iw, m, 0.05, cx, y0 + ih - m / 2, 0, dk), box(m, ih, 0.05, lx + m / 2, y0 + ih / 2, 0, dk), box(m, ih, 0.05, x1 - ft - m / 2, y0 + ih / 2, 0, dk),
      box(iw - 2 * m, ih - 0.06 - m, 0.012, cx, y0 + 0.06 + (ih - 0.06 - m) / 2, 0, mat('#a9d4e6', 'glass'), false), box(0.02, 0.3, 0.06, o.hinge === 'left' ? x1 - ft - 0.08 : lx + 0.08, y0 + 1.0, 0, mat('#b9bdc3', 'metal')));
    return;
  }
  const leaf = mat(S.doc.settings.doorColor || '#e8e2d6'), n = o.style === 'double' ? 2 : o.style === 'bifold' ? 4 : 1, lw = iw / n;
  for (let i = 0; i < n; i++) {
    const lx = x0 + ft + lw * (i + 0.5);
    group.add(box(lw - 0.006, ih - 0.01, 0.04, lx, y0 + ih / 2, 0, leaf), box(lw - 0.22, ih * 0.38, 0.046, lx, y0 + ih * 0.72, 0, leaf), box(lw - 0.22, ih * 0.38, 0.046, lx, y0 + ih * 0.27, 0, leaf));
  }
  if (o.style !== 'bifold') {
    const hx = o.style === 'double' ? [cx - 0.06, cx + 0.06] : [o.hinge === 'left' ? x1 - ft - 0.07 : x0 + ft + 0.07];
    for (const x of hx) for (const s of [-1, 1]) { const k = new THREE.Mesh(SPH, mat('#b9bdc3', 'metal')); k.scale.setScalar(0.055); k.position.set(x, y0 + 0.98, s * 0.045); group.add(k); }
  }
}

function buildWall(w, g, ops) {
  const Ht = w.height || S.doc.settings.wallHeight, t = w.thickness, Ln = g.len, group = new THREE.Group();
  const shape = new THREE.Shape(); shape.moveTo(0, 0);
  let last = 0;
  for (const o of ops.slice().sort((a, b) => a.pos - b.pos)) {
    if (o.width > Ln - 0.06) continue;
    const pos = clamp(o.pos, o.width / 2 + 0.02, Ln - o.width / 2 - 0.02), x0 = pos - o.width / 2, x1 = pos + o.width / 2;
    if (x0 < last + 0.01) continue;
    const sill = o.type === 'door' ? 0 : clamp(o.sill, 0.02, Ht - 0.2), top = Math.min(sill + o.height, Ht - 0.03);
    if (sill <= 0) { shape.lineTo(x0, 0); shape.lineTo(x0, top); shape.lineTo(x1, top); shape.lineTo(x1, 0); }
    else { const hp = new THREE.Path(); hp.moveTo(x0, sill); hp.lineTo(x1, sill); hp.lineTo(x1, top); hp.lineTo(x0, top); hp.closePath(); shape.holes.push(hp); }
    buildOpening({ ...o, sill }, x0, x1, top, t, group);
    last = x1;
  }
  shape.lineTo(Ln, 0); shape.lineTo(Ln, Ht); shape.lineTo(0, Ht); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2);
  const pos = geo.attributes.position, e = g.ext; // shear the ends so corners mitre
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), k = pos.getZ(i) / t + 0.5;
    if (x < 1e-4) pos.setX(i, lerp(e.aM, e.aN, k)); else if (x > Ln - 1e-4) pos.setX(i, Ln + lerp(e.bM, e.bN, k));
  }
  geo.computeVertexNormals();
  // split the two big faces into their own material slots so each side of the wall can have its own finish
  const lid = geo.groups.find(q => q.materialIndex === 0), edge = geo.groups.find(q => q.materialIndex === 1), half = lid.count / 2;
  geo.clearGroups(); geo.addGroup(lid.start, half, 1); geo.addGroup(lid.start + half, half, 2); geo.addGroup(edge.start, edge.count, 0);
  const base = w.color || S.doc.settings.wallColor;
  const sideMat = key => { const sd = w.sides?.[key] || {}, f = getFinish(sd.finish); return f.draw ? texMat(sd.color || '#ffffff', f.id, 1 / f.size, 1 / f.size) : mat(sd.color || base); };
  const m = new THREE.Mesh(geo, [mat(base), sideMat('m'), sideMat('n')]);
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  group.position.set(w.a.x, 0, w.a.y); group.rotation.y = -Math.atan2(g.dir.y, g.dir.x);
  return group;
}

function floorMaterial(id) {
  if (!floorTex.has(id)) {
    const f = getFloor(id), tex = new THREE.CanvasTexture(floorCanvas(id));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / f.size, 1 / f.size); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    floorTex.set(id, new THREE.MeshStandardMaterial({ map: tex, roughness: f.kind === 'tile' ? 0.35 : 0.85, side: THREE.DoubleSide }));
  }
  return floorTex.get(id);
}

function syncStructure() {
  const d = S.doc, sig = JSON.stringify([d.walls, d.openings, d.settings, S.rooms.map(r => [r.poly, r.meta.floor])]);
  if (sig === structSig) return;
  structSig = sig;
  structure.traverse(o => { if (o.isMesh && o.geometry !== BOX && o.geometry !== SPH) o.geometry.dispose(); });
  structure.clear(); wallObjs = [];
  for (const r of S.rooms) {
    const sh = new THREE.Shape(r.poly.map(p => new THREE.Vector2(p.x, p.y)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), floorMaterial(r.meta.floor));
    m.position.y = 0.002; m.receiveShadow = true;
    structure.add(m);
  }
  const b = contentBounds(), c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  for (const w of d.walls) {
    const g = S.wallGeom.get(w.id); if (!g || g.len < 0.02) continue;
    const group = buildWall(w, g, d.openings.filter(o => o.wallId === w.id));
    const mid = mul(add(w.a, w.b), 0.5);
    wallObjs.push({ group, mid, n: dot(sub(mid, c), g.n) >= 0 ? g.n : mul(g.n, -1) });
    structure.add(group);
  }
  const R = Math.max(b.x1 - b.x0, b.y1 - b.y0, 4);
  syncContext(b, c, R);
  structure.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; }); // walls never move between syncs
  structure.matrixAutoUpdate = true;
  Object.assign(sun.userData, { c, R }); placeSun();
}

// The street, your own building below the unit, and the neighbours (from OpenStreetMap, saved in the project).
function syncContext(b, c, R) {
  const st = site(), elev = floorElev(st), sig = JSON.stringify([st, c.x.toFixed(2), c.y.toFixed(2)]);
  const reach = st.buildings?.length ? Math.max(700, (st.radius || 250) * 2.8) : R * 12;
  ground.position.set(c.x, -elev - 0.02, c.y); ground.scale.setScalar(reach);
  if (sig === contextSig) return;
  contextSig = sig;
  if (context) { scene.remove(context); context.traverse(o => o.geometry?.dispose()); }
  context = new THREE.Group(); scene.add(context); ground.visible = true; // until the map imagery takes its place
  const facade = mat('#b9bcc0'), slab = mat('#9fa3a8');
  const own = st.buildings?.find(bd => bd.own);
  if (elev > 0.2 && !own) { // the floors below yours: a plain block under the plan
    const m = box(b.x1 - b.x0 + 0.4, elev - 0.05, b.y1 - b.y0 + 0.4, c.x, -elev / 2 - 0.05, c.y, slab);
    context.add(m);
  }
  const prism = (pts, from, to) => {
    const shape = new THREE.Shape(pts.map(q => new THREE.Vector2(q.x, -q.y)));
    return new THREE.ExtrudeGeometry(shape, { depth: to - from, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, from - elev, 0);
  };
  const add = (geo, material) => { const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; context.add(m); return m; };
  const extrude = (pts, from, to, material) => add(prism(pts, from, to), material);
  // the neighbours, merged per 100 m tile: a wide radius can bring in thousands, and tiles keep sun-hours rays quick
  const tiles = new Map();
  for (const bd of st.buildings || []) {
    const pts = bd.pts.map(([la, lo]) => toPlan(la, lo, st, c));
    if (pts.length < 3) continue;
    if (!bd.own) { const k = `${Math.floor(pts[0].x / 100)},${Math.floor(pts[0].y / 100)}`; tiles.has(k) || tiles.set(k, []); tiles.get(k).push(prism(pts, 0, bd.h)); continue; }
    // your own building: the floors below the unit always, the ones above with the neighbours; your storey stays open
    if (elev > 0.2) extrude(pts, 0, elev - 0.05, slab);
    const top = elev + st.floorHeight, h = st.storeys ? st.storeys * st.floorHeight : bd.h;
    if (h > top + 0.5) { // the storeys above can't shade your own windows (the facade is straight), so they cast no shadow here
      const m = extrude(pts, top, h, facade); m.userData.neighbour = m.userData.above = true; m.castShadow = false;
    }
  }
  for (const geos of tiles.values()) { add(mergeGeometries(geos), facade).userData.neighbour = true; geos.forEach(g => g.dispose()); }
  context.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  if (st.imagery) layImagery(st, c, elev, context);
  showContext();
}

// map tiles laid on the street; fetched once per spot and kind, kept for the session (too big to save in the project)
const imageryCache = new Map();
async function layImagery(st, c, elev, into) {
  const radius = (st.radius || 250) + 100, key = `${st.imagery}|${st.detail}|${radius}|${st.lat.toFixed(3)}|${st.lon.toFixed(3)}`;
  if (!imageryCache.has(key)) imageryCache.set(key, fetchImagery(st.lat, st.lon, st.imagery, radius, st.detail || 17).then(im => {
    const tex = new THREE.CanvasTexture(im.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return { tex, corners: im.corners };
  }).catch(() => (imageryCache.delete(key), null)));
  const im = await imageryCache.get(key);
  if (!im || context !== into) return; // failed, or the street was rebuilt while the tiles came in
  const p = im.corners.map(q => toPlan(q.lat, q.lon, st, c)), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap(q => [q.x, 0, q.y]), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geo.setIndex([0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
  // the photo is lit already: dim it so the sun doesn't wash it out
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: im.tex, color: '#8a8a8a', roughness: 1 }));
  m.position.y = -elev + 0.03; m.receiveShadow = true; m.userData.imagery = true; m.raycast = () => {};
  m.updateMatrix(); m.matrixAutoUpdate = false; into.add(m);
  ground.visible = false; // two planes centimetres apart flicker through each other far away: the imagery is the ground now
  shadowsDirty();
}

function placeSun() {
  const { c, R } = sun.userData.c ? sun.userData : { c: { x: 0, y: 0 }, R: 10 };
  const st = site(), p = sunPosition(zonedInstant(sunWhen.date, sunWhen.minutes, st.tz), st.lat, st.lon);
  sunInfo = p;
  const dir = bearingDir(p.az, st.north), el = rad(Math.max(p.el, 1)), far = st.buildings?.length ? Math.max(R * 2, 400) : R * 2;
  sun.position.set(c.x + dir.x * Math.cos(el) * far, Math.sin(el) * far, c.y + dir.y * Math.cos(el) * far);
  sun.target.position.set(c.x, 0, c.y); sun.target.updateMatrixWorld();
  const day = clamp(p.el / 8, 0, 1), high = clamp(p.el / 45, 0, 1), warm = 1 - clamp(p.el / 25, 0, 1);
  sun.color.setRGB(1, 0.96 - warm * 0.26, 0.88 - warm * 0.48); sun.intensity = day * (1.2 + high * 1.7);
  hemi.intensity = 0.1 + clamp((p.el + 6) / 14, 0, 1) * (0.5 + high * 0.55);
  scene.environmentIntensity = 0.06 + day * 0.24;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -R * 1.1; sc.right = sc.top = R * 1.1; sc.near = 0.5; sc.far = far + R * 3; sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0004 * (R * 6) / sc.far; // the same bias in metres however far the light sits
  if (sky) {
    const e = rad(p.el), u = sky.material.uniforms;
    u.sunPosition.value.set(dir.x * Math.cos(e), Math.sin(e), dir.y * Math.cos(e));
    sky.position.set(c.x, 0, c.y);
  }
  const night = 1 - clamp((p.el + 8) / 14, 0, 1);
  scene.background.setRGB(lerp(0.93 - warm * 0.05, 0.05, night), lerp(0.95 - warm * 0.12, 0.07, night), lerp(0.97 - warm * 0.2, 0.12, night));
  shadowsDirty(); emit('sun', { ...p, ...sunWhen });
}

function syncSelection() {
  helpers.clear();
  for (const s of S.sel) if (s.k === 'item' && itemObjs.has(s.id)) helpers.add(new THREE.BoxHelper(itemObjs.get(s.id).group, 0x2f7df6));
}

// ---- camera ----
export function setCamera(mode) {
  setWalk(false);
  const b = contentBounds(), c = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.y0 + b.y1) / 2), R = Math.max(b.x1 - b.x0, b.y1 - b.y0, 4);
  controls.target.copy(c);
  if (mode === 'top') camera.position.set(c.x, R * 1.35, c.z + 0.01);
  else if (mode === 'front') camera.position.set(c.x, R * 0.45, c.z + R * 1.25);
  else camera.position.set(c.x + R * 0.75, R * 0.9, c.z + R * 0.85);
  controls.update();
}

export function setWalk(v) {
  if (S.walk === v) return;
  S.walk = v; controls.enabled = !v; walk.keys = {};
  if (v) {
    const dir = camera.getWorldDirection(new THREE.Vector3());
    walk.yaw = Math.atan2(-dir.x, -dir.z); walk.pitch = 0;
    const big = [...S.rooms].sort((a, b) => b.area - a.area)[0], p = big ? big.c : { x: controls.target.x, y: controls.target.z };
    camera.position.set(p.x, 1.6, p.y);
  } else { const dir = camera.getWorldDirection(new THREE.Vector3()); controls.target.copy(camera.position).addScaledVector(dir, 3); camera.position.y = Math.max(camera.position.y, 1.6); controls.update(); }
  showContext();
  emit('walk');
}
/** Neighbouring buildings: on view while walking (or when switched on); they cast their shadows either way. */
// hidden = drawn with an invisible material, so they still cast shadows (the shadow pass skips what the camera's layers skip)
const unseen = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
export function showContext(v = S.prefs.showContext) { const on = S.walk || v; context?.children.forEach(m => { if (m.userData.neighbour) m.material = on ? mat('#b9bcc0') : unseen; }); }
export const setWallMode = m => { wallMode = m; };

// ---- sun-hours map: hours of direct sun on each spot of floor (or furniture top) over the chosen day (walls, furniture and neighbours block it; glass doesn't) ----
let sunMap = null;
export async function sunHours(onProgress = () => {}) {
  clearSunHours();
  const st = site(), { rise, set } = daylight(sunWhen.date, st.tz, st.lat, st.lon);
  if (rise == null || set == null) return null;
  const b = contentBounds(), cell = 0.25, nx = Math.ceil((b.x1 - b.x0) / cell), ny = Math.ceil((b.y1 - b.y0) / cell);
  const dirs = [];
  for (let m = rise + 15; m < set; m += 30) {
    const p = sunPosition(zonedInstant(sunWhen.date, m, st.tz), st.lat, st.lon), d = bearingDir(p.az, st.north), e = rad(p.el);
    if (p.el > 0) dirs.push(new THREE.Vector3(d.x * Math.cos(e), Math.sin(e), d.y * Math.cos(e)));
  }
  const blockers = [structure, itemsGroup, ...(context ? [context] : [])], rc = new THREE.Raycaster(), o = new THREE.Vector3();
  // glass lets the sun through (hidden neighbours' material isn't transparent: they still block); the storeys above your own
  // can't reach your windows, and only stop rays when the map footprint and the plan don't quite line up
  const blocks = h => !h.object.material?.transparent && !h.object.userData.above;
  scene.updateMatrixWorld(true);
  const ceil = S.doc.settings.wallHeight || 2.6;
  const hours = new Float32Array(nx * ny).fill(-1), at =new Float32Array(nx * ny), down = new THREE.Vector3(0, -1, 0);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = b.x0 + (i + 0.5) * cell, y = b.y0 + (j + 0.5) * cell;
      if (!S.rooms.some(r => pointInPoly({ x, y }, r.poly))) continue;
      // measure where the sun lands: the floor, or the top of the sofa, bed or table standing on it
      rc.set(o.set(x, 2.2, y), down); rc.far = 2.2;
      const top = rc.intersectObject(itemsGroup, true).find(blocks), y0 = top ? top.point.y + 0.02 : 0.05;
      let lit = 0;
      for (const d of dirs) {
        // the ceiling (the slab above, which the 3D view leaves off): a ray rising past it over any room is stopped there
        const up = (ceil - y0) / d.y, cx = x + d.x * up, cy = y + d.z * up;
        if (y0 < ceil && S.rooms.some(r => pointInPoly({ x: cx, y: cy }, r.poly))) continue;
        rc.set(o.set(x, y0, y), d); rc.far = 600; if (!rc.intersectObjects(blockers, true).some(blocks)) lit++;
      }
      hours[j * nx + i] = lit * 0.5; at[j * nx + i] = top ? top.point.y : 0; // the surface the tile is painted on
    }
    if (j % 4 === 0) { onProgress(j / ny); await new Promise(r => setTimeout(r)); }
  }
  // paint it where it was measured, a tile per spot: on the floor, or on the sofa, bed or table standing there
  const cells = []; for (let k = 0; k < hours.length; k++) if (hours[k] >= 0) cells.push(k);
  sunMap = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell, cell).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false }), cells.length);
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach((k, n) => {
    const i = k % nx, j = Math.floor(k / nx);
    sunMap.setMatrixAt(n, mtx.makeTranslation(b.x0 + (i + 0.5) * cell, at[k] + 0.012, b.y0 + (j + 0.5) * cell));
    sunMap.setColorAt(n, col.setRGB(...sunColor(hours[k]).map(v => v / 255), THREE.SRGBColorSpace));
  });
  sunMap.renderOrder = 2; sunMap.raycast = () => {}; sunMap.frustumCulled = false; // its bounds would be one tile's
  scene.add(sunMap);
  // the summary, room by room: the average, and how much of the room gets 2 hours of sun or more
  const rooms = new Map();
  let max = 0, sum = 0;
  for (const k of cells) {
    const v = hours[k], p = { x: b.x0 + ((k % nx) + 0.5) * cell, y: b.y0 + (Math.floor(k / nx) + 0.5) * cell };
    max = Math.max(max, v); sum += v;
    const r = S.rooms.find(r => pointInPoly(p, r.poly)), name = r?.meta?.name || 'Room';
    const e = rooms.get(r) || rooms.set(r, { name, n: 0, sum: 0, sunny: 0 }).get(r);
    e.n++; e.sum += v; if (v >= 2) e.sunny++;
  }
  return {
    max, avg: cells.length ? sum / cells.length : 0, day: (set - rise) / 60,
    rooms: [...rooms.values()].map(e => ({ name: e.name, avg: e.sum / e.n, sunny: e.sunny / e.n })).sort((a, b) => b.avg - a.avg),
  };
}
// deep blue (no sun) through sky blue and amber to pale yellow (6 h or more); the legend draws the same ramp
export const SUN_RAMP = [[40, 70, 160], [90, 170, 220], [250, 200, 70], [255, 240, 160]], SUN_FULL = 6;
function sunColor(hrs) {
  const t = Math.min(1, hrs / SUN_FULL) * (SUN_RAMP.length - 1), a = Math.min(Math.floor(t), SUN_RAMP.length - 2), f = t - a;
  return [0, 1, 2].map(c => SUN_RAMP[a][c] + (SUN_RAMP[a + 1][c] - SUN_RAMP[a][c]) * f);
}
export function clearSunHours() { if (sunMap) { scene.remove(sunMap); sunMap.geometry.dispose(); sunMap.material.dispose(); sunMap.dispose(); sunMap = null; } }

/** Sun by date ('YYYY-MM-DD') and local time at the site (minutes after midnight). */
export function setSunTime(patch) { Object.assign(sunWhen, patch); placeSun(); }
export const getSunTime = () => ({ ...sunWhen, ...sunInfo });
export const setSky = v => { if (sky) sky.visible = v; };
export const setShadows = v => { renderer.shadowMap.enabled = v; sun.castShadow = v; mats.forEach(m => (m.needsUpdate = true)); floorTex.forEach(m => (m.needsUpdate = true)); shadowsDirty(); };
export function snapshot() { if (ptActive) return renderer.domElement.toDataURL('image/png'); helpers.visible = false; quality === 'high' && composer ? composer.render() : renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png'); helpers.visible = true; return url; }

function frame(now) {
  requestAnimationFrame(frame);
  if (!pane.offsetWidth || !S.doc) return;
  const ms = now - lastFrame, dt = Math.min(0.05, ms / 1000); lastFrame = now;
  if (S.walk) {
    const k = walk.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    walk.yaw += ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * dt * 1.8;
    const sp = (k.ShiftLeft ? 4 : 1.8) * dt, sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
    camera.position.x += (-sy * f + cy * s) * sp; camera.position.z += (-cy * f - sy * s) * sp;
    camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  } else controls.update();
  if (ptActive) { pt.renderSample(); return; }
  const above = camera.position.y > 0 && !S.walk, steep = Math.abs(camera.getWorldDirection(_dir).y) > 0.97;
  let vis = '';
  for (const w of wallObjs) {
    w.group.visible = wallMode === 'full' || S.walk || (wallMode === 'auto' && (steep || !above || (camera.position.x - w.mid.x) * w.n.x + (camera.position.z - w.mid.y) * w.n.y < 0));
    vis += w.group.visible ? 1 : 0;
  }
  if (vis !== wallVisSig) { wallVisSig = vis; shadowsDirty(); } // a hidden wall stops casting its shadow
  helpers.children.forEach(h => h.update());
  quality === 'high' && composer ? composer.render() : renderer.render(scene, camera);
  adapt(ms);
  if (perfEl) perfStats(ms);
}

// Adaptive resolution: render fewer pixels while frames are slow, sharpen again when there is headroom.
function adapt(ms) {
  if (S.prefs.adaptiveRes === false || ms > 250) return; // a long gap is a hidden tab, not a slow frame
  if (ms > 20) { fastFrames = 0; if (++slowFrames > 20 && dynScale > 0.6) { dynScale = Math.max(0.6, dynScale - 0.1); slowFrames = 0; applyPixelRatio(); } }
  else if (ms < 13) { slowFrames = 0; if (++fastFrames > 180 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.1); fastFrames = 0; applyPixelRatio(); } }
}
const baseRatio = () => Math.min(window.devicePixelRatio, quality === 'high' ? 2.5 : 1.5);
function applyPixelRatio() { renderer.setPixelRatio(baseRatio() * dynScale); resize(); }

// F3: frame time, draw calls and triangles
let perfAcc = { n: 0, ms: 0, t: 0 };
export function togglePerf() {
  if (perfEl) { perfEl.remove(); perfEl = null; return false; }
  perfEl = document.createElement('div'); perfEl.className = 'perf3d'; pane.append(perfEl); return true;
}
function perfStats(ms) {
  perfAcc.n++; perfAcc.ms += ms;
  if (performance.now() - perfAcc.t < 500) return;
  const i = renderer.info.render, avg = perfAcc.ms / perfAcc.n;
  perfEl.textContent = `${Math.round(1000 / avg)} fps · ${avg.toFixed(1)} ms · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · ${Math.round(dynScale * 100)}% res`;
  perfAcc = { n: 0, ms: 0, t: performance.now() };
}

/** 'standard' or 'high' (ambient occlusion, sharper shadows, full-resolution rendering). */
export function setQuality(q) {
  quality = q;
  const hi = q === 'high';
  renderer.setPixelRatio(baseRatio() * dynScale);
  sun.shadow.mapSize.set(hi ? 4096 : 2048, hi ? 4096 : 2048); sun.shadow.map?.dispose(); sun.shadow.map = null; shadowsDirty();
  if (hi && !composer) {
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { samples: 4, type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, pane.clientWidth, pane.clientHeight);
    ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.2, thickness: 1.2, scale: 1.25, samples: 16 });
    composer.addPass(ao); composer.addPass(new OutputPass());
  }
  resize();
}

// ---- photo render: progressive path tracing of the current view ----
export async function startRender() {
  if (ptActive) return;
  const m = await import('three-gpu-pathtracer');
  if (!pt) {
    pt = new m.WebGLPathTracer(renderer);
    pt.bounces = 6; pt.filterGlossyFactor = 0.5; pt.tiles.set(2, 2); pt.dynamicLowRes = true; pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0;
    ptEnv = new m.GradientEquirectTexture(); ptEnv.topColor.set(0xa9c8f5); ptEnv.bottomColor.set(0xe9e4da); ptEnv.update();
  }
  setWalk(false);
  ptSaved = { env: scene.environment, bg: scene.background, k: scene.environmentIntensity };
  scene.environment = ptEnv; scene.background = ptEnv; scene.environmentIntensity = 0.7;
  helpers.visible = false; ground.visible = true; if (sky) sky.visible = false; // the path tracer has its own sky
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); resize();
  pt.setScene(scene, camera);
  ptActive = true; emit('render');
}
export function stopRender() {
  if (!ptActive) return;
  ptActive = false;
  scene.environment = ptSaved.env; scene.background = ptSaved.bg; scene.environmentIntensity = ptSaved.k;
  helpers.visible = true; if (sky) sky.visible = S.prefs.sky !== false; setQuality(quality); emit('render');
}
export const renderInfo = () => ({ active: ptActive, samples: pt ? Math.floor(pt.samples) : 0, compiling: !!pt?.isCompiling });

/** Screen position (pane pixels) just above a piece, for the selection toolbar. */
export function projectItem(it) {
  if (!pane?.offsetWidth || S.walk || ptActive) return null;
  const v = new THREE.Vector3(it.x, (it.elev || 0) + it.h, it.y).project(camera);
  return v.z > 1 ? null : { x: ((v.x + 1) / 2) * pane.clientWidth, y: ((1 - v.y) / 2) * pane.clientHeight };
}

function resize() {
  const w = pane.clientWidth, h = pane.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  if (ptActive) pt.updateCamera();
  if (needFit) { needFit = false; setCamera('iso'); }
}

export function init3d(el) {
  pane = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(baseRatio());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  pane.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#eef2f6');
  camera = new THREE.PerspectiveCamera(50, 1, 0.02, 3000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.zoomToCursor = true; controls.rotateSpeed = 0.9; // no inertia: the view stops when the mouse stops
  controls.addEventListener('change', () => { if (ptActive) pt.updateCamera(); });
  controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 0.08; controls.maxDistance = 600; // close enough to inspect a keyboard
  hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8bb, 1.0);
  sun = new THREE.DirectionalLight(0xfff3dc, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 1 }));
  ground.receiveShadow = true;
  structure = new THREE.Group(); itemsGroup = new THREE.Group(); helpers = new THREE.Group();  scene.add(hemi, sun, sun.target, new THREE.AmbientLight(0xffffff, 0.15), ground, structure, itemsGroup, helpers);
  sky = new Sky(); sky.scale.setScalar(2400); sky.visible = S.prefs.sky !== false;
  Object.assign(sky.material.uniforms, {}); sky.material.uniforms.turbidity.value = 3; sky.material.uniforms.rayleigh.value = 1.1;
  sky.material.uniforms.mieCoefficient.value = 0.004; sky.material.uniforms.mieDirectionalG.value = 0.8;
  scene.add(sky);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; // soft reflections on metal, glass and tile
  scene.environmentIntensity = 0.3;

  const sync = () => { if (ptActive) stopRender(); clearSunHours(); // a changed plan makes the map stale
    if (!pane.offsetWidth) { structSig = ''; return; } syncStructure(); syncItems(); syncElec(); };
  on('doc', sync); on('sel', () => { syncSelection(); if (pane.offsetWidth) syncElec(); });
  on('load', () => { needFit = true; if (pane.offsetWidth) { sync(); needFit = false; setCamera('iso'); } });
  on('prefs', () => setTimeout(() => { resize(); if (!ptActive) sync(); }, 0));
  new ResizeObserver(() => { resize(); if (!ptActive) sync(); }).observe(pane);

  // select / drag furniture, or look around in walk mode
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), cvs = renderer.domElement;
  let act = null;
  const cast = e => { const r = cvs.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); };
  const onFloor = y => { floor.constant = -y; const p = ray.ray.intersectPlane(floor, new THREE.Vector3()); return p && { x: p.x, y: p.z }; };
  cvs.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (S.walk) { act = { t: 'look', x: e.clientX, y: e.clientY }; cvs.setPointerCapture(e.pointerId); return; }
    cast(e);
    const hit = ray.intersectObjects(itemsGroup.children, true)[0];
    let o = hit?.object; while (o && !o.userData.itemId) o = o.parent;
    const it = o && find('item', o.userData.itemId);
    act = { t: 'click', x: e.clientX, y: e.clientY, it };
    if (it && !isSel('item', it.id)) select([{ k: 'item', id: it.id }]); // first click only selects
    else if (it && !it.locked) {
      const p = onFloor(hit.point.y);
      if (p) { act = { ...act, t: 'drag', py: hit.point.y, off: { x: it.x - p.x, y: it.y - p.y }, moved: false, x0: it.x, y0: it.y, riders: riders([it]).map(r => ({ it: r, x: r.x, y: r.y })) }; controls.enabled = false; cvs.setPointerCapture(e.pointerId); }
    }
  });
  cvs.addEventListener('pointermove', e => {
    if (!act) return;
    if (act.t === 'look') { walk.yaw -= (e.clientX - act.x) * 0.004; walk.pitch = clamp(walk.pitch - (e.clientY - act.y) * 0.004, -1.2, 1.2); act.x = e.clientX; act.y = e.clientY; }
    else if (act.t === 'drag') {
      if (!act.moved && Math.hypot(e.clientX - act.x, e.clientY - act.y) < 4) return;
      cast(e); const p = onFloor(act.py); if (!p) return;
      const g = S.doc.settings.snap, sn = v => (S.prefs.snapGrid ? Math.round(v / g) * g : v);
      act.it.x = sn(p.x + act.off.x); act.it.y = sn(p.y + act.off.y); act.moved = true;
      for (const r of act.riders) { r.it.x = r.x + act.it.x - act.x0; r.it.y = r.y + act.it.y - act.y0; }
      if (sits(act.it)) act.it.elev = surfaceUnder(act.it); // desk-top pieces land on whatever is under them
      touch();
    }
  });
  let tap3 = null, touchAt = 0;
  cvs.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') { // double-tap = double-click
      const now = performance.now(); touchAt = now;
      if ((act?.t === 'click' || (act?.t === 'drag' && !act.moved)) && Math.hypot(e.clientX - act.x, e.clientY - act.y) < 10) {
        if (tap3 && now - tap3.t < 320 && Math.hypot(e.clientX - tap3.x, e.clientY - tap3.y) < 30) { tap3 = null; act = null; controls.enabled = !S.walk; flyTo(e); return; }
        tap3 = { t: now, x: e.clientX, y: e.clientY };
      } else tap3 = null;
    }
    if (act?.t === 'drag') { controls.enabled = !S.walk; if (act.moved) commit(); }
    else if (act?.t === 'click' && !act.it && Math.hypot(e.clientX - act.x, e.clientY - act.y) < 4) select([]);
    act = null;
  });
  cvs.addEventListener('pointercancel', () => { if (act?.t === 'drag') { controls.enabled = !S.walk; if (act.moved) commit(); } act = null; });
  cvs.addEventListener('dblclick', e => { if (performance.now() - touchAt > 800) flyTo(e); });
  function flyTo(e) { // zoom in on a piece
    if (S.walk || ptActive) return;
    cast(e);
    let o = ray.intersectObjects(itemsGroup.children, true)[0]?.object; while (o && !o.userData.itemId) o = o.parent;
    const it = o && find('item', o.userData.itemId); if (!it) return;
    const c = new THREE.Vector3(it.x, (it.elev || 0) + it.h / 2, it.y), dir = camera.position.clone().sub(controls.target).normalize();
    if (dir.y < 0.3) dir.setY(0.3).normalize();
    controls.target.copy(c); camera.position.copy(c).addScaledVector(dir, Math.max(0.25, Math.hypot(it.w, it.d, it.h) * 1.5)); controls.update();
  }
  const key = e => {
    if (e.code === 'F3' && e.type === 'keydown') { togglePerf(); e.preventDefault(); return; }
    if (!S.walk) return;
    if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { walk.keys[e.code] = e.type === 'keydown'; e.preventDefault(); }
  };
  window.addEventListener('keydown', key); window.addEventListener('keyup', key);

  resize(); sync();
  requestAnimationFrame(frame);
}

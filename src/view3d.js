// Live 3D view built from the same document as the 2D plan (three.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { S, on, emit, touch, commit, select, isSel, find } from './state.js';
import { rad, lerp, clamp, dot, sub, mul, add } from './util.js';
import { partsFor, resolveColor, getDef } from './catalog.js';
import { getFloor, floorCanvas, getFinish, finishCanvas, grainCanvas } from './materials.js';
import { contentBounds } from './editor2d.js';

let renderer, scene, camera, controls, pane, sun, hemi, structure, itemsGroup, helpers, ground;
let wallMode = 'auto', structSig = '', wallObjs = [], needFit = true;
let quality = 'standard', composer = null, pt = null, ptActive = false, ptEnv = null, ptSaved = null;
const itemObjs = new Map();
const walk = { yaw: 0, pitch: 0, keys: {}, last: 0 };

// ---- shared geometry / materials ----
const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(0.5, 24, 16);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 32).rotateX(Math.PI / 2);
const cyls = new Map(), mats = new Map(), floorTex = new Map();
const cylGeo = t => { if (!cyls.has(t)) cyls.set(t, new THREE.CylinderGeometry(0.5 * t, 0.5, 1, 32)); return cyls.get(t); };
function mat(color, kind = 'std') {
  const k = color + kind;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial(
    kind === 'glass' ? { color, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }
    : kind === 'metal' ? { color, roughness: 0.3, metalness: 0.75 }
    : kind === 'gloss' ? { color, roughness: 0.15, metalness: 0.3 }
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
const kindOf = c => (c === 'glass' ? 'glass' : c === 'metal' || c === 'steel' || c === 'mirror' ? 'metal' : c === 'screen' || c === 'black' ? 'gloss' : 'std');

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
      g.remove(ph); g.add(inst);
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
  for (const p of partsFor(it)) {
    const fam = /^[ab][+-]?$/.test(p.c) ? p.c[0] : null;
    const material = texId && texId !== 'paint' && p.c === 'a' && p.s === 'box' ? texMat(resolveColor('a', it), texId, p.w / getFinish(texId).size, p.h / getFinish(texId).size)
      : grainFam && fam === grainFam ? grainMat(resolveColor(p.c, it), p.h > Math.max(p.w, p.d) * 1.3)
      : mat(resolveColor(p.c, it), kindOf(p.c));
    const geo = p.s === 'box' ? BOX : p.s === 'sph' ? SPH : p.s === 'disc' ? DISC : cylGeo(p.t ?? 1);
    const m = new THREE.Mesh(geo, material);
    m.scale.set(p.w, p.h, p.d); m.position.set(p.x, p.y + p.h / 2, p.z);
    if (p.ry) m.rotation.y = p.ry;
    m.castShadow = !material.transparent; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

function syncItems() {
  const seen = new Set();
  for (const it of S.doc.items) {
    seen.add(it.id);
    const sig = [it.type, it.w, it.d, it.h, it.color, it.color2, it.flip, it.assetId, it.image, it.tex, it.grain].join('|');
    let o = itemObjs.get(it.id);
    if (!o || o.sig !== sig) {
      if (o) itemsGroup.remove(o.group);
      o = { sig, group: null }; itemObjs.set(it.id, o);
      o.group = buildItem(it); o.group.userData.itemId = it.id; itemsGroup.add(o.group);
    }
    o.group.position.set(it.x, it.elev || 0, it.y); o.group.rotation.y = -rad(it.rot);
  }
  for (const [id, o] of itemObjs) if (!seen.has(id)) { itemsGroup.remove(o.group); itemObjs.delete(id); }
  syncSelection();
}

// ---- walls, openings, floors ----
function buildOpening(o, x0, x1, top, t, group) {
  const w = x1 - x0, cx = (x0 + x1) / 2, fr = mat('#f4f1ea'), ft = 0.05, fd = t + 0.03;
  if (o.style === 'opening') return;
  const y0 = o.sill, hgt = top - y0;
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
  ground.position.set(c.x, -0.02, c.y); ground.scale.setScalar(R * 12);
  Object.assign(sun.userData, { c, R }); placeSun(sun.userData.t ?? 0.42);
}

function placeSun(t) {
  const { c, R } = sun.userData.c ? sun.userData : { c: { x: 0, y: 0 }, R: 10 };
  sun.userData.t = t;
  const az = rad(lerp(-110, 110, t)), el = rad(12 + Math.sin(Math.PI * t) * 58);
  sun.position.set(c.x + Math.sin(az) * Math.cos(el) * R * 2, Math.sin(el) * R * 2, c.y - Math.cos(az) * Math.cos(el) * R * 2);
  sun.target.position.set(c.x, 0, c.y); sun.target.updateMatrixWorld();
  const warm = 1 - Math.sin(Math.PI * t);
  sun.color.setRGB(1, 0.96 - warm * 0.22, 0.88 - warm * 0.42); sun.intensity = 1.3 + Math.sin(Math.PI * t) * 1.5;
  hemi.intensity = 0.55 + Math.sin(Math.PI * t) * 0.55;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -R * 1.1; sc.right = sc.top = R * 1.1; sc.near = 0.5; sc.far = R * 6; sc.updateProjectionMatrix();
  scene.background.setRGB(0.93 - warm * 0.05, 0.95 - warm * 0.12, 0.97 - warm * 0.2);
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
  emit('walk');
}
export const setWallMode = m => { wallMode = m; };
export const setSun = t => placeSun(t);
export const setShadows = v => { renderer.shadowMap.enabled = v; sun.castShadow = v; mats.forEach(m => (m.needsUpdate = true)); floorTex.forEach(m => (m.needsUpdate = true)); };
export function snapshot() { if (ptActive) return renderer.domElement.toDataURL('image/png'); helpers.visible = false; quality === 'high' && composer ? composer.render() : renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png'); helpers.visible = true; return url; }

function frame(now) {
  requestAnimationFrame(frame);
  if (!pane.offsetWidth || !S.doc) return;
  const dt = Math.min(0.05, (now - walk.last) / 1000); walk.last = now;
  if (S.walk) {
    const k = walk.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    walk.yaw += ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * dt * 1.8;
    const sp = (k.ShiftLeft ? 4 : 1.8) * dt, sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
    camera.position.x += (-sy * f + cy * s) * sp; camera.position.z += (-cy * f - sy * s) * sp;
    camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  } else controls.update();
  if (ptActive) { pt.renderSample(); return; }
  const above = camera.position.y > 0 && !S.walk, steep = Math.abs(camera.getWorldDirection(new THREE.Vector3()).y) > 0.97;
  for (const w of wallObjs) {
    w.group.visible = wallMode === 'full' || S.walk || (wallMode === 'auto' && (steep || !above || (camera.position.x - w.mid.x) * w.n.x + (camera.position.z - w.mid.y) * w.n.y < 0));
  }
  helpers.children.forEach(h => h.update());
  quality === 'high' && composer ? composer.render() : renderer.render(scene, camera);
}

/** 'standard' or 'high' (ambient occlusion, sharper shadows, full-resolution rendering). */
export function setQuality(q) {
  quality = q;
  const hi = q === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, hi ? 2.5 : 1.5));
  sun.shadow.mapSize.set(hi ? 4096 : 2048, hi ? 4096 : 2048); sun.shadow.map?.dispose(); sun.shadow.map = null;
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
  helpers.visible = false; ground.visible = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); resize();
  pt.setScene(scene, camera);
  ptActive = true; emit('render');
}
export function stopRender() {
  if (!ptActive) return;
  ptActive = false;
  scene.environment = ptSaved.env; scene.background = ptSaved.bg; scene.environmentIntensity = ptSaved.k;
  helpers.visible = true; setQuality(quality); emit('render');
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  pane.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#eef2f6');
  camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.zoomToCursor = true; controls.rotateSpeed = 0.9; // no inertia: the view stops when the mouse stops
  controls.addEventListener('change', () => { if (ptActive) pt.updateCamera(); });
  controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 0.5; controls.maxDistance = 120;
  hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8bb, 1.0);
  sun = new THREE.DirectionalLight(0xfff3dc, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 1 }));
  ground.receiveShadow = true;
  structure = new THREE.Group(); itemsGroup = new THREE.Group(); helpers = new THREE.Group();
  scene.add(hemi, sun, sun.target, new THREE.AmbientLight(0xffffff, 0.15), ground, structure, itemsGroup, helpers);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; // soft reflections on metal, glass and tile
  scene.environmentIntensity = 0.3;

  const sync = () => { if (ptActive) stopRender(); if (!pane.offsetWidth) { structSig = ''; return; } syncStructure(); syncItems(); };
  on('doc', sync); on('sel', syncSelection);
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
      if (p) { act = { ...act, t: 'drag', py: hit.point.y, off: { x: it.x - p.x, y: it.y - p.y }, moved: false }; controls.enabled = false; cvs.setPointerCapture(e.pointerId); }
    }
  });
  cvs.addEventListener('pointermove', e => {
    if (!act) return;
    if (act.t === 'look') { walk.yaw -= (e.clientX - act.x) * 0.004; walk.pitch = clamp(walk.pitch - (e.clientY - act.y) * 0.004, -1.2, 1.2); act.x = e.clientX; act.y = e.clientY; }
    else if (act.t === 'drag') {
      if (!act.moved && Math.hypot(e.clientX - act.x, e.clientY - act.y) < 4) return;
      cast(e); const p = onFloor(act.py); if (!p) return;
      const g = S.doc.settings.snap, sn = v => (S.prefs.snapGrid ? Math.round(v / g) * g : v);
      act.it.x = sn(p.x + act.off.x); act.it.y = sn(p.y + act.off.y); act.moved = true; touch();
    }
  });
  cvs.addEventListener('pointerup', e => {
    if (act?.t === 'drag') { controls.enabled = !S.walk; if (act.moved) commit(); }
    else if (act?.t === 'click' && !act.it && Math.hypot(e.clientX - act.x, e.clientY - act.y) < 4) select([]);
    act = null;
  });
  const key = e => { if (!S.walk) return; if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { walk.keys[e.code] = e.type === 'keydown'; e.preventDefault(); } };
  window.addEventListener('keydown', key); window.addEventListener('keyup', key);

  resize(); sync();
  requestAnimationFrame(frame);
}

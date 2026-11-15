// Where the plan is in the world: address search (OpenStreetMap Nominatim), nearby buildings (Overpass API) and the
// conversion from map coordinates to plan metres. `north` is the compass bearing of the plan's "up" (−y): 0 = up is north,
// 90 = up is east.
import { S } from './state.js';
import { rad } from './util.js';

export const DEFAULT_SITE = { lat: 41.8781, lon: -87.6298, address: 'Chicago, IL', north: 0, floor: 1, floorHeight: 3.2, tz: 'America/Chicago', buildings: null };
export const site = () => ({ ...DEFAULT_SITE, ...(S.doc.settings.site || {}) });
/** Height of the unit's floor above the street (m). */
export const floorElev = (s = site()) => Math.max(0, (s.floor - 1) * s.floorHeight);

/** Plan-space horizontal direction of a compass bearing (degrees clockwise from north). */
export function bearingDir(bearing, north = site().north) {
  const a = rad(bearing - north); // relative to the plan's up
  return { x: Math.sin(a), y: -Math.cos(a) };
}

/** Map point → plan metres, with the site's lat/lon landing on `origin` (the middle of the plan). */
export function toPlan(lat, lon, s, origin) {
  const e = (lon - s.lon) * 111320 * Math.cos(rad(s.lat)), n = (lat - s.lat) * 110540; // metres east / north
  const E = bearingDir(90, s.north), N = bearingDir(0, s.north);
  return { x: origin.x + E.x * e + N.x * n, y: origin.y + E.y * e + N.y * n };
}

export async function geocode(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': navigator.language || 'en' } });
  if (!r.ok) throw new Error('search');
  return (await r.json()).map(x => ({ name: x.display_name, lat: +x.lat, lon: +x.lon }));
}

/** Plan metres → map point: the inverse of `toPlan`. */
export function toMap(p, s, origin) {
  const dx = p.x - origin.x, dy = p.y - origin.y, E = bearingDir(90, s.north), N = bearingDir(0, s.north);
  const e = dx * E.x + dy * E.y, n = dx * N.x + dy * N.y; // E and N are unit and perpendicular
  return { lat: s.lat + n / 110540, lon: s.lon + e / (111320 * Math.cos(rad(s.lat))) };
}

/**
 * Where the site should be so the plan's outermost corner towards `bearing` (315 = north-west) lands on your building's
 * outermost corner that way. `bounds` is the plan's content box; returns the new { lat, lon } or null without a footprint.
 */
export function cornerSite(s, bounds, bearing) {
  const own = s.buildings?.find(b => b.own);
  if (!own) return null;
  const c = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 }, d = bearingDir(bearing, s.north);
  const far = pts => pts.reduce((m, p) => (p.x * d.x + p.y * d.y > m.x * d.x + m.y * d.y ? p : m));
  const target = far(own.pts.map(([la, lo]) => toPlan(la, lo, s, c)));
  const corner = far([{ x: bounds.x0, y: bounds.y0 }, { x: bounds.x1, y: bounds.y0 }, { x: bounds.x0, y: bounds.y1 }, { x: bounds.x1, y: bounds.y1 }]);
  // moving the site by (target − corner) slides the building the other way, so its corner meets the plan's
  return toMap({ x: c.x + target.x - corner.x, y: c.y + target.y - corner.y }, s, c);
}

/** Buildings within `radius` m as { pts: [[lat, lon]…], h } — the one at the site itself (your own building) marked `own`. */
export async function fetchBuildings(lat, lon, radius = 250) {
  const q = `[out:json][timeout:${radius > 500 ? 90 : 25}];(way["building"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom;`;
  const out = [];
  for (const el of (await overpass(q)).elements) {
    const ring = el.geometry || el.members?.find(m => m.role === 'outer')?.geometry;
    if (!ring || ring.length < 3) continue;
    const t = el.tags || {}, h = parseFloat(t.height) || (parseFloat(t['building:levels']) ? parseFloat(t['building:levels']) * 3.4 : 0) || 10;
    const pts = ring.map(g => [+g.lat.toFixed(6), +g.lon.toFixed(6)]);
    const b = { pts, h: +h.toFixed(1), name: t.name || '' };
    if (inside([lat, lon], pts) && !out.some(o => o.own)) b.own = true;
    out.push(b);
  }
  return out;
}
// the main Overpass server is often full: try the public mirrors, then go round once more after a pause
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function overpass(q) {
  for (let round = 0; round < 2; round++) {
    for (const url of OVERPASS) {
      try {
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (r.ok) return await r.json();
      } catch {}
    }
    await new Promise(ok => setTimeout(ok, 4000));
  }
  throw new Error('overpass');
}

// ---- ground imagery: map tiles around the site, stitched into one picture to lay under the buildings ----
export const IMAGERY = {
  satellite: { url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, credit: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  map: { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, credit: 'Map © OpenStreetMap contributors' },
};
const tileXY = (lat, lon, z) => { const n = 2 ** z, s = Math.sin(rad(lat)); return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }; };
const tileLatLon = (x, y, z) => { const n = 2 ** z; return { lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI, lon: (x / n) * 360 - 180 }; };

/**
 * A picture of the ground `radius` m around a point: { canvas, corners: [nw, ne, se, sw] as { lat, lon } }. `z` is the most
 * detail wanted (17 ≈ 1 m a pixel, 19 ≈ 25 cm); it is lowered as needed to keep the picture within 4096 pixels across.
 */
export async function fetchImagery(lat, lon, kind = 'satellite', radius = 350, z = 17) {
  const tiles = z => radius / ((156543.03 * Math.cos(rad(lat))) / 2 ** z) / 256; // radius in tiles
  while (z > 14 && tiles(z) > 7.5) z--;
  const src = IMAGERY[kind] || IMAGERY.satellite, c = tileXY(lat, lon, z), span = tiles(z);
  const x0 = Math.floor(c.x - span), x1 = Math.floor(c.x + span), y0 = Math.floor(c.y - span), y1 = Math.floor(c.y + span);
  const canvas = document.createElement('canvas'); canvas.width = (x1 - x0 + 1) * 256; canvas.height = (y1 - y0 + 1) * 256;
  const g = canvas.getContext('2d'), jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    jobs.push(new Promise(ok => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { g.drawImage(im, (x - x0) * 256, (y - y0) * 256); ok(1); }; im.onerror = () => ok(0); im.src = src.url(z, x, y); }));
  }
  if (!(await Promise.all(jobs)).some(Boolean)) throw new Error('imagery');
  const nw = tileLatLon(x0, y0, z), se = tileLatLon(x1 + 1, y1 + 1, z);
  return { canvas, credit: src.credit, corners: [nw, { lat: nw.lat, lon: se.lon }, se, { lat: se.lat, lon: nw.lon }] };
}

function inside([y, x], pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i], [yj, xj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// self-check: with up = north, a point due east lands to the right (+x) and due north lands up (−y)
{
  const s = { lat: 40, lon: -80, north: 0 }, o = { x: 0, y: 0 };
  const e = toPlan(40, -79.999, s, o), n = toPlan(40.001, -80, s, o);
  console.assert(e.x > 70 && Math.abs(e.y) < 1e-6 && n.y < -100 && Math.abs(n.x) < 1e-6, 'site: map to plan axes', e, n);
  const r = toPlan(40, -79.999, { ...s, north: 90 }, o); // up is east: east lands up
  console.assert(r.y < -70 && Math.abs(r.x) < 1e-6, 'site: north rotation', r);
  const m = toMap(toPlan(40.0003, -79.9996, { ...s, north: 30 }, o), { ...s, north: 30 }, o);
  console.assert(Math.abs(m.lat - 40.0003) < 1e-9 && Math.abs(m.lon + 79.9996) < 1e-9, 'site: map round trip', m);
}

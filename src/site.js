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

/** Buildings within `radius` m as { pts: [[lat, lon]…], h } — the one at the site itself (your own building) left out. */
export async function fetchBuildings(lat, lon, radius = 250) {
  const q = `[out:json][timeout:25];(way["building"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error('overpass');
  const out = [];
  for (const el of (await r.json()).elements) {
    const ring = el.geometry || el.members?.find(m => m.role === 'outer')?.geometry;
    if (!ring || ring.length < 3) continue;
    const t = el.tags || {}, h = parseFloat(t.height) || (parseFloat(t['building:levels']) ? parseFloat(t['building:levels']) * 3.4 : 0) || 10;
    const pts = ring.map(g => [+g.lat.toFixed(6), +g.lon.toFixed(6)]);
    if (inside([lat, lon], pts)) continue;
    out.push({ pts, h: +h.toFixed(1), name: t.name || '' });
  }
  return out;
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
}

// Where the sun is: NOAA solar position (good to a fraction of a degree) for a place and moment, plus local-time helpers.
const RAD = Math.PI / 180;

/** Sun azimuth (degrees clockwise from true north) and elevation (degrees above the horizon) at a UTC instant. */
export function sunPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T, lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60, eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime = 4 / RAD * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD)); // minutes
  const utcMin = (date.getTime() / 60000) % 1440, trueSolar = (((utcMin + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = (trueSolar / 4 < 0 ? trueSolar / 4 + 180 : trueSolar / 4 - 180) * RAD, phi = lat * RAD;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha), zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / RAD + 180;
  let el = 90 - zen / RAD;
  if (el > -0.575) el += refraction(el);
  return { az: ((az % 360) + 360) % 360, el };
}
function refraction(el) { // degrees, Sæmundsson
  return 1.02 / Math.tan((el + 10.3 / (el + 5.11)) * RAD) / 60;
}

/** The UTC instant of a wall-clock time (date 'YYYY-MM-DD', minutes after midnight) in an IANA time zone. */
export function zonedInstant(date, minutes, tz) {
  const [Y, Mo, D] = date.split('-').map(Number), guess = Date.UTC(Y, Mo - 1, D, 0, minutes);
  const off = t => { // zone offset (ms) at instant t
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
        .formatToParts(new Date(t)).map(x => [x.type, x.value]));
      return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
    } catch { return -new Date(t).getTimezoneOffset() * 60000; }
  };
  const first = guess - off(guess);
  return new Date(guess - off(first)); // second pass gets daylight-saving changeovers right
}

/** Sunrise and sunset (minutes after local midnight) by scanning the day; null when the sun never crosses. */
export function daylight(date, tz, lat, lon) {
  let rise = null, set = null, prev = null;
  for (let m = 0; m <= 1440; m += 5) {
    const up = sunPosition(zonedInstant(date, m, tz), lat, lon).el > -0.833;
    if (prev !== null && up !== prev) up ? (rise ??= m) : (set = m);
    prev = up;
  }
  return { rise, set };
}

// self-check: Chicago, 21 June 2026 near solar noon (≈ 12:50 CDT) the sun is ~71.6° up, due south
{
  const p = sunPosition(zonedInstant('2026-06-21', 12 * 60 + 50, 'America/Chicago'), 41.8781, -87.6298);
  console.assert(Math.abs(p.el - 71.6) < 0.6 && Math.abs(p.az - 180) < 6, 'sun: Chicago solstice noon should be ~71.6° due south', p);
}

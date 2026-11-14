// The one API the walk HUD (hud/, a separate React bundle) uses to read and change the app. Exposed as window.interior.
import { S, on, emit, commit, undo, redo, select, setPref } from './state.js';
import { CATALOG, CATEGORIES, getDef, thumbnail } from './catalog.js';
import { FLOORS, SWATCHES, getFloor } from './materials.js';
import { fmtLen } from './util.js';
import { contentBounds } from './editor2d.js';
import * as sandbox from './sandbox.js';

const thumbs = new Map();
export function makeBridge(api3d) {
  return {
    S, on, emit, commit, undo, redo, select, setPref, sandbox, api3d,
    catalog: () => CATALOG.filter(d => !d.hidden), categories: CATEGORIES, getDef, floors: FLOORS, swatches: SWATCHES, getFloor,
    fmtLen: m => fmtLen(m, S.doc.units),
    /** A small top-down picture of a catalogue piece (cached data URL). */
    thumb(type) {
      if (!thumbs.has(type)) { const d = getDef(type); thumbs.set(type, thumbnail({ type, w: d.w, d: d.d, h: d.h, color: d.color, color2: d.color2, rot: 0 }, 56).toDataURL()); }
      return thumbs.get(type);
    },
    bounds: contentBounds,
  };
}

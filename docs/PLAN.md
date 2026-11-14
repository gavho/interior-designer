# Interior Designer: plan for saving, desktop, and electrical layouts

Goal: grow the browser app into a tool for detailed interior layouts that runs as a desktop app, saves projects
reliably as real files, renders well, can be customised heavily, and can plan electrical outlets and cable runs.

## Phase 1: built now

### 1. Save system 2.0
- **One project file format**: `.interior.json` = `{ format: "interior-designer-project", version: 2, savedAt, app, doc, assets }`.
  Older files (plain doc + assets) still open. Embedded images and 3D models travel inside the file.
- **Real files on desktop**: in Chrome / Edge (and the desktop app) *Save* writes to a file you pick and *Ctrl+S* saves
  back to the same file; *Open* reads one. Recent files are remembered. Other browsers fall back to download / upload.
  iPad keeps the share sheet ("Save to Files").
- **Projects on this device keep themselves current**: when a project is open from *My projects*, every change is
  written to it automatically (no more forgetting to press Save), with a status in the top bar.
- **Version history**: each device project keeps snapshots (one per 10 minutes of editing, the last 30). *My projects →
  History* lists them and restores any one.
- **Backups**: *Export all projects* writes a single backup file; *Import* reads it back on any device.

### 2. Electrical layer
- **Points**: duplex outlet, USB outlet, GFCI outlet, floor box, power strip, ethernet / data jack, TV / coax plate,
  HDMI wall plate, light switch, ceiling box. Wall points snap to the nearest wall face (drag along it), floor
  points sit anywhere. Each has a height, label and optional circuit name.
- **Cables**: draw a run from a point or a piece of furniture (TV, monitor, speaker, lamp…) to another, with bends.
  Kinds: power, HDMI, ethernet, USB, speaker, audio, other (colour-coded).
- **Lengths**: horizontal path + the drops at each end (outlet height, the device's port height) by route:
  *along the floor*, *across a surface* (desk runs) or *straight line*; plus slack (15 % default) and the next
  standard cable size to buy.
- **Schedule**: Power tab lists every cable with from → to, route, measured and buy length; totals per kind;
  CSV export. Layer can be hidden; drawn in 2D and 3D.

### 3. Desktop foundation
- **Offline + installable**: a service worker caches the app and its 3D engine, so the site works offline and can be
  installed as a desktop app from Chrome / Edge (*Install Interior Designer*).
- **Electron desktop app** (`desktop/`): a native window running the same code with native Save / Open dialogs,
  the 3D engine bundled for offline use and a full-resolution render export. `cd desktop && npm install && npm start`
  to run; `npm run dist` to build an installer (needs the Electron toolchain on your machine).

## Phase 2: detail and rendering (next)
- Render presets: 1080p / 4K stills, sample count, camera bookmarks, sun by date & time, true light sources
  (lamps, track lights) in the path tracer.
- Materials: per-surface material editor (colour, roughness, texture image upload), saved material library.
- Custom catalogue: import your own GLB models with dimensions and colour variants as reusable pieces; share
  catalogue files between projects.
- Layers: furniture / electrical / annotations / reference; lock and hide per layer.
- Elevation views: per-wall elevations with dimensions (outlet heights, art hanging, cabinet runs) for printing.
- Ceiling: heights per room, soffits, ceiling fixtures plan.

## Phase 3: electrical v2
- Circuits: assign outlets to breakers, load per circuit from the devices plugged in (watts), warnings near 80 %.
- Auto-routing: route cables along walls / baseboards around obstacles instead of hand-drawn bends.
- Bill of materials: cables, power strips, cable raceway / cord covers (by length), floor cord protectors.
- Low-voltage: speaker wire gauge by run length, network runs, TV mount / in-wall power kits.

## Notes
- Everything stays one code base: the website, the iPad home-screen app and the desktop app are the same files.
- Project files are plain JSON so they can be versioned in git or edited by scripts.

# Interior Designer

A browser-based floor plan and interior design tool: draw rooms like a light CAD package, furnish them from a
resizable catalogue (or your own products and 3D models), and see everything live in 3D.

No build step and no dependencies to install. [three.js](https://threejs.org) is loaded from a CDN for the 3D view.

## Run it

```bash
npm start
```

Then open <http://localhost:5173>. (Any static file server works too; the app is plain ES modules.)
It can be hosted as-is on GitHub Pages by serving the repository root.

The app opens with a sample two-bedroom apartment traced from `samples/next-chicago-il-floorplan.png`.
Work is autosaved in the browser; use **File → Save project** to keep a `.json` copy.

### On an iPad (or any tablet)

The app is touch-ready and can be hosted for free on GitHub Pages:

1. On GitHub open **Settings → Pages**, choose **Deploy from a branch**, pick the branch and **/ (root)**, and save.
2. Open the published link (e.g. `https://<user>.github.io/interior-designer/`) in Safari.
3. Tap **Share → Add to Home Screen** to launch it full-screen like an app.

Touch gestures: tap to select (then drag to move), **drag** the floor to pan (with Apple Pencil it box-selects), **pinch** to zoom,
**two-finger drag** to pan while drawing, **long-press** for the actions menu, and **double-tap** to rename a room, split a wall
or (in 3D) zoom to a piece. Drawing tools follow your finger and place on lift; tap **✓ Done** to finish.
The small **‹ ›** tabs on the panel edges hide or show the side panels to give the plan the whole screen; in portrait, **☰ Panel** and **Properties** slide them in. Walk mode shows on-screen arrows.
Saving on the iPad: work autosaves as you go. **File → Save to My projects** keeps named projects inside the app on
this device (reopen them from **File → My projects…**). **Save a copy to Files** opens the share sheet so a `.json`
backup can go to Files, iCloud Drive or AirDrop, and **Open from Files…** loads one back. Add the app to the Home Screen
so iPadOS keeps its storage.

### My apartment

The app opens with the real unit (2 bed, 980 sq ft, traced from the NEXT Chicago plan): dark walnut vinyl plank floors,
light greige walls, and the kitchen as built (wood-grain flat-panel cabinets, white quartz, linear glass mosaic backsplash,
stainless slide-in range, over-the-range microwave, dishwasher and French-door fridge). **File → New from my apartment**
starts a fresh copy at any time. The **My picks** catalogue category holds the chosen products at their listed sizes, with
the retailer's colours under **Finish → Retailer colours**.

**Office ideas** is a shopping assortment to try before buying: walnut acoustic slat panels, hexagon light panels, framed
canvas art, walnut floating and bracket shelves, a ladder bookshelf, an arc floor lamp, a wall sconce, a charcoal rug, a
monitor riser and faux plants in black pots. Each piece is sized from its retailer listing and links to it under **Shopping**.

## Saving

- **Autosave**: the current plan is always kept in the browser on this device.
- **Files** (`.interior.json`): *File → Save as file…* writes a real file. In Chrome / Edge on a computer and in the
  desktop app, *Ctrl+S* then saves back to the same file and *File → Open file…* / the recent-files list reopen it.
  On iPad the share sheet saves to Files or iCloud Drive. Images and 3D models you added are stored inside the file.
- **My projects**: named projects on this device. The open one saves itself as you work and keeps a version every
  10 minutes (the last 30); *My projects & history…* restores any of them. *Back up all projects…* writes one file
  with everything, and opening that file on another device restores the projects there.

## Electrical outlets and cable runs

The **Power** tab and the two tools at the bottom of the tool rail (O, K) add an electrical layer:

- **Points**: duplex / USB / GFCI outlets, floor boxes, power strips, ethernet, TV and HDMI plates, switches and
  ceiling boxes. Wall points snap to the nearest wall face at the usual height; set the exact height, a label and a
  circuit in Properties. The outlets on the window ledges are already there.
- **Cables**: start on a point or a piece of furniture, click to add bends, finish on the other end. The length adds
  the drop from each end to the route (along the floor, across a desk, or straight) plus slack, and suggests the
  next standard cable size to buy. The cable schedule lists every run with totals per kind; export it as CSV.
- *Options → Electrical* hides or shows the layer in 2D and 3D.

## Desktop app

- **Install from the browser**: the site works offline once opened, and Chrome / Edge offer *Install Interior
  Designer* to run it in its own window.
- **Electron app** (`desktop/`): native Save / Open dialogs, the 3D engine bundled for offline use and full-size
  image export. On a computer with Node.js:

  ```bash
  cd desktop
  npm install
  npm start          # run it
  npm run dist       # build an installer for this computer (macOS .dmg, Windows .exe, Linux AppImage)
  ```

## Walk mode: build from first person

In 3D, **Walk** puts you in the room: click the view to look with the mouse, **W A S D** to move, **Shift** to run,
**C** to crouch, **N** to fly, the mouse wheel for speed. Walls and furniture block you; doorways don't. **F3** shows the
frame rate and draw calls.

On the hosted (`npm start`) and desktop versions a game-style HUD adds building while you walk. Build it once:

```bash
npm run hud        # installs and builds hud/ (React + Tailwind); `npm run hud:watch` rebuilds on save
```

- **Build (B)**: a see-through preview follows the crosshair; click to place. **1–9** / wheel pick from the hotbar,
  **T** opens the catalogue to fill a slot, **R** rotates (Shift 90°), right-click copies the piece you're looking at into the slot.
  Wall pieces (mirrors, TVs, cabinets) land on the wall you look at.
- **Move (E)**: click a piece to pick it up and carry it (things on it come along), click to put it down, right-click cancels.
  **F** duplicates, **X** deletes.
- **Paint (P)**: click a wall side or a floor; **T** opens the palette, right-click samples a wall's colour.
- Minimap (click it with the mouse free to jump there), **O** settings (sensitivity, field of view, quality, keys),
  **Tab** hides the HUD, **F1** photo mode, **Ctrl+Z** undo.

Without the build (GitHub Pages) walk mode keeps its plain controls.

See [docs/PLAN.md](docs/PLAN.md) for what comes next (render presets, material editor, custom catalogue, layers,
elevation views, circuits and auto-routed cables).

## What it does

**Build**
- Draw walls click-by-click with grid, corner, wall and 15° angle snapping plus alignment guides.
  Type a length while drawing (`12'6"`, `150in`, `3.8m`) and press Enter for exact sizes.
- Rectangle, L- and U-shaped room starters. Rooms are detected automatically wherever walls close a loop,
  with live area, perimeter and overall size.
- Drag walls or corners to reshape (neighbouring walls follow), split walls, set thickness, height and paint.
- Doors (single, double, sliding, bifold, cased opening) and windows that slide along walls, with hinge and swing flips.
- Import a floor plan image, calibrate its scale from one known dimension, and trace over it.
- Curved walls (three-point arcs) and round rooms; snapping to corners, wall midpoints and wall faces.
- CAD-style positioning: centre a piece between walls, type exact gaps to each wall, centre doors and windows,
  and centre-line guides while dragging.
- Dimensions, text labels, imperial or metric units, undo/redo, copy/paste, multi-select, align and distribute.

**Furnish**
- 140+ parametric pieces across living, bedroom, dining, kitchen, bath, office, desk setup, utility, decor and structure.
  Every piece can be resized freely (beds, desks, rugs and vanities also have standard-size presets) and recoloured.
- Office and desk-setup kit: standing, minimal and L-shaped desks, an ergonomic chair, cube and open shelving, monitors
  (on a stand or an arm, with lit screens), monitor stands, laptop, keyboards with individual keys, mouse, desk mat, lamp,
  speakers, headphones, plants and more. Desk-top pieces land on the desk, shelf or stand under them and move with it.
- Modern appliances and furniture: flat-front fridge, wall ovens, induction cooktop, wine fridge, espresso machine,
  air purifier, mini-split, low sofa, lounge chair and platform bed.
- Furniture snaps flush to walls and into corners; live gap read-outs show the distance to surrounding walls.
- Add your own: custom box / cylinder / L-shape, a product from the web (link, photo, dimensions, price),
  or a GLB / glTF / OBJ 3D model from a file or direct URL. Save anything to **My library** for reuse.
- Browse and place free, realistic textured models from [Poly Haven](https://polyhaven.com/models) (CC0) inside the app.
- Search [Sketchfab](https://sketchfab.com)'s downloadable models (mostly CC Attribution) inside the app. With your own
  Sketchfab API token a click imports the model; without one it opens the model's page so you can download the GLB.
- Kitchen kit: base, drawer, corner, tall and wall cabinets, countertops, backsplashes, hood and appliances,
  with wood species (visible grain in 3D) and countertop presets.
- Wall decor: a separate finish for each side of every wall (paint, brick, tile, panelling, wallpaper),
  plus art, gallery walls, slat, fluted, acoustic and hexagon panels, pegboards, whiteboards, wainscoting, shelves,
  picture ledges, sconces and mirrors.
- Style palettes recolour walls, floors and furniture together; 14 floor finishes per room.

**Check**
- Space utilisation per room, collision and wall-overlap detection, blocked door swings,
  recommended clearances, and a walkway-width heat map.
- Shopping list with prices, links and CSV export.

**View and share**
- Split 2D / 3D, orbit, top and front cameras, cut-away walls, time-of-day sun, shadows and a first-person walk mode.
- High-quality mode (ambient occlusion, sharper shadows) and a path-traced **Photo render** of the current view
  ([three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer)) that can be saved as an image.
- Clicking a piece selects it and shows a toolbar (move, rotate, centre, duplicate, delete); it only moves on purpose.
- Drag selected furniture directly in 3D. Export the plan or the 3D view as PNG, or print the plan.
- Zoom right in to desk-top detail; double-click a piece in 3D to fly the camera to it.

Press **?** in the app for the keyboard shortcuts.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page shell and styling |
| `src/main.js` | Start-up and keyboard shortcuts |
| `src/state.js` | Document model, derived rooms/wall geometry, selection, undo history, autosave |
| `src/util.js` | Geometry (room detection, mitred wall joints), units, DOM helpers |
| `src/editor2d.js` | 2D canvas editor: rendering, snapping and tools |
| `src/view3d.js` | three.js scene built from the same document |
| `src/catalog.js` | Parametric furniture definitions (one definition drives 2D symbol, thumbnail and 3D mesh) |
| `src/catalog-extra.js` | Office, desk-setup, modern furniture and appliance definitions |
| `src/parts.js` | The solids (boxes, rounded boxes, cylinders…) that pieces are assembled from |
| `src/materials.js` | Procedural floor finishes and style palettes |
| `src/ops.js` | Editing operations (add, move, split, align, wall magnet, palettes) |
| `src/analysis.js` | Space-planning checks and the clearance map |
| `src/ui.js` | Panels, inspector, dialogs, menus |
| `src/sample.js` | The sample apartment |

Lengths are stored in metres. Plan coordinates are `x` right and `y` down; in 3D the plan's `y` becomes `z`.

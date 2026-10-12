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
- 60+ parametric pieces across living, bedroom, dining, kitchen, bath, office, utility, decor and structure.
  Every piece can be resized freely (beds, rugs and vanities also have standard-size presets) and recoloured.
- Furniture snaps flush to walls and into corners; live gap read-outs show the distance to surrounding walls.
- Add your own: custom box / cylinder / L-shape, a product from the web (link, photo, dimensions, price),
  or a GLB / glTF / OBJ 3D model from a file or direct URL. Save anything to **My library** for reuse.
- Browse and place free, realistic textured models from [Poly Haven](https://polyhaven.com/models) (CC0) inside the app.
- Kitchen kit: base, drawer, corner, tall and wall cabinets, countertops, backsplashes, hood and appliances,
  with wood species (visible grain in 3D) and countertop presets.
- Wall decor: a separate finish for each side of every wall (paint, brick, tile, panelling, wallpaper),
  plus art, gallery walls, slat panels, wainscoting, shelves, sconces and mirrors.
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
| `src/materials.js` | Procedural floor finishes and style palettes |
| `src/ops.js` | Editing operations (add, move, split, align, wall magnet, palettes) |
| `src/analysis.js` | Space-planning checks and the clearance map |
| `src/ui.js` | Panels, inspector, dialogs, menus |
| `src/sample.js` | The sample apartment |

Lengths are stored in metres. Plan coordinates are `x` right and `y` down; in 3D the plan's `y` becomes `z`.

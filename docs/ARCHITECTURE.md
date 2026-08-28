# Forma Architecture

How the app is put together and why. For the rules you must follow when changing
it — layering, `commit()`, units, dispose and picking gotchas, test conventions —
see [`CODING_STANDARDS.md`](./CODING_STANDARDS.md).

## The shape of it

Forma is a React + Vite + TypeScript app in four layers, built around one idea:
**the document is the truth, and everything else is a projection of it.** The 3D
view and the cut list are not kept in sync with each other — they are both
derived from the same part list.

| Path | Role |
|---|---|
| `src/domain/` | Framework-free and pure. Never imports React or three.js at module scope — `THREE` is injected — so it unit-tests in Node and three.js stays code-splittable. `computePartSpecs()` is the single flat list of live parts that the mesh builder, assembly tree, part count, Select All and the BOM all consume, which is what keeps deletions honoured everywhere at once. |
| `src/store/` | `documentStore` holds the undoable, persisted document; `uiStore` holds ephemeral UI state; `history.ts` holds the undo/redo stacks as module-level arrays (not Zustand), read from React via `useSyncExternalStore`. All document mutations go through `commit()`, which snapshots the entire document slice. `actions.ts` is the only place components mutate the design from. `persistence.ts` autosaves to `localStorage` behind a schema version. |
| `src/viewport/` | The three.js layer, lazy-loaded. Imperative, not declarative: `Viewport.tsx` is a thin shell whose single `useEffect` constructs `SceneManager` (renderer, camera, lights, loop), `ModelBuilder` (document → meshes) and the controllers for picking, gizmos, measuring, selection dimensions and camera flight, subscribes them to the stores, and disposes every one of them on unmount. Floating canvas chrome stays React. |
| `src/ui/` | Presentational React components — toolbar, sidebars, cut list, status bar, keyboard shortcuts, primitives. Styling is Tailwind classes on components, tokens from `theme.css` — never CSS strings assembled in the state layer. |

## How a change flows

Dropping a shelf into the scene: `PickController` raycasts the drop point and
calls `addCustomPanel`, which wraps the mutation in `commit()`. `commit`
snapshots the whole undoable document first, applies the change, reconciles
`currentVersionId`, and pushes the old snapshot onto the undo stack — skipping
no-ops and capping depth at 50. The document store's change fires `Viewport`'s
subscription, which calls `builder.sync(...)`; that diffs the part list against
the meshes already in the scene, creating or removing nodes only for parts that
appeared or disappeared, then reapplies transforms and visibility. The Cut List
screen recomputes `computeBOM(...)` from the same document. Nothing manually
reconciles the two views.

## Decisions worth knowing

**Two coordinate systems, converted at one boundary.** Everything the user thinks
about — part sizes, cabinet dimensions, cut-list numbers — is millimetres.
Everything three.js touches is metres, because transforms come straight off
`Object3D`. The conversion is the `MM = 1/1000` constant in `geometry.ts` plus
explicit `*1000` / `/1000` in actions. Centimetres and inches exist only as a
display preference (default cm) and are never stored.

**Size and placement are separate objects.** Each part is a root `Group` carrying
placement (position / quaternion / gizmo scale) around a `Mesh` carrying the
part's dimensions as a local scale on a shared unit geometry. So a scale gizmo
can't permanently overwrite a panel's catalog dimensions, and changing a
dimension is a scale write rather than a geometry allocation. All box parts share
one `BoxGeometry`, all knobs one lathe geometry, and materials are cached by
material + colour — which is why removing a single part must never dispose them.
Natural Oak and Walnut share one photographed grain map each (`public/oak-grain.jpg`,
`public/walnut-grain.jpg`) used by both the PBR material and the Color swatch.

**Cabinets are groups that remember they are cabinets.** `buildCabinetLayout`
generates ordinary panels bundled into a `Group` carrying a `cabinet` config.
Because the config survives, changing the cabinet's width rebuilds the carcass
parametrically while preserving the 18 mm panels and 8 mm back. Member ids stay
bound to carcass / shelf / panel roles across Add Shelf and Add Panel, and those
adds read live centrelines so a typed or gizmo'd placement is not overwritten.
Moving a shelf or interior panel writes that centreline back onto `cabinet` so
Properties and the next add keep it. Changing only some members' size, or
deleting a side/top/bottom/back, clears the config — the group demotes to a
plain group, because it can no longer be regenerated faithfully.
Moving or renaming members does not, and deleting a generated shelf or interior
panel updates the config instead of demoting.

**Gizmo drags commit once, on release.** The scene is mutated freely during the
drag; `commitTransforms` fires on pointer-up. One undo entry per gesture, and the
store isn't churned at 60 fps.

**`viewportApi` is a deliberate escape hatch.** Framing, PNG export, floor-snap,
group-resize, snap-together and align need live meshes to compute bounds. Rather than threading refs
through the React tree, the viewport registers a small imperative API as a module
singleton on mount and clears it on unmount; callers use optional chaining since
the lazy chunk may not be loaded yet.

**Clearance witnesses follow the selection.** `selectionUnits` collapses a
flat part selection into rigid groups. One unit shows the nearest facing gap
in each direction (`nearestFacingGaps`). A cabinet from `cabinetContainingSelection`,
or a fully selected group, also draws overall W/H/D (`overallDimensions`)
further out than the gaps. A fully selected group treats other groups as one
box; a single selected piece reads individual parts so it can clear to an inner
face, not the outer AABB of an unselected cabinet. Two units lock that pair;
`gizmoPartIds` hands the gizmo only the second so the first stays put.
`SelectionDimensions` reads live halo-excluding AABBs. Click a clearance label
to type a gap; `nudgeSelected` moves the gizmo parts along that axis. Flush
faces draw in the accent colour (`kind: 'align'`) only while the move gizmo
is on, including when a moving group's min or max lines up with another
group. Alignment lines span the shared face or the gap between boxes so they
do not collapse to a point at contact. Overall labels are
display-only unless the scale gizmo is on, in which case typing calls
`setSelectedOverallDim` (cabinet parametric resize, single-part catalog size,
or rigid group scale). Overlapping interiors stay quiet. Render mode
hides the overlay.

**Persistence is schema-versioned.** Autosave is debounced into `localStorage`
under a versioned envelope (currently schema 5), with migrations from schema 4
and 3 and defensive `normalize`. Unknown or pre-rewrite schemas are refused
rather than guessed. Save to File downloads that envelope as `.forma.json`.
Saved Versions are checkpoints *inside* one document (and autosave). Version
History can download a `{title} - Version N.forma.json` file. Rules for keeping
old files loadable live in [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) §9.

---

## Deviations from the design spec

Three deliberate departures from [`DESIGN_SPEC.md`](./DESIGN_SPEC.md), each
fixing a defect the spec's approach caused:

1. **Gizmo transforms live in the document store** (the `transforms` map on
   `DocumentSnapshot`), not outside reactive state as the spec's
   `manualTransforms` suggested. That is what puts gizmo moves on the undo
   stack, into autosave and into version snapshots. Transforms commit once on
   gizmo release, not per frame.
2. ~~Hardware counts derive from surviving part ids, so deleting a door drops
   its hinges.~~ Superseded — see the pivot below; there's no more hardware to
   count.
3. **Render mode hides the selection halo and gizmo**, so neither is baked into
   an exported PNG.

Marquee hit-testing still projects each part's centre, per the spec, so a large
panel whose centre falls outside the box is missed. Projecting the eight
bounding-box corners instead is the obvious follow-up.

## Post-launch model: empty canvas with reusable assemblies

The design spec — and the first several iterations of this app — modeled a
**parametric sideboard**: fixed panels, doors and drawers computed from
Width/Height/Depth/Leg Height/Panel Thickness, plus Leg Style, Handle Style
and Base Style pickers that reskinned it. That whole system has since been
removed. The app now starts from a genuinely **empty scene**. Geometry enters
through individual library items (panels, fronts and hardware) or standard
open-front cabinet assemblies.

This was a deliberate, user-requested removal, not a regression — the leg/
handle/base style pickers only made sense as controls *for* the parametric
piece, so once that piece was gone, showing them was actively confusing.
Everything downstream of "there is always exactly one sideboard" came out
with it:

- The old sideboard-specific `computeLayout`, leg/handle mesh builders,
  `deletedFixedIds`, `PartGroup`/tree grouping, and the Width/Height/Depth/Leg
  Height/Panel Thickness sliders for the old always-present piece are deleted
  rather than dormant. `buildCabinetLayout` now computes only cabinets the
  designer deliberately inserts.
- Hardware is an explicit purchased-part category. Knobs have diameter and
  projection controls, metal finishes, rounded geometry, and their own Cut
  List section rather than pretending to be sheet goods.
- The Assembly tree is flat for loose parts and hierarchical for saved groups
  and generated cabinets. Groups list first, in `groups` order, then leftover
  pieces. Drag a group handle to reorder; Shift-click (or ⌘/Ctrl-click) a group
  row adds or removes every member without replacing the rest of the selection.
- Saved documents are currently schema 5. Schema 4 applies the current appearance
  defaults. Schema-3 panel designs migrate to world-aligned dimensions and
  explicit manufacturing metadata. File text is parsed by `loadFormaText` so a
  UTF-8 BOM, string `schemaVersion`, or a bare document still loads. A schema-1
  save (sideboard dims, leg/handle/base
  style, deleted-fixed-ids) has no sensible mapping onto an empty-canvas design
  — what would you do with its generated doors and legs? — so `persistence.ts`
  treats it as unmigratable and falls back to a fresh empty document rather than
  guessing. See [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) §9 before changing
  stored fields.

New doors, drawers, legs, or hardware should continue to enter as explicit
library items or generated assembly members rather than reviving the old
always-present sideboard.

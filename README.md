# Forma — 3D Furniture Panel Designer

Forma is a browser-based furniture panel designer. You start from an empty
canvas, insert standard open-front cabinet carcasses or individual shelves,
sides, backs, dividers, doors and knobs from a library, position and size them
precisely, group and finish them, and get a cut list that stays in sync with the
scene.

Parts carry explicit manufacturing metadata: panels and fronts versus purchased
hardware, sheet thickness, grain direction, and exposed edges. Inserted cabinets
stay editable assemblies — their nominal Width/Height/Depth rebuild the carcass
while preserving the 18 mm panels and 8 mm back.

Three top-level modes: **Model** (the editor), **Cut List** (auto-generated BOM
with CSV export), and **Render** (presentation view with camera presets and PNG
export).

## Running it

Requires **Node 20.19+ or 22.12+** (Vite 7). An `.nvmrc` is provided — `nvm use`
picks the right version.

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # typecheck + production bundle
npm run preview    # serve the production bundle
npm run typecheck  # tsc --noEmit only
npm run test       # domain unit tests (vitest)
npm run test:watch # vitest in watch mode
npm run test:e2e   # browser smoke tests (Playwright)
```

## Structure

React + Vite + TypeScript, Zustand for state, three.js for the viewport,
Tailwind v4 for styling.

| Path | Role |
|---|---|
| `src/domain/` | Framework-free domain logic: types, catalog, cabinets, parts, BOM/CSV, geometry builders, units |
| `src/store/` | Zustand stores, `commit()` history, persistence, document mutations |
| `src/viewport/` | Imperative three.js scene (lazy-loaded) and its React overlays |
| `src/ui/` | App chrome: toolbar, sidebars, cut list, primitives, shortcuts |
| `e2e/` | Playwright smoke tests |
| `reference/` | Historical HTML prototype — **not** production code to copy |

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | How the layers fit together, how a change flows from click to cut list, and why the parametric sideboard was removed |
| [`docs/CODING_STANDARDS.md`](./docs/CODING_STANDARDS.md) | The rules: layering, `commit()` vs metadata, units, dispose and picking gotchas, naming, testing, change workflow |
| [`docs/DESIGN_SPEC.md`](./docs/DESIGN_SPEC.md) | The full visual and interaction spec — colours, typography, metrics, every screen — plus the prototype it came from |
| [`CHANGELOG.md`](./CHANGELOG.md) | User-facing changes, newest first |
| [`docs/BUGS.md`](./docs/BUGS.md) | Open and resolved defects (`BUG-###`) |
| [`docs/IMPROVEMENTS.md`](./docs/IMPROVEMENTS.md) | Non-bug follow-ups (`IMP-###`) |

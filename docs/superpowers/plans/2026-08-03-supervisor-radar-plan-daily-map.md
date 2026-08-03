# Supervisor Radar Daily Plan Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Supervisor Ventas V2 Radar open on the first available daily plan and show only that plan's unit and stops on an interactive OpenStreetMap street map.

**Architecture:** Keep `RadarTab` and the desktop board as owners of the optional user-requested `selectedId`. Add a pure Radar selection/point adapter that derives an effective plan ID from the raw API order, builds selector options, and emits only that plan's valid geometry. Keep `PositionMap` as an SSR-safe boundary and lazy-load a separate client-only Leaflet/OpenStreetMap component only after it confirms `window` exists; this prevents Node's static renderer from evaluating Leaflet before the fallback can render.

**Tech Stack:** React 19, React Router, Leaflet 1.9.4, react-leaflet 5.0.0, OpenStreetMap tiles, Node built-in test runner, Vite.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/modules/supervisor-ventas/v2/radar/radarSelection.js` | Pure plan ID validation, effective-selection resolution, labels, and selected-plan geometry. No React or browser APIs. |
| `src/modules/supervisor-ventas/v2/radar/RadarView.jsx` | Controlled Plan diario selector, filtered Radar map input, and list highlight based on the effective plan ID. |
| `src/modules/supervisor-ventas/v2/radar/PositionMap.jsx` | SSR-safe validation boundary, honest empty states, and lazy client loading. It must not statically import Leaflet. |
| `src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx` | Browser-only Leaflet/OpenStreetMap presentation, marker semantics, viewport fitting, attribution, and Leaflet CSS import. |
| `tests/helpers/renderJsx.mjs` | Explicit esbuild-only Leaflet/CSS stubs so the Node SSR harness can bundle a lazy client child without evaluating browser-only modules. |
| `tests/supervisorRadarPlanSelection.test.mjs` | Direct unit tests for defaulting, replacement of stale selections, option labels, and no-cross-plan geometry. |
| `tests/supervisorV2Red.test.mjs` | Update the old SVG/no-road assertions to test the Leaflet/OpenStreetMap component contract and keep invalid/anti-meridian handling covered. |
| `tests/supervisorV2Surfaces.test.mjs` | Render-level Radar regression tests for the visible selector and effective default selection. |

`RadarTab.jsx` and `SupervisorDesktopBoard.jsx` already hold and pass `selectedId`; they do not need a new state owner. The derived effective value is intentionally local to `RadarView`, so selection does not cause a state update while rendering and changing the visual sort cannot change the initial plan.

### Task 1: Add the pure daily-plan selection adapter

**Files:**

- Create: `src/modules/supervisor-ventas/v2/radar/radarSelection.js`
- Create: `tests/supervisorRadarPlanSelection.test.mjs`

- [ ] **Step 1: Write the failing selection and geometry tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRadarPlanOptions,
  buildSelectedPlanPoints,
  resolveActivePlanId,
} from '../src/modules/supervisor-ventas/v2/radar/radarSelection.js'

const units = [
  {
    plan_id: 31, route_name: 'Ruta Centro', name: 'Manuel Cruz',
    vehicle: { name: 'U-31' }, latitude: 18.34, longitude: -99.53,
    stops: { planned: [{ stop_id: 311, name: 'Cliente Centro', latitude: 18.35, longitude: -99.54, done: false }] },
  },
  {
    plan_id: 32, route_name: 'Ruta Norte', name: 'Esteban Meza',
    vehicle: { name: 'U-32' }, latitude: 18.44, longitude: -99.63,
    stops: { planned: [{ stop_id: 321, name: 'Cliente Norte', latitude: 18.45, longitude: -99.64, done: true }] },
  },
]

test('active plan defaults to first valid response plan and retains a valid choice', () => {
  assert.equal(resolveActivePlanId(units, null), 31)
  assert.equal(resolveActivePlanId(units, 32), 32)
  assert.equal(resolveActivePlanId(units, 999), 31)
})

test('selected-plan points never include a different plan or CEDIS', () => {
  const points = buildSelectedPlanPoints({ units }, 32, Date.parse('2026-08-03T12:00:00Z'))
  assert.deepEqual(points.map((point) => point.id), [32, 'stop:321'])
  assert.ok(points.every((point) => !String(point.id).startsWith('cedis:')))
})
```

Add coverage for an empty array, malformed/non-positive/string `plan_id`, selection surviving a different visual sort, unavailable vehicle/employee labels, invalid/out-of-range coordinates, and pending versus completed stop kinds.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/supervisorRadarPlanSelection.test.mjs`

Expected: FAIL because `radarSelection.js` does not exist.

- [ ] **Step 3: Implement the smallest pure adapter**

Implement and export exactly these focused functions:

```js
export function isPlanId(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function resolveActivePlanId(units, requestedId) {
  const valid = (Array.isArray(units) ? units : []).filter((unit) => isPlanId(unit?.plan_id))
  return valid.some((unit) => unit.plan_id === requestedId)
    ? requestedId
    : (valid[0]?.plan_id ?? null)
}

export function buildRadarPlanOptions(units) { /* one option per valid plan, raw response order */ }
export function buildSelectedPlanPoints(radar, activePlanId, nowMs) { /* selected unit + selected stops only */ }
```

Use `isValidLatLng` from `mapProjection.js` before creating any geometry. Build option labels from route name, responsible, and vehicle with existing Radar fallbacks. Call `safeSignalStatus(unit, nowMs)` for the selected unit kind; emit `stop_done`/`stop_pending` for only its planned stops. Do not add CEDIS, other plan units, out-of-range points, `(0, 0)`, a route polyline, or a fetch.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/supervisorRadarPlanSelection.test.mjs`

Expected: PASS, including the cross-plan exclusion assertions.

- [ ] **Step 5: Commit the pure adapter**

```bash
git add src/modules/supervisor-ventas/v2/radar/radarSelection.js tests/supervisorRadarPlanSelection.test.mjs
git commit -m "feat(supervisor): resolve radar daily plan selection"
```

### Task 2: Replace the Radar SVG with the Leaflet street map

**Files:**

- Modify: `src/modules/supervisor-ventas/v2/radar/PositionMap.jsx`
- Create: `src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx`
- Modify: `tests/helpers/renderJsx.mjs`
- Modify: `tests/supervisorV2Red.test.mjs`

- [ ] **Step 1: Write the failing map-contract tests**

Replace the obsolete assertion that says Radar is "no es mapa vial" with source-level assertions (the Node renderer has no DOM for Leaflet) that:

- `PositionMap.jsx` lazy-loads `LeafletPositionMap.jsx` only on the client and has no static `react-leaflet`, `leaflet`, or Leaflet-CSS import;
- `LeafletPositionMap.jsx` imports `MapContainer`, `TileLayer`, `CircleMarker`, `Marker`, `Tooltip`, and `useMap` from `react-leaflet`, imports `leaflet/dist/leaflet.css`, and uses a `divIcon` rather than image assets;
- `LeafletPositionMap.jsx` uses `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` and visible OpenStreetMap attribution;
- keeps `v2-position-map-empty` for invalid geometry and anti-meridian input;
- contains no `fetch`, `localStorage`, `sessionStorage`, `indexedDB`, or write HTTP verbs.

Keep an SSR render test for invalid points and for valid points: valid SSR input must yield an accessible loading/non-map fallback without evaluating Leaflet. Add a source test that the browser map is labeled as the selected plan's last known positions, not live tracking.

Before either render can pass, add a narrowly scoped `leafletSsrStub` esbuild plugin to `tests/helpers/renderJsx.mjs` and register it beside `virtualDemoStub`. It must resolve only `react-leaflet`, `leaflet`, and `leaflet/dist/leaflet.css` in the test bundle:

```js
// Pseudocode for the test-only module shapes.
// react-leaflet exports inert React components plus useMap(), whose methods are no-ops.
// leaflet exports divIcon(options) => options.
// leaflet CSS exports an empty module.
```

The stub's React components use the already-external `react` package and must never be shipped in Vite's production build. The valid-geometry SSR test proves this harness change: loading and rendering `PositionMap` does not throw while no `window` exists.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/supervisorV2Red.test.mjs`

Expected: FAIL because the current component has no lazy client boundary, Leaflet child, OSM layer, or SSR harness stubs and declares the opposite map contract.

- [ ] **Step 3: Implement the Leaflet presentation without changing the data contract**

Keep the public `PositionMap` props `points`, `selectedId`, `onSelect`, `height`, and `testid`; do not introduce backend work. Split presentation into these local responsibilities:

```jsx
// PositionMap.jsx — no Leaflet imports in this file
const LeafletPositionMap = lazy(() => import('./LeafletPositionMap.jsx'))

if (typeof window === 'undefined') return <StaticMapFallback testid={testid} />
return <Suspense fallback={<StaticMapFallback testid={testid} />}><LeafletPositionMap {...props} /></Suspense>
```

`StaticMapFallback` must be labelled as a loading map only when valid geometry exists; it must not claim streets are currently visible. It is a test/initial-load boundary, not an error state.

Inside `LeafletPositionMap.jsx`, implement the viewport helper:

```jsx
function MapViewport({ positions }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (positions.length >= 2) map.fitBounds(positions, { padding: [24, 24] })
    else map.setView(positions[0], 15)
  }, [map, positions])
  return null
}
```

- `PositionMap` obtains valid points with `validPoints(points)` and preserves the current anti-meridian refusal via `computeBounds(points).antimeridian` before lazy loading. It returns the existing honest empty-state component for zero usable positions or anti-meridian input.
- In the browser, `LeafletPositionMap` renders `MapContainer`, `TileLayer`, `MapViewport`, and a `CircleMarker` per stop. Use the existing kind colors for completed and pending stops.
- Render each unit with a Leaflet `Marker` that uses a `divIcon` (not default image assets), a `title`/`alt` label, `keyboard={true}`, and a tooltip. The selected unit gets a visibly larger ring. This gives the marker a focusable Leaflet control while retaining the visual state.
- `onSelect` remains optional and is called only by an interactive unit marker with a numeric plan ID, including its keyboard activation. Stops remain non-selecting. The existing list and selector remain the primary accessible selection controls.
- Wrap the map in a labelled region, preserve `height`, turn off scroll-wheel zoom, and include OpenStreetMap attribution. Do not create a fake route line.

- [ ] **Step 4: Run the map test to verify it passes**

Run: `node --test tests/supervisorV2Red.test.mjs`

Expected: PASS, including coordinate validation, anti-meridian fallback, lazy-client contract, OSM contract, and SSR-safe map rendering.

- [ ] **Step 5: Commit the map presentation**

```bash
git add src/modules/supervisor-ventas/v2/radar/PositionMap.jsx src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx tests/helpers/renderJsx.mjs tests/supervisorV2Red.test.mjs
git commit -m "feat(supervisor): show radar plans on street map"
```

### Task 3: Wire the Plan diario selector into RadarView

**Files:**

- Modify: `src/modules/supervisor-ventas/v2/radar/RadarView.jsx`
- Modify: `tests/supervisorV2Surfaces.test.mjs`

- [ ] **Step 1: Write the failing Radar view tests**

Create a two-plan synthetic Radar fixture in `supervisorV2Surfaces.test.mjs`. Assert that server-rendered Radar:

```js
const html = render(RadarView, {
  radar: twoPlanRadar,
  source: 'live',
  nowMs: NOW,
  selectedId: null,
})
assert.match(html, /radar-plan-select/)
assert.match(html, /Plan diario/)
assert.match(html, /Ruta Centro/)
assert.match(html, /Ruta Norte/)
```

Also test a stale `selectedId` resolves to the first response plan and a valid `selectedId` renders it as the selected option. Keep the existing Radar no-data and ordering regressions.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/supervisorV2Surfaces.test.mjs`

Expected: FAIL because Radar currently renders no daily-plan selector and passes every plan into `buildPoints`.

- [ ] **Step 3: Integrate the adapter while preserving the current list and navigation**

In `RadarView.jsx`:

1. Delete the local all-units `buildPoints` implementation and import `buildRadarPlanOptions`, `buildSelectedPlanPoints`, and `resolveActivePlanId`.
2. Derive `activePlanId` from un-ordered `radar.units` and incoming `selectedId`; derive the map points from `activePlanId`.
3. Render a visible `<label>` and controlled `<select data-testid="radar-plan-select">` immediately below the map title. Render no selector if there is no valid plan. On change, call `onSelectUnit(Number(event.target.value))` only for a valid option.
4. Pass `activePlanId` to `PositionMap` and to every `UnitRow` for its `selected` style, so initial visual selection exists even before the user changes state.
5. Preserve ordering, every unit row, the live/delay wording, map/list empty copy, route-detail navigation, and the existing `onSelectUnit` row behavior.

Do not add an effect to force a first-plan `setState`, mutate `radar`, or make order decide the active plan. `RadarTab.jsx` and `SupervisorDesktopBoard.jsx` require no code change: their existing state receives user interaction and their `null` initial state correctly delegates the default to `RadarView`.

- [ ] **Step 4: Run the focused Radar view tests to verify they pass**

Run: `node --test tests/supervisorV2Surfaces.test.mjs tests/supervisorRadarPlanSelection.test.mjs`

Expected: PASS. The first plan is selected from raw response order, a valid explicit selection wins, and map input contains no other plan.

- [ ] **Step 5: Commit selector integration**

```bash
git add src/modules/supervisor-ventas/v2/radar/RadarView.jsx tests/supervisorV2Surfaces.test.mjs
git commit -m "feat(supervisor): filter radar map by daily plan"
```

### Task 4: Run full verification and perform the visual acceptance check

**Files:**

- Modify only if verification identifies a test or implementation defect in the files above.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all Node tests pass, ESLint returns zero warnings/errors, and Vite builds the Leaflet CSS/JS successfully.

- [ ] **Step 2: Run a local browser smoke test**

Run: `npm run dev -- --host 127.0.0.1`

With a supervisor session and a day containing at least two plans, verify:

1. Radar opens with the first response plan selected.
2. The OSM street layer, attribution, selected unit, and only its stops appear.
3. Switching the Plan diario selector removes all geometry from the preceding plan, fits to the new plan, and leaves the unit list visible.
4. Clicking a unit row selects the same plan in the selector/map; the unit marker can receive keyboard focus and activation; **Abrir ruta** still goes to its existing route detail.
5. A plan without valid coordinates shows the honest empty state and does not render a fabricated street/route.

- [ ] **Step 3: Review the final diff and commit any verification fix**

Run:

```bash
git diff main...HEAD --check
git status --short
```

Expected: only the eight planned source/test files differ from `main` (plus this approved documentation). If a verification-only fix was needed, commit it with a focused message; otherwise no additional commit is necessary.

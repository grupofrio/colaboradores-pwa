# Supervisor Unit-Track Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a read-only map of the selected vendor's current location, day trail, and planned/visited stops in the Supervisor de Ventas PWA.

**Architecture:** Reuse the existing `/equipo/vendedor/:vendedorId?route_id=…` detail screen. In that route, `route_id` is the `gf.route.plan` record ID returned by `/pwa-supv/team-routes`, even though its UI name is misleading; use it as the backend's required `plan_id`. Add a narrow direct-API bridge from the PWA's existing GET convention to Odoo's JSON POST endpoint, normalize the read-only contract in a pure state module, and render it through a self-contained Leaflet component.

**Tech Stack:** React 18, React Router, existing `api()`/`routeDirect` BFF, Node built-in test runner, Leaflet + react-leaflet, OpenStreetMap tiles.

**Backend precondition:** PR #246 (the mobile-warehouse scope correction for #245) must be merged and deployed in `GrupoFrio`; together they supply a working `POST /gf/salesops/supervisor/v2/unit-track` with current/trail data. The Radar feature flag must be enabled for the authenticated supervisor's scope. Direction must confirm notice to the field team before enabling this surface in production. The Brief Iguala n8n page is out of scope for this work.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/api.js` | Translate the PWA's GET request into the existing Odoo JSON POST contract, preserving session-derived supervisor metadata. |
| `src/modules/supervisor-ventas/api.js` | Public `getUnitTrack()` function used by supervisor screens. |
| `src/modules/supervisor-ventas/unitTrackState.js` | Pure normalization, coordinate validation, map bounds, and user-facing availability state. |
| `src/modules/supervisor-ventas/UnitTrackMap.jsx` | Leaflet-only presentation component: current point, trail, planned/check-in stops, attribution, and responsive height. |
| `src/modules/supervisor-ventas/ScreenDetalleVendedor.jsx` | Load the track alongside the existing route stops and embed the map without blocking the vendor detail on unavailable tracking. |
| `tests/supervisorUnitTrackApi.test.mjs` | Contract tests for the direct API bridge. |
| `tests/supervisorUnitTrackState.test.mjs` | Unit tests for the coordinate/data contract. |
| `tests/supervisorUnitTrackScreen.test.mjs` | Structural wiring test for the screen and its read-only behavior. |
| `package.json`, `package-lock.json` | Add the map runtime dependencies. |

## Contract and UX decisions

- PWA call: `api('GET', '/pwa-supv/unit-track?plan_id=<route-plan-id>&date=<optional>')`.
- Odoo call: `odooJson('/gf/salesops/supervisor/v2/unit-track', { meta: supervisorMeta(), data: { plan_id, date } })`.
- Do not derive scope, employee, branch, or date authority in the client; pass only `plan_id` and optional date. The backend owns all authorization.
- Do not persist GPS data in `localStorage`, IndexedDB, caches, analytics, or error text. The component is read-only and has no write verbs.
- Treat `(0, 0)`, absent values, non-finite values, and out-of-range latitude/longitude as unavailable. Never draw them on the map.
- A missing trail is an expected state: show current point/stops if available and the explicit message “Sin recorrido GPS disponible para esta jornada.” It is not an error.
- `FEATURE_DISABLED`, `FORBIDDEN`, and `DATE_NOT_ALLOWED` must hide map geometry and show a compact non-sensitive unavailable message. Unknown transport/server errors show a retry affordance but must not hide the existing vendor detail/stops.
- Use `L.divIcon`/CSS markers, not Leaflet's default image assets, to avoid broken marker URLs in Vite/PWA builds.
- Capture response fixtures from the deployed endpoint before implementing normalization: a successful response, `FEATURE_DISABLED`, `FORBIDDEN`, and `DATE_NOT_ALLOWED`. Store only synthetic/redacted fixtures in tests, never GPS samples or employee data.

### Task 1: Add the pure unit-track view model

**Files:**

- Create: `src/modules/supervisor-ventas/unitTrackState.js`
- Create: `tests/supervisorUnitTrackState.test.mjs`

- [ ] **Step 1: Write failing normalization tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidCoordinate,
  normalizeUnitTrack,
  buildUnitTrackBounds,
} from '../src/modules/supervisor-ventas/unitTrackState.js'

test('unit track excludes zero, invalid, and out-of-range coordinates', () => {
  const track = normalizeUnitTrack({
    current: { lat: 18.3, lng: -99.5, captured_at: '2026-08-03T12:00:00Z' },
    trail: [{ lat: 0, lng: 0 }, { lat: 18.31, lng: -99.51 }],
    stops: [
      { sequence: 1, name: 'Válida', planned_lat: 18.32, planned_lng: -99.52 },
      { sequence: 2, name: 'Inválida', checkin_lat: 120, checkin_lng: 4 },
    ],
  })

  assert.equal(isValidCoordinate(0, 0), false)
  assert.equal(track.trail.length, 1)
  assert.equal(track.stops.length, 1)
  assert.deepEqual(buildUnitTrackBounds(track), [
    [18.3, -99.5], [18.31, -99.51], [18.32, -99.52],
  ])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/supervisorUnitTrackState.test.mjs`

Expected: failure because `unitTrackState.js` does not exist yet.

- [ ] **Step 3: Implement the minimal pure module**

Export these focused functions:

```js
export function isValidCoordinate(lat, lng) {
  const latitude = Number(lat)
  const longitude = Number(lng)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180
    && !(latitude === 0 && longitude === 0)
}

export function normalizeUnitTrack(payload) { /* current, trail, stops only */ }
export function buildUnitTrackBounds(track) { /* ordered [lat, lng] points */ }
export function unitTrackAvailability(response) { /* ready, empty, disabled, forbidden, date_not_allowed, error */ }
```

Keep the original stop properties needed by the UI: `sequence`, `name`, `done`, `result_status`, `arrived_at`, `planned_lat`, `planned_lng`, `checkin_lat`, and `checkin_lng`. For each stop, retain separate `planned` and `checkin` coordinates when both are valid; a stop must not be discarded just because only one coordinate source is available.

- [ ] **Step 4: Expand edge-case tests and verify green**

Add cases for: empty payload; a current point with no trail; `trail_available: false`; a visited stop with check-in coordinates; and the captured/redacted response envelopes for `FEATURE_DISABLED`, `FORBIDDEN`, and `DATE_NOT_ALLOWED`. Assert unavailable/error states produce no geometry. Then run:

Run: `node --test tests/supervisorUnitTrackState.test.mjs`

Expected: all unit-track state tests pass.

- [ ] **Step 5: Commit the pure contract**

```bash
git add src/modules/supervisor-ventas/unitTrackState.js tests/supervisorUnitTrackState.test.mjs
git commit -m "feat(supervisor): normalize unit track data"
```

### Task 2: Wire the PWA endpoint to the Odoo JSON controller

**Files:**

- Modify: `src/lib/api.js:directSupervisorVentas()`
- Modify: `src/modules/supervisor-ventas/api.js`
- Create: `tests/supervisorUnitTrackApi.test.mjs`

- [ ] **Step 1: Write a failing direct-bridge test**

Mock `globalThis.fetch`, seed `gf_session` with `employee_id`, `company_id`, and token values, then call:

```js
await api('GET', '/pwa-supv/unit-track?plan_id=800&date=2026-08-03')
```

Assert exactly one request reaches `/odoo-api/gf/salesops/supervisor/v2/unit-track`, uses JSON-RPC POST, sends `params.data.plan_id === 800`, sends `params.data.date === '2026-08-03'`, and has the standard supervisor metadata. Add a negative case where a missing/non-positive plan id returns the normal validation envelope without issuing a network request.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/supervisorUnitTrackApi.test.mjs`

Expected: failure because `/pwa-supv/unit-track` has no direct handler.

- [ ] **Step 3: Add the direct handler and public API function**

Inside `directSupervisorVentas`, next to the existing supervisor V2 JSON routes, add a GET-only case:

```js
if (cleanPath === '/pwa-supv/unit-track' && method === 'GET') {
  const planId = Number(query.get('plan_id') || 0)
  if (!Number.isInteger(planId) || planId <= 0) {
    return { ok: false, data: { code: 'VALIDATION_ERROR' }, message: 'plan_id requerido' }
  }
  return odooJson('/gf/salesops/supervisor/v2/unit-track', {
    meta: supervisorMeta(),
    data: { plan_id: planId, date: query.get('date') || undefined },
  })
}
```

In `src/modules/supervisor-ventas/api.js`, export:

```js
export function getUnitTrack(planId, date) {
  const qs = new URLSearchParams({ plan_id: String(Number(planId || 0)) })
  if (date) qs.set('date', date)
  return api('GET', `/pwa-supv/unit-track?${qs}`)
}
```

Do not add a generic fallback, raw `fetch`, `sudo`, employee id, branch id, or writes.

- [ ] **Step 4: Verify the bridge and regression suite**

Run:

```bash
node --test tests/supervisorUnitTrackApi.test.mjs
node --test tests/supervisorRouteTemplatesApi.test.mjs
```

Expected: both pass; the former proves the new contract and the latter protects adjacent supervisor direct routing.

- [ ] **Step 5: Commit the bridge**

```bash
git add src/lib/api.js src/modules/supervisor-ventas/api.js tests/supervisorUnitTrackApi.test.mjs
git commit -m "feat(supervisor): add unit track API bridge"
```

### Task 3: Add the Leaflet map component

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/modules/supervisor-ventas/UnitTrackMap.jsx`
- Create: `tests/supervisorUnitTrackScreen.test.mjs`

- [ ] **Step 1: Write the failing component/wiring test**

Use the repository's source-reading test style. Assert the new component imports only `MapContainer`, `TileLayer`, `Polyline`, `CircleMarker`, `Tooltip`, and `useMap` from `react-leaflet`; imports the Leaflet stylesheet; does not use `localStorage`, `sessionStorage`, `indexedDB`, `caches.`, or write HTTP verbs; and declares visual cases for `current`, `trail`, `planned`, and `checkin` geometry.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/supervisorUnitTrackScreen.test.mjs`

Expected: failure because `UnitTrackMap.jsx` and its dependencies do not exist.

- [ ] **Step 3: Install and implement the map surface**

Add runtime dependencies compatible with React 18:

```bash
npm install leaflet@^1.9.4 react-leaflet@^4.2.1
```

Implement `UnitTrackMap` with this public shape:

```jsx
export function UnitTrackMap({ track, typo }) { /* read-only map */ }
```

Required rendering rules:

- `TileLayer` uses `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` and OpenStreetMap attribution.
- A blue `CircleMarker`/div marker denotes `track.current` and its tooltip contains only capture time and speed, never an API key or token.
- A blue `Polyline` renders two or more valid trail points. A one-point trail is not rendered as a line.
- Planned stops render in neutral/amber; check-ins render in green; a stop with both draws both values rather than overwriting planned with actual.
- `FitBounds` runs only when `buildUnitTrackBounds(track)` returns two or more positions. For one usable position, `setView` uses a fixed operational zoom; for none, render no `MapContainer`.
- Keep component height mobile-safe (about 280px) and use `invalidateSize()` after mount so the map does not render in a collapsed card.
- `UnitTrackMap` renders geometry only. The parent card owns all unavailable/error copy, including the exact no-trail text: “Sin recorrido GPS disponible para esta jornada.”

- [ ] **Step 4: Verify map source test and build**

Run:

```bash
node --test tests/supervisorUnitTrackScreen.test.mjs
npm run build
```

Expected: both pass; the Vite build must package Leaflet assets successfully.

- [ ] **Step 5: Commit the map component**

```bash
git add package.json package-lock.json src/modules/supervisor-ventas/UnitTrackMap.jsx tests/supervisorUnitTrackScreen.test.mjs
git commit -m "feat(supervisor): render unit track map"
```

### Task 4: Integrate the map into the existing vendor detail route

**Files:**

- Modify: `src/modules/supervisor-ventas/ScreenDetalleVendedor.jsx:1-240`
- Modify: `tests/supervisorUnitTrackScreen.test.mjs`

- [ ] **Step 1: Extend the screen wiring test before editing the screen**

Add assertions that `ScreenDetalleVendedor` imports `getUnitTrack`, `UnitTrackMap`, and the state helpers; reads the existing query `route_id` as a positive plan ID; and keeps `getRouteStops` wired. Assert it contains no write method and no direct `fetch`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/supervisorUnitTrackScreen.test.mjs`

Expected: failure because the detail screen does not yet load or display tracking.

- [ ] **Step 3: Add non-blocking, cancellable track loading**

In `ScreenDetalleVendedor`, derive `routePlanId` from the existing query value. Preserve the current stops behavior, but request stops and tracking in parallel after `getDayOverview()` identifies the vendor. Keep the existing vendor header and stops available if unit-track is unavailable.

Use state shaped like:

```js
const [unitTrack, setUnitTrack] = useState(null)
const [unitTrackState, setUnitTrackState] = useState('idle')
const [unitTrackError, setUnitTrackError] = useState('')
```

Map the envelope through `unitTrackAvailability()` and `normalizeUnitTrack()`. Start stops and track requests in parallel with isolated results (`Promise.allSettled` or equivalent): a rejected track request must never enter the screen's existing fatal `load()` catch or hide the detail/stops. On a track-only transport/server failure, render a map-card retry action that repeats only `getUnitTrack(routePlanId)`.

Create an `AbortController` or monotonically increasing request id for each plan load. On unmount or when `routePlanId` changes, abort/ignore the pending request and immediately clear `unitTrack`, `unitTrackState`, and `unitTrackError`; never briefly render geometry from the prior plan. Do not persist the response.

If the user is forbidden, the flag is disabled, or the requested date is not allowed, render a compact information card with no route geometry. If the track is otherwise available but its trail is absent/empty, render the same card area with the exact text “Sin recorrido GPS disponible para esta jornada.” and any allowed current/stop geometry only. If tracking is ready, place `<UnitTrackMap track={unitTrack} typo={typo} />` after the departure/liquidation cards and before `CLIENTES`, under the heading `RECORRIDO DE UNIDAD`.

Do not change the URL contract in this task. The existing `route_id` value is the plan record id produced by the PWA's `/pwa-supv/team-routes` bridge; add an inline comment explaining this compatibility boundary and open a separate cleanup task for renaming it to `plan_id` across the screen hierarchy.

- [ ] **Step 4: Verify focused tests, lint, and full suite**

Run:

```bash
node --test tests/supervisorUnitTrackState.test.mjs tests/supervisorUnitTrackApi.test.mjs tests/supervisorUnitTrackScreen.test.mjs
npm run lint
npm test
npm run build
```

Expected: all pass with no new warnings.

- [ ] **Step 5: Manual acceptance test against deployed Odoo**

With a real supervisor account and an authorized plan for today:

1. Open `/equipo`, tap a vendor with a route, and confirm `/equipo/vendedor/<id>?route_id=<plan-id>` opens.
2. Confirm the map starts at current position and shows the complete trail plus planned/check-in stop markers.
3. Test a plan with no GPS trail: the detail and stops remain visible and the map card honestly states that no trail is available.
4. Turn the Radar flag off for the test scope: confirm no coordinates render and the card shows the disabled state.
5. Attempt a plan from another branch/date: confirm the PWA does not expose coordinates and displays the backend-denied state.
6. Change rapidly between two vendors/routes or leave the screen while a request is pending: confirm no geometry from the prior route becomes visible.
7. Simulate a rejected track request and use retry: confirm only the map card reloads and the header/stops stay usable.
8. Confirm browser storage and network capture contain no persisted trail payload, token, or employee GPS history beyond the in-memory request.

- [ ] **Step 6: Commit the screen integration**

```bash
git add src/modules/supervisor-ventas/ScreenDetalleVendedor.jsx tests/supervisorUnitTrackScreen.test.mjs
git commit -m "feat(supervisor): show unit track in vendor detail"
```

### Task 5: Final verification and handoff

**Files:**

- Verify: all files above

- [ ] **Step 1: Inspect the final diff**

Run: `git diff GrupoFrio...HEAD --check`

Expected: no whitespace errors; only map-related PWA files and dependency manifests changed.

- [ ] **Step 2: Re-run the complete quality gate**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Validate the deployed backend contract before opening the PWA PR**

Use an authorized supervisor token to call the PWA path once and save no sensitive response body in the repository. Confirm contract name/version `gf.salesops.supervisor.unit_track/1`, status/error behavior, non-empty authorized `current`/`trail` for a known GPS-equipped route, and that the backend deployment contains the #246 mobile-warehouse scope fix as well as #245.

- [ ] **Step 4: Prepare the PR description**

Include: endpoint contract; no-write/no-persistence guarantee; behavior when trail is unavailable; feature flag and supervisor scope dependency; user-notice dependency; manual acceptance evidence; and that map tiles require normal network availability.

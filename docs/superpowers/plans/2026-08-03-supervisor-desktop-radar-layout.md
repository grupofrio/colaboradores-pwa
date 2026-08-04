# Supervisor Desktop Radar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Supervisor desktop board into a routes column plus a selected-plan GPS map/pending-stops panel, while retaining an explicit route-detail action in the left column.

**Architecture:** Extract the selected-plan tracking effect from `RadarTab` into a reusable hook backed by `radarTrailState`. The desktop board derives one valid `effectivePlanId`, supplies it to routes, map, pending stops, and the hook, and renders `RadarView` in a map-only mode. `RutasView` separates desktop plan selection from route-detail navigation without changing its mobile card behavior.

**Tech Stack:** React 19 hooks, existing Supervisor V2 Radar state/API, Leaflet/react-leaflet, native Node test runner.

---

### Task 1: Extract selected-plan GPS loading into a reusable hook

**Files:**
- Create: `src/modules/supervisor-ventas/v2/radar/useRadarTrail.js`
- Modify: `src/modules/supervisor-ventas/v2/tabs/RadarTab.jsx`
- Modify: `tests/supervisorV2Surfaces.test.mjs`
- Create: `tests/supervisorRadarTrailHook.test.mjs`

- [ ] **Step 1: Write failing integration-source assertions for the shared hook.**

  Add a test that reads `RadarTab.jsx` and the new hook source. It must assert
  that `RadarTab` delegates to `useRadarTrail(activePlanId, operationalDate)`,
  and that only the hook imports/calls `getUnitTrack` while it uses
  `createRadarTrailRequest`, `applyRadarTrailResponse`, and
  `applyRadarTrailError`.

  Also create a runtime hook test with `react-test-renderer`, a `Harness`
  component, and controlled promises injected as `loadTrack`. It must mount
  plan A/date, synchronously observe the loading state, change to plan B before
  resolving A, resolve A, and assert that only B's state can publish. Repeat
  with an invalid plan and assert `loadTrack` is never called.

  ```js
  assert.match(radarTabSource, /useRadarTrail\(activePlanId, operationalDate\)/)
  assert.doesNotMatch(radarTabSource, /getUnitTrack\(/)
  assert.match(radarTrailHookSource, /getUnitTrack\(request\.planId, request\.operationalDate\)/)
  ```

- [ ] **Step 2: Run the focused test and observe the expected failure.**

  Run: `node --test tests/supervisorV2Surfaces.test.mjs tests/supervisorRadarTrailHook.test.mjs`

  Expected: FAIL because `useRadarTrail` does not exist and `RadarTab` still
  owns the request effect.

- [ ] **Step 3: Implement the hook with the existing request-key contract.**

  Move the state/effect from `RadarTab` into `useRadarTrail(planId,
  operationalDate, { loadTrack = getUnitTrack } = {})`. The optional third
  argument exists only to inject a deterministic loader in tests; production
  callers pass two arguments. It must synchronously install the result of
  `createRadarTrailRequest`, skip invalid keys, cancel on cleanup, and return
  a pair derived from the exact current request key:

  ```js
  export function useRadarTrail(planId, operationalDate, { loadTrack = getUnitTrack } = {}) {
    const [state, setState] = useState(() => createRadarTrailRequest(null, null))
    useEffect(() => {
      const request = createRadarTrailRequest(planId, operationalDate)
      setState(request)
      if (!request.key) return undefined
      let cancelled = false
      loadTrack(request.planId, request.operationalDate)
        .then((response) => { if (!cancelled) setState((prev) => applyRadarTrailResponse(prev, request.key, response)) })
        .catch(() => { if (!cancelled) setState((prev) => applyRadarTrailError(prev, request.key)) })
      return () => { cancelled = true }
    }, [planId, operationalDate, loadTrack])
    return { trail: selectRadarTrail(state, planId, operationalDate), trailStatus: state?.key === radarTrailKey(planId, operationalDate) ? state.status : 'idle' }
  }
  ```

  Export `radarTrailKey` from `radarTrailState.js` only if the hook needs it;
  do not duplicate the key expression. Simplify `RadarTab` to derive
  `activePlanId`/`operationalDate`, call the hook, and pass its returned values
  to `RadarView`.

- [ ] **Step 4: Run focused state and surface tests.**

  Run: `node --test tests/supervisorRadarTrailState.test.mjs tests/supervisorRadarTrailHook.test.mjs tests/supervisorV2Surfaces.test.mjs`

  Expected: PASS, including existing plan/date reset and failed-tracking tests.

- [ ] **Step 5: Commit the extraction.**

  ```bash
  git add src/modules/supervisor-ventas/v2/radar/useRadarTrail.js src/modules/supervisor-ventas/v2/radar/radarTrailState.js src/modules/supervisor-ventas/v2/tabs/RadarTab.jsx tests/supervisorRadarTrailHook.test.mjs tests/supervisorV2Surfaces.test.mjs
  git commit -m "refactor(supervisor): share selected radar trail loading"
  ```

### Task 2: Separate desktop route selection from route-detail navigation

**Files:**
- Modify: `src/modules/supervisor-ventas/v2/rutas/RutasView.jsx`
- Modify: `tests/supervisorDesktopBoard.test.mjs`

- [ ] **Step 1: Write failing tests for desktop route interactions.**

  Add a `react-test-renderer` interaction test where a desktop caller passes
  both callbacks. The route-card selection control must have a plan-specific
  name (`Seleccionar ruta <nombre>`); clicking **Abrir ruta** must call only
  `onOpenRoute(planId)` and leave the selection spy unchanged; clicking the
  selection control must call only `onSelectRoute(planId)`. Add a structural
  assertion that the action is not nested inside the selection `RowButton`.
  Assert the action has `minHeight: 44` and that the mobile path remains a
  single `RowButton` when `onSelectRoute` is absent.

  ```js
  assert.match(src, /onSelectRoute = null/)
  assert.match(src, /Abrir ruta/)
  assert.match(src, /minHeight: 44/)
  ```

- [ ] **Step 2: Run the focused test and observe the expected failure.**

  Run: `node --test tests/supervisorDesktopBoard.test.mjs`

  Expected: FAIL because `RutasView` has only `onOpenRoute` and its desktop
  route card currently overloads that callback for selection.

- [ ] **Step 3: Implement two non-nested desktop controls.**

  Extend `RutasView` with optional `onSelectRoute`. Set the selection control's
  `ariaLabel` to `Seleccionar ruta ${row.routeName}`. When the callback is
  present, render each route inside a non-interactive card with:

  - a `RowButton` that calls `onSelectRoute(row.planId)` and contains the route
    summary; and
  - a sibling real button labeled **Abrir ruta** that calls
    `onOpenRoute(row.planId)`.

  Do not nest a button inside `RowButton`. When `onSelectRoute` is absent,
  preserve the present mobile behavior: the single route card calls
  `onOpenRoute` and no extra action appears. Give the new desktop action
  `minHeight: 44`; do not use `stopPropagation` as the controls are siblings.

- [ ] **Step 4: Run the focused test.**

  Run: `node --test tests/supervisorDesktopBoard.test.mjs`

  Expected: PASS, with existing desktop/móvil isolation tests still passing.

- [ ] **Step 5: Commit the route interaction.**

  ```bash
  git add src/modules/supervisor-ventas/v2/rutas/RutasView.jsx tests/supervisorDesktopBoard.test.mjs
  git commit -m "feat(supervisor): keep route action in desktop routes"
  ```

### Task 3: Recompose the desktop board around one effective plan

**Files:**
- Modify: `src/modules/supervisor-ventas/v2/desktop/SupervisorDesktopBoard.jsx`
- Create: `src/modules/supervisor-ventas/v2/desktop/supervisorDesktopBoard.css`
- Modify: `src/modules/supervisor-ventas/v2/radar/RadarView.jsx`
- Modify: `tests/supervisorDesktopBoard.test.mjs`
- Modify: `tests/supervisorV2Surfaces.test.mjs`

- [ ] **Step 1: Write failing tests for the two-column, effective-plan board.**

  Add tests that require the board to:

  - use a two-column grid and place `PendingStopsColumn` after `RadarView`
    inside the same right column;
  - derive `effectivePlanId = resolveActivePlanId(day?.radar?.units, selectedPlanId)`;
  - use `effectivePlanId` for `RutasView.selectedPlanId`,
    `RadarView.selectedId`, `PendingStopsColumn.selectedPlanId`, and
    `useRadarTrail`;
  - pass `showUnitList={false}` only to desktop `RadarView`;
  - pass the hook's `trail` and `trailStatus` to that view; and
  - pass `onSelectRoute={selectPlan}` and `onOpenRoute={onOpenRoute}` to
    `RutasView`.

  Add CSS/source assertions for `.supervisor-desktop-board-grid` with two
  columns at normal desktop width and one column at `max-width: 1180px`; the
  narrow rule must clear the fixed viewport height so both stacked sections can
  scroll normally. Assert that a semantic **Clientes sin visitar** heading
  occurs after `RadarView` inside the right column, before `PendingStopsColumn`.

  Add a `RadarView` render/source assertion that `showUnitList` defaults to
  `true` and gates only the `radar-list` card, preserving mobile output.

- [ ] **Step 2: Run the focused tests and observe the expected failure.**

  Run: `node --test tests/supervisorDesktopBoard.test.mjs tests/supervisorV2Surfaces.test.mjs`

  Expected: FAIL because the board remains a three-column layout, uses raw
  selection/toggle semantics, does not load/pass desktop trail data, and
  `RadarView` always renders the unit list.

- [ ] **Step 3: Implement a synchronized two-column desktop board.**

  In `SupervisorDesktopBoard`:

  ```js
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const effectivePlanId = resolveActivePlanId(day?.radar?.units, selectedPlanId)
  const selectPlan = useCallback((planId) => {
    if (Number.isSafeInteger(planId) && planId > 0) setSelectedPlanId(planId)
  }, [])
  const { trail, trailStatus } = useRadarTrail(effectivePlanId, day?.dayControl?.date)
  ```

  Import a focused stylesheet, then replace the three-column inline grid with a
  `supervisor-desktop-board-grid` wrapper containing left `Column`
  **Rutas de hoy** and a right `Column`. The stylesheet owns the two-column
  grid and at `max-width: 1180px` stacks it to one column and removes the fixed
  height. In the right column render `RadarView` first, then a semantic section
  with `<h2>Clientes sin visitar</h2>` and `PendingStopsColumn`. Use
  `effectivePlanId` at every boundary. Remove the desktop clear-filter
  prop/button because an effective plan is always valid. Keep existing no-radar
  honest copy and scroll constraints.

  In `RadarView`, add `showUnitList = true` and wrap only the `radar-list`
  card in that flag. Do not gate map, selector, GPS legend, or modal.

- [ ] **Step 4: Run focused tests and static type-free checks.**

  Run: `node --test tests/supervisorDesktopBoard.test.mjs tests/supervisorV2Surfaces.test.mjs tests/supervisorV2Red.test.mjs`

  Expected: PASS. Confirm the desktop map is the only desktop Radar surface
  and mobile Radar retains `radar-list` by default.

- [ ] **Step 5: Commit the desktop layout.**

  ```bash
  git add src/modules/supervisor-ventas/v2/desktop/SupervisorDesktopBoard.jsx src/modules/supervisor-ventas/v2/desktop/supervisorDesktopBoard.css src/modules/supervisor-ventas/v2/radar/RadarView.jsx tests/supervisorDesktopBoard.test.mjs tests/supervisorV2Surfaces.test.mjs
  git commit -m "feat(supervisor): reorganize desktop radar workspace"
  ```

### Task 4: Verify selected-plan GPS behavior and the complete PR

**Files:**
- Modify as needed only for test corrections from the checks below.

- [ ] **Step 1: Run the full test suite.**

  Run: `npm test`

  Expected: PASS with zero failures.

- [ ] **Step 2: Run lint and production build.**

  Run: `npm run lint && npm run build`

  Expected: both commands exit 0; the existing Vite chunk-size advisory may be
  printed but must not be a build failure.

- [ ] **Step 3: Inspect the branch diff.**

  Run: `git diff --check origin/main...HEAD`

  Expected: no whitespace errors and no unrelated files staged.

- [ ] **Step 4: Smoke-check the desktop interaction.**

  Verify a valid initial plan, a route switch while an earlier tracking request
  is pending, an unavailable trail, **Abrir ruta**, the expanded-map close
  flow, and mobile Radar list retention. Use the existing Node test harness for
  deterministic state transitions; use a browser only if a valid supervisor
  session is available.

- [ ] **Step 5: Update PR #137.**

  Push the existing branch, update the PR summary with the desktop layout and
  route-detail action, and record the fresh checks.

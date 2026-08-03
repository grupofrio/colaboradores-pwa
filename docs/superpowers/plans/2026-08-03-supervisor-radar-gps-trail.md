# Supervisor Radar GPS Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the selected plan's real same-day GPS trail in Radar and let the supervisor expand the map in an accessible overlay.

**Architecture:** Reuse the existing `getUnitTrack(planId, dayControl.date)` API and `unitTrackState` normalization. Keep Radar base points independent from tracking; add optional normalized trail to the Leaflet presentation and reuse the identical map/data in an overlay rather than issuing another request.

**Tech Stack:** React 19, existing supervisor API/state modules, Leaflet/react-leaflet, Node test runner.

---

### Task 1: Add Radar tracking state and stale-response guards

**Files:**
- Create: `src/modules/supervisor-ventas/v2/radar/radarTrailState.js`
- Create: `tests/supervisorRadarTrailState.test.mjs`

- [ ] **Step 1:** Write failing tests for a `(planId, operationalDate)` request gate, unavailable/one-point trail, deduped current endpoint, and late-response rejection.
- [ ] **Step 2:** Run `node --test tests/supervisorRadarTrailState.test.mjs` (expect failure).
- [ ] **Step 3:** Implement pure helpers using existing `normalizeUnitTrack`/coordinate rules. Return no trail for unavailable/error/less than two points; do not mutate base Radar points.
- [ ] **Step 4:** Run focused test (expect pass).
- [ ] **Step 5:** Commit `feat(supervisor): normalize radar GPS trail`.

### Task 2: Load selected-plan tracking in Radar

**Files:**
- Modify: `src/modules/supervisor-ventas/v2/tabs/RadarTab.jsx`
- Modify: `src/modules/supervisor-ventas/v2/radar/RadarView.jsx`
- Modify: `tests/supervisorV2Surfaces.test.mjs`

- [ ] **Step 1:** Write failing tests proving a valid active plan requests `getUnitTrack(planId, dayControl.date)`, selection/date change invalidates late data, and tracking failure leaves Radar base map/list usable.
- [ ] **Step 2:** Run affected tests (expect failure).
- [ ] **Step 3:** Add a scoped effect in `RadarTab`; pass only normalized trail/status to `RadarView`. Do not request for invalid/no plan, use device date, or let errors clear Radar data.
- [ ] **Step 4:** Pass focused tests and commit `feat(supervisor): load selected radar GPS trail`.

### Task 3: Render rastro GPS and accessible map expansion

**Files:**
- Modify: `src/modules/supervisor-ventas/v2/radar/PositionMap.jsx`
- Modify: `src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx`
- Modify: `src/modules/supervisor-ventas/v2/radar/RadarView.jsx`
- Modify: `tests/supervisorV2Red.test.mjs`

- [ ] **Step 1:** Write failing source/render tests for Polyline only with 2+ trail points, exact “Rastro GPS de hoy”/no-trail copy, viewport inclusion, and an expand button/modal with role dialog, aria-modal, initial/trapped/restored focus, Escape and no new API call.
- [ ] **Step 2:** Run focused tests (expect failure).
- [ ] **Step 3:** Extend map props with optional `trail`; render actual GPS polyline (never planned sequence), dedupe current endpoint, and add a keyboard-accessible overlay that reuses the same map data. Keep OSM and no-live wording.
- [ ] **Step 4:** Run focused tests, lint and build (expect pass).
- [ ] **Step 5:** Commit `feat(supervisor): show radar GPS trail and expanded map`.

### Task 4: Full verification and PR update

- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check main...HEAD`.
- [ ] Smoke test a selected plan with trail, one without trail, plan switching and overlay keyboard close.
- [ ] Push the existing PR branch and update PR #134 summary/checks.

# Baja Controlada PWA Sugey Angelica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `gf-pwa-colaboradores` sections for Sugey field verification and Angelica Jaimes approval in the controlled customer deactivation workflow, gated by their real Odoo `hr.job` IDs.

**Architecture:** The feature lives inside the existing `supervisor-ventas` module under `/equipo/bajas/*`. Frontend logic is split into a pure state/validation module, an API service module, and focused screens for hub, Sugey queue/detail, and Angelica queue/detail. Odoo/GrupoFrio remains the workflow authority: the PWA only captures intermediate verification/approval data and calls `/pwa-supv/customer-deactivation/*` endpoints.

**Tech Stack:** React 18, React Router v6, Vite 5, plain JS modules, `node:test`, existing `TOKENS`, `ScreenShell`, `Loader`, `EmptyState`, `ErrorState`, `PhotoCapture`, and `src/lib/api.js`.

---

## Preconditions

- Confirm the real Odoo `hr.job` IDs:
  - `SUGEY_DEACTIVATION_JOB_IDS`
  - `ANGELICA_DEACTIVATION_JOB_IDS`
- Confirm whether Odoo login/session will send `additional_job_ids`. If it does not, implement frontend support defensively but rely on primary `session.job_id[0]`.
- Confirm backend endpoint availability. If endpoints are not ready, implement PWA service calls and direct `src/lib/api.js` passthroughs only; screens must show actionable errors instead of using mock data.

## File Structure

PWA files:

- Create: `src/modules/supervisor-ventas/customerDeactivationState.js`
  - Pure constants, normalizers, permission helpers by `job_id`, validators, payload builders, image/GPS helpers.
- Create: `src/modules/supervisor-ventas/customerDeactivationService.js`
  - API client wrapper for `/pwa-supv/customer-deactivation/*`.
- Create: `src/modules/supervisor-ventas/ScreenBajasHub.jsx`
  - Hub with summary counters and access-aware links to Sugey/Angelica queues.
- Create: `src/modules/supervisor-ventas/ScreenBajasSugey.jsx`
  - Queue for `pending_sugey`.
- Create: `src/modules/supervisor-ventas/ScreenBajasSugeyDetail.jsx`
  - Detail + field verification form for Sugey.
- Create: `src/modules/supervisor-ventas/ScreenBajasAngelica.jsx`
  - Queue for `pending_angelica`.
- Create: `src/modules/supervisor-ventas/ScreenBajasAngelicaDetail.jsx`
  - Detail + decision form for Angelica.
- Modify: `src/modules/supervisor-ventas/api.js`
  - Re-export service functions or keep existing API exports and import new service directly from screens.
- Modify: `src/lib/api.js`
  - Add direct handlers in `directSupervisorVentas()` for the new `/pwa-supv/customer-deactivation/*` routes so requests go to Odoo instead of n8n fallback.
- Modify: `src/App.jsx`
  - Add lazy imports and routes for `/equipo/bajas`, `/equipo/bajas/sugey`, `/equipo/bajas/sugey/:requestId`, `/equipo/bajas/angelica`, `/equipo/bajas/angelica/:requestId`.
- Modify: `src/modules/supervisor-ventas/ScreenControlComercial.jsx`
  - Add a quick action to `/equipo/bajas`, visible only when the session has a configured deactivation job ID.
- Optional Modify: `src/lib/roleContext.js`
  - Only if shared helper support for `additional_job_ids` belongs there after implementation starts.

Tests:

- Create: `tests/customerDeactivationState.test.mjs`
- Create: `tests/customerDeactivationService.test.mjs`
- Create: `tests/customerDeactivationRouting.test.mjs`
- Create: `tests/customerDeactivationControlComercial.test.mjs`
- Optional Create: `tests/customerDeactivationScreens.test.mjs` for static screen wiring if component-level rendering is not available.

Odoo/GrupoFrio required endpoints:

- `GET /pwa-supv/customer-deactivation/summary`
- `GET /pwa-supv/customer-deactivation/sugey`
- `GET /pwa-supv/customer-deactivation/angelica`
- `GET /pwa-supv/customer-deactivation/<id>`
- `POST /pwa-supv/customer-deactivation/<id>/sugey-verify`
- `POST /pwa-supv/customer-deactivation/<id>/angelica-decide`

---

## Task 1: Pure State, Permissions, Validation, Payloads

**Files:**
- Create: `src/modules/supervisor-ventas/customerDeactivationState.js`
- Test: `tests/customerDeactivationState.test.mjs`

- [ ] **Step 1: Write failing state tests**

Add tests covering:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ANGELICA_DECISIONS,
  SUGEY_VERIFICATION_RESULTS,
  buildAngelicaDecisionPayload,
  buildSugeyVerificationPayload,
  canAccessAngelicaDeactivation,
  canAccessSugeyDeactivation,
  normalizeDeactivationRequest,
  validateAngelicaDecisionForm,
  validateSugeyVerificationForm,
} from '../src/modules/supervisor-ventas/customerDeactivationState.js'

test('permission helpers use primary and additional job ids', () => {
  const config = { sugeyJobIds: [11], angelicaJobIds: [22] }

  assert.equal(canAccessSugeyDeactivation({ job_id: [11, 'Sugey'] }, config), true)
  assert.equal(canAccessAngelicaDeactivation({ job_id: [22, 'Angelica'] }, config), true)
  assert.equal(canAccessSugeyDeactivation({ job_id: [1, 'Other'], additional_job_ids: [11] }, config), true)
  assert.equal(canAccessAngelicaDeactivation({ job_id: [1, 'Other'], additional_job_ids: [22] }, config), true)
  assert.equal(canAccessSugeyDeactivation({ job_id: [22, 'Angelica'] }, config), false)
})

test('normalizes deactivation request response shape', () => {
  assert.deepEqual(normalizeDeactivationRequest({
    id: '123',
    state: 'pending_sugey',
    partner_id: [456, 'Abarrotes Centro'],
    route_name: 'Ruta Norte',
    driver_name: 'Chofer',
    reason: 'not_exists',
    request_comment: 'Cerrado',
    request_photo_url: '/web/content/1',
    age_hours: '6',
  }), {
    id: 123,
    name: '',
    state: 'pending_sugey',
    partner_id: 456,
    partner_name: 'Abarrotes Centro',
    route_name: 'Ruta Norte',
    driver_name: 'Chofer',
    reason: 'not_exists',
    request_comment: 'Cerrado',
    request_contact_person: '',
    request_latitude: null,
    request_longitude: null,
    request_photo_url: '/web/content/1',
    requested_at: '',
    sugey_result: '',
    sugey_comment: '',
    sugey_photo_url: '',
    age_hours: 6,
  })
})

test('validates Sugey verification before submit', () => {
  assert.equal(validateSugeyVerificationForm({
    result: '',
    comment: 'ok',
    photoBase64: 'abc',
    latitude: 19,
    longitude: -99,
  }), 'Selecciona el resultado de verificacion.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: '',
    photoBase64: 'abc',
    latitude: 19,
    longitude: -99,
  }), 'El comentario es obligatorio.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: 'ok',
    photoBase64: '',
    latitude: 19,
    longitude: -99,
  }), 'La foto es obligatoria.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: 'ok',
    photoBase64: 'abc',
    latitude: null,
    longitude: -99,
  }), 'GPS obligatorio para verificar la solicitud.')
})

test('builds Sugey and Angelica payloads', () => {
  assert.deepEqual(buildSugeyVerificationPayload({
    result: 'confirmed_not_exists',
    comment: '  confirmado ',
    photoBase64: 'data:image/jpeg;base64,abc',
    latitude: 19,
    longitude: -99,
    accuracy: 15,
    verifiedAt: '2026-07-01T12:00:00-06:00',
  }), {
    result: 'confirmed_not_exists',
    comment: 'confirmado',
    photo_base64: 'abc',
    photo_mime: 'image/jpeg',
    latitude: 19,
    longitude: -99,
    accuracy: 15,
    verified_at: '2026-07-01T12:00:00-06:00',
  })

  assert.deepEqual(buildAngelicaDecisionPayload({
    decision: 'approve',
    comment: '  ok ',
    decidedAt: '2026-07-01T14:00:00-06:00',
  }), {
    decision: 'approve',
    comment: 'ok',
    decided_at: '2026-07-01T14:00:00-06:00',
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/customerDeactivationState.test.mjs
```

Expected: FAIL because `customerDeactivationState.js` does not exist.

- [ ] **Step 3: Implement minimal state module**

Implement:

- `SUGEY_VERIFICATION_RESULTS`
- `ANGELICA_DECISIONS`
- `getSessionJobIds(session)`
- `canAccessSugeyDeactivation(session, config)`
- `canAccessAngelicaDeactivation(session, config)`
- `normalizeDeactivationRequest(row)`
- `validateSugeyVerificationForm(form)`
- `validateAngelicaDecisionForm(form)`
- `stripDataUrlBase64(value)`
- `buildSugeyVerificationPayload(form)`
- `buildAngelicaDecisionPayload(form)`

Default config should be empty arrays:

```js
export const DEFAULT_DEACTIVATION_JOB_CONFIG = {
  sugeyJobIds: [],
  angelicaJobIds: [],
}
```

Do not hardcode person names as permissions.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/customerDeactivationState.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/supervisor-ventas/customerDeactivationState.js tests/customerDeactivationState.test.mjs
git commit -m "feat: add customer deactivation state helpers"
```

---

## Task 2: Service Layer and API Direct Routing

**Files:**
- Create: `src/modules/supervisor-ventas/customerDeactivationService.js`
- Modify: `src/lib/api.js`
- Test: `tests/customerDeactivationService.test.mjs`

- [ ] **Step 1: Write failing service/static routing tests**

Test that:

- service exports all six functions;
- each service function calls the expected `/pwa-supv/customer-deactivation/*` path;
- `src/lib/api.js` contains direct handlers for the new routes and uses `odooHttp` for GET list/detail and `odooJson` for POST decisions.

Example static assertions:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('customer deactivation service exposes Odoo endpoints', () => {
  const service = fs.readFileSync(path.join(root, 'src/modules/supervisor-ventas/customerDeactivationService.js'), 'utf8')
  assert.match(service, /getCustomerDeactivationSummary/)
  assert.match(service, /getSugeyDeactivationQueue/)
  assert.match(service, /getAngelicaDeactivationQueue/)
  assert.match(service, /getCustomerDeactivationDetail/)
  assert.match(service, /verifyCustomerDeactivationAsSugey/)
  assert.match(service, /decideCustomerDeactivationAsAngelica/)
  assert.match(service, /\/pwa-supv\/customer-deactivation\/summary/)
  assert.match(service, /\/pwa-supv\/customer-deactivation\/sugey/)
  assert.match(service, /\/pwa-supv\/customer-deactivation\/angelica/)
  assert.match(service, /sugey-verify/)
  assert.match(service, /angelica-decide/)
})

test('api direct router handles deactivation routes without n8n fallback', () => {
  const api = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8')
  assert.match(api, /\/pwa-supv\/customer-deactivation\/summary/)
  assert.match(api, /\/pwa-supv\/customer-deactivation\/sugey/)
  assert.match(api, /\/pwa-supv\/customer-deactivation\/angelica/)
  assert.match(api, /sugey-verify/)
  assert.match(api, /angelica-decide/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/customerDeactivationService.test.mjs
```

Expected: FAIL because service and direct handlers do not exist.

- [ ] **Step 3: Implement service functions**

`customerDeactivationService.js` should import `api` from `../../lib/api.js`.

Use:

- `GET /pwa-supv/customer-deactivation/summary`
- `GET /pwa-supv/customer-deactivation/sugey?limit=&offset=&route=&reason=`
- `GET /pwa-supv/customer-deactivation/angelica?limit=&offset=&route=&reason=`
- `GET /pwa-supv/customer-deactivation/${requestId}`
- `POST /pwa-supv/customer-deactivation/${requestId}/sugey-verify`
- `POST /pwa-supv/customer-deactivation/${requestId}/angelica-decide`

Normalize common response envelopes:

```js
function unwrapData(result) {
  return result?.data || result || {}
}
```

- [ ] **Step 4: Add direct handlers in `src/lib/api.js`**

Inside `directSupervisorVentas()`, before the final `return NO_DIRECT`, add passthroughs:

- summary: `odooHttp('GET', '/pwa-supv/customer-deactivation/summary', { company_id: companyId || undefined })`
- Sugey queue: `odooHttp('GET', '/pwa-supv/customer-deactivation/sugey', query params + company)`
- Angelica queue: `odooHttp('GET', '/pwa-supv/customer-deactivation/angelica', query params + company)`
- detail: match path `^/pwa-supv/customer-deactivation/(\d+)$`, call `odooHttp('GET', path, { company_id })`
- Sugey verify: match `^/pwa-supv/customer-deactivation/(\d+)/sugey-verify$`, call `odooJson(path, body)`
- Angelica decide: match `^/pwa-supv/customer-deactivation/(\d+)/angelica-decide$`, call `odooJson(path, body)`

Do not add model fallback reads for this workflow. If Odoo endpoint is missing, the UI should surface the backend error.

- [ ] **Step 5: Run service test**

Run:

```bash
node --test tests/customerDeactivationService.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/supervisor-ventas/customerDeactivationService.js src/lib/api.js tests/customerDeactivationService.test.mjs
git commit -m "feat: add customer deactivation pwa service"
```

---

## Task 3: Routing and Access Wiring

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/modules/supervisor-ventas/ScreenControlComercial.jsx`
- Test: `tests/customerDeactivationRouting.test.mjs`
- Test: `tests/customerDeactivationControlComercial.test.mjs`

- [ ] **Step 1: Write failing routing tests**

Static tests should assert:

- lazy imports exist for all five new screens;
- routes exist:
  - `/equipo/bajas`
  - `/equipo/bajas/sugey`
  - `/equipo/bajas/sugey/:requestId`
  - `/equipo/bajas/angelica`
  - `/equipo/bajas/angelica/:requestId`

- [ ] **Step 2: Write failing Control Comercial test**

Static test should assert:

- `ScreenControlComercial.jsx` imports `canAccessSugeyDeactivation` or `canAccessAngelicaDeactivation`;
- it has a quick action route `/equipo/bajas`;
- it does not show the action unconditionally; visibility must reference job-id permission helper.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
node --test tests/customerDeactivationRouting.test.mjs
node --test tests/customerDeactivationControlComercial.test.mjs
```

Expected: FAIL.

- [ ] **Step 4: Add lazy imports and routes**

In `src/App.jsx`, add lazy imports near Supervisor Ventas imports:

```js
const ScreenBajasHub = lazy(() => import('./modules/supervisor-ventas/ScreenBajasHub'))
const ScreenBajasSugey = lazy(() => import('./modules/supervisor-ventas/ScreenBajasSugey'))
const ScreenBajasSugeyDetail = lazy(() => import('./modules/supervisor-ventas/ScreenBajasSugeyDetail'))
const ScreenBajasAngelica = lazy(() => import('./modules/supervisor-ventas/ScreenBajasAngelica'))
const ScreenBajasAngelicaDetail = lazy(() => import('./modules/supervisor-ventas/ScreenBajasAngelicaDetail'))
```

Add routes in the Supervisor Ventas block with `PrivateRoute`.

- [ ] **Step 5: Add permission-aware quick action**

In `ScreenControlComercial.jsx`:

- import `useSession` from `../../App`;
- import permission helpers and job config;
- derive `canOpenBajas = canAccessSugeyDeactivation(session, config) || canAccessAngelicaDeactivation(session, config)`;
- add `Bajas controladas` quick action only when `canOpenBajas`.

Keep existing quick action layout stable.

- [ ] **Step 6: Create temporary placeholder screens**

Create minimal placeholder components for the five screens so routes compile:

```jsx
import { ScreenShell, EmptyState } from '../entregas/components'

export default function ScreenBajasHub() {
  return (
    <ScreenShell title="Bajas controladas" backTo="/equipo">
      <EmptyState icon="📋" title="Bajas controladas" subtitle="Modulo en preparacion" />
    </ScreenShell>
  )
}
```

Use ASCII-safe text if the file style is ASCII.

- [ ] **Step 7: Run tests**

```bash
node --test tests/customerDeactivationRouting.test.mjs
node --test tests/customerDeactivationControlComercial.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/modules/supervisor-ventas/ScreenControlComercial.jsx src/modules/supervisor-ventas/ScreenBajas*.jsx tests/customerDeactivationRouting.test.mjs tests/customerDeactivationControlComercial.test.mjs
git commit -m "feat: wire customer deactivation pwa routes"
```

---

## Task 4: Hub Screen

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenBajasHub.jsx`
- Test: `tests/customerDeactivationScreens.test.mjs`

- [ ] **Step 1: Write failing hub wiring test**

Assert the hub:

- imports `getCustomerDeactivationSummary`;
- imports permission helpers;
- links to `/equipo/bajas/sugey` only under Sugey access;
- links to `/equipo/bajas/angelica` only under Angelica access;
- renders summary keys `pending_sugey`, `pending_angelica`, `second_visit_required`, `commercial_recovery`.

- [ ] **Step 2: Run test to verify failure**

```bash
node --test tests/customerDeactivationScreens.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement hub**

Use:

- `ScreenShell title="Bajas controladas" backTo="/equipo"`
- `Loader`, `ErrorState`, `EmptyState`
- summary cards with compact counts
- action cards to Sugey/Angelica queues

If no access:

```txt
No tienes una asignacion de puesto habilitada para bajas controladas.
```

- [ ] **Step 4: Run tests**

```bash
node --test tests/customerDeactivationScreens.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenBajasHub.jsx tests/customerDeactivationScreens.test.mjs
git commit -m "feat: add customer deactivation hub"
```

---

## Task 5: Sugey Queue and Detail

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenBajasSugey.jsx`
- Modify: `src/modules/supervisor-ventas/ScreenBajasSugeyDetail.jsx`
- Test: `tests/customerDeactivationScreens.test.mjs`

- [ ] **Step 1: Extend failing screen tests for Sugey**

Assert:

- queue calls `getSugeyDeactivationQueue`;
- queue normalizes requests;
- detail calls `getCustomerDeactivationDetail`;
- detail calls `verifyCustomerDeactivationAsSugey`;
- detail uses `validateSugeyVerificationForm`;
- detail uses `buildSugeyVerificationPayload`;
- detail uses `navigator.geolocation.getCurrentPosition`;
- detail uses photo capture/input and sends `photo_base64`.

- [ ] **Step 2: Run test to verify failure**

```bash
node --test tests/customerDeactivationScreens.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement Sugey queue**

UI:

- `ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas"`
- filters for route/reason can be simple select/input first pass;
- list request cards with:
  - client name;
  - reason;
  - route;
  - driver;
  - requested age;
  - evidence marker;
  - CTA `Verificar`.

States:

- loading;
- error with retry;
- empty state.

- [ ] **Step 4: Implement Sugey detail**

Detail must show:

- initial driver evidence;
- client info;
- request comment/contact;
- current state;
- photo preview;
- GPS status.

Submission:

- collect GPS via `navigator.geolocation.getCurrentPosition`;
- require result/comment/photo/GPS;
- call `verifyCustomerDeactivationAsSugey(requestId, payload)`;
- navigate back to `/equipo/bajas/sugey` on success.

Use a simple file input or `PhotoCapture`; if using `PhotoCapture`, avoid linked upload and submit base64 in the verification payload.

- [ ] **Step 5: Run focused tests**

```bash
node --test tests/customerDeactivationScreens.test.mjs
node --test tests/customerDeactivationState.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenBajasSugey.jsx src/modules/supervisor-ventas/ScreenBajasSugeyDetail.jsx tests/customerDeactivationScreens.test.mjs
git commit -m "feat: add sugey deactivation verification screens"
```

---

## Task 6: Angelica Queue and Detail

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenBajasAngelica.jsx`
- Modify: `src/modules/supervisor-ventas/ScreenBajasAngelicaDetail.jsx`
- Test: `tests/customerDeactivationScreens.test.mjs`

- [ ] **Step 1: Extend failing screen tests for Angelica**

Assert:

- queue calls `getAngelicaDeactivationQueue`;
- detail calls `getCustomerDeactivationDetail`;
- detail calls `decideCustomerDeactivationAsAngelica`;
- detail uses `validateAngelicaDecisionForm`;
- detail uses `buildAngelicaDecisionPayload`;
- detail references driver evidence and Sugey evidence.

- [ ] **Step 2: Run test to verify failure**

```bash
node --test tests/customerDeactivationScreens.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement Angelica queue**

UI:

- `ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas"`
- list `pending_angelica` cards;
- show client, reason, Sugey result, evidence count, age;
- CTA `Revisar`.

- [ ] **Step 4: Implement Angelica detail**

Detail must show:

- driver evidence;
- Sugey evidence;
- timeline/state log if backend returns it;
- decision selector;
- comment field.

Submission:

- require decision;
- require comment for `reject`, `request_second_verification`, `keep_active`, `commercial_recovery`;
- call `decideCustomerDeactivationAsAngelica(requestId, payload)`;
- navigate back to `/equipo/bajas/angelica` on success.

- [ ] **Step 5: Run focused tests**

```bash
node --test tests/customerDeactivationScreens.test.mjs
node --test tests/customerDeactivationState.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenBajasAngelica.jsx src/modules/supervisor-ventas/ScreenBajasAngelicaDetail.jsx tests/customerDeactivationScreens.test.mjs
git commit -m "feat: add angelica deactivation approval screens"
```

---

## Task 7: Backend/Odoo Contract Checklist

**Files:**
- Modify or create in GrupoFrio/Odoo repo, not in this PWA repo.
- Optional docs update in this repo if endpoint details change.

- [ ] **Step 1: Confirm model fields**

The Odoo request model must expose enough fields for:

- request identity;
- partner;
- route/driver;
- initial driver evidence;
- Sugey evidence;
- Angelica decision;
- state;
- bitacora.

- [ ] **Step 2: Implement endpoint permissions by job ID**

Backend must validate authenticated employee `job_id`:

- Sugey endpoints accept only configured Sugey `hr.job` IDs.
- Angelica endpoints accept only configured Angelica `hr.job` IDs.

Do not rely on frontend role or person name.

- [ ] **Step 3: Implement endpoints**

Implement the six endpoints listed in the spec.

- [ ] **Step 4: Verify with curl or backend tests**

Required backend cases:

- employee with Sugey job ID can list and verify Sugey queue;
- employee without Sugey job ID gets 403;
- employee with Angelica job ID can list and decide Angelica queue;
- employee without Angelica job ID gets 403;
- Sugey verify creates attachment/evidence and state transition;
- Angelica approve does not set `applied`;
- final Odoo action is the only path to `applied`.

---

## Task 8: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run targeted tests**

```bash
node --test tests/customerDeactivationState.test.mjs
node --test tests/customerDeactivationService.test.mjs
node --test tests/customerDeactivationRouting.test.mjs
node --test tests/customerDeactivationControlComercial.test.mjs
node --test tests/customerDeactivationScreens.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run lint/build**

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 4: Check whitespace**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Manual QA**

Run dev server:

```bash
npm run dev
```

Manual checks:

- user with Sugey `job_id` sees `/equipo/bajas/sugey` and not Angelica decision actions;
- user with Angelica `job_id` sees `/equipo/bajas/angelica` and not Sugey verification form;
- Sugey cannot submit without GPS/photo/comment/result;
- Angelica cannot submit rejection/second visit/recovery without comment;
- Angelica approval does not mark customer applied;
- backend state transitions are visible after refresh.

- [ ] **Step 6: Final commit**

```bash
git status --short
git add <changed-files>
git commit -m "feat: add controlled deactivation pwa flow"
```

---

## Risks

- `job_id` values are not known yet. Implementation must not ship with guessed IDs.
- If Odoo does not provide `additional_job_ids`, only the primary `session.job_id[0]` can be evaluated.
- If backend endpoints are missing, the PWA will route correctly but show endpoint errors.
- Current PWA is mostly online-first; do not promise offline behavior for Sugey/Angelica in this phase.
- Existing `src/lib/api.js` is large. Keep new direct handlers small and do not add generic model fallbacks for this workflow.

## Acceptance Criteria

- Bajas appear under `/equipo/bajas`.
- Access is gated by real Odoo `job_id`, not by name.
- Sugey can verify pending requests with GPS, photo, comment and result.
- Angelica can review driver + Sugey evidence and submit a decision.
- PWA never applies final baja.
- Odoo remains the workflow source of truth.
- Tests, lint and build pass.

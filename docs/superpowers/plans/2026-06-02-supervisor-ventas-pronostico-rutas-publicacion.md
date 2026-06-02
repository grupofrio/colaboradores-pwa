# Supervisor Ventas Pronostico Rutas Publicacion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the sales supervisor choose a date, open a CEDIS route, generate a draft customer proposal from polygon/subpolygon criteria, manually edit the customer list, and publish the daily `gf.route.plan`.

**Architecture:** Keep Odoo as the source of truth for geography, plan creation, stops and publication. Add small, testable helpers in `routePlanning.js`, thin client wrappers in `api.js`, BFF proxy handlers in `src/lib/api.js`, then reorganize the manual area of `ScreenPronostico.jsx` into route list and route detail states without changing the Plan Maestro mode.

**Tech Stack:** React 18, Vite, Node `node:test`, existing `api()` wrapper, existing Odoo JSON-RPC bridge in `src/lib/api.js`.

---

## File Structure

- Modify `src/modules/supervisor-ventas/routePlanning.js`
  - Add route plan publication states, multi-subpolygon payload builder, preview customer normalizer and editability helpers.
  - Keep existing single `subpolygon_id` helper for backwards compatibility until the UI stops using it.

- Modify `tests/supervisorRoutePlanning.test.mjs`
  - Add unit tests for multi-subpolygon payloads, customer normalization, plan state mapping and editability.

- Modify `src/modules/supervisor-ventas/api.js`
  - Add wrappers for preview, save draft, remove customer and publish.
  - Keep existing wrappers used by `ScreenPlanDiarioClientes.jsx`.

- Modify `src/lib/api.js`
  - Add `/pwa-supv/route-plan-preview-customers`, `/pwa-supv/route-plan-save-draft`, `/pwa-supv/route-plan-remove-customer`, `/pwa-supv/route-plan-publish` handlers.
  - Proxy to the proposed Odoo endpoints with `supervisorMeta()` and normalized payloads.

- Modify `src/modules/supervisor-ventas/ScreenPronostico.jsx`
  - Keep Plan Maestro mode unchanged.
  - Rework manual mode into date-first route cards and selected-route detail.
  - Add preview customer list, remove customer, manual add search and publish controls.

- Optional modify `docs/superpowers/specs/2026-06-02-supervisor-ventas-pronostico-rutas-publicacion-design.md`
  - Only if implementation reveals a contract clarification that should be documented.

---

### Task 1: Add Testable Route Planning Helpers

**Files:**
- Modify: `src/modules/supervisor-ventas/routePlanning.js`
- Test: `tests/supervisorRoutePlanning.test.mjs`

- [ ] **Step 1: Write failing tests for multi-subpolygon criteria**

Add imports in `tests/supervisorRoutePlanning.test.mjs`:

```js
  buildRoutePlanPreviewPayload,
  normalizeRoutePlanCustomer,
  canEditRoutePlanCustomers,
  canPublishRoutePlan,
```

Add tests:

```js
test('buildRoutePlanPreviewPayload supports multiple subpolygons and preserves filters', () => {
  assert.deepEqual(buildRoutePlanPreviewPayload({
    routeId: '10',
    dateTarget: '2026-06-03',
    polygonId: '20',
    subpolygonIds: ['101', '102', '', 'bad'],
    channelIds: ['1', '2'],
    visitDays: ['monday'],
    timeWindowId: '7',
    demandClasses: ['A', 'AA'],
  }), {
    route_id: 10,
    date_target: '2026-06-03',
    polygon_id: 20,
    subpolygon_ids: [101, 102],
    channel_ids: [1, 2],
    visit_days: ['monday'],
    time_window_id: 7,
    demand_classes: ['AA', 'A'],
  })
})

test('buildRoutePlanPreviewPayload treats no subpolygon as full polygon', () => {
  assert.deepEqual(buildRoutePlanPreviewPayload({
    routeId: 10,
    dateTarget: '2026-06-03',
    polygonId: 20,
    subpolygonIds: [],
  }).subpolygon_ids, [])
})
```

- [ ] **Step 2: Write failing tests for route plan customer normalization**

Add:

```js
test('normalizeRoutePlanCustomer preserves stop and planning metadata', () => {
  assert.deepEqual(normalizeRoutePlanCustomer({
    id: 55,
    customer_id: [55, 'Abarrotes Sol'],
    stop_id: 9001,
    street: 'Av 1',
    source: 'manual',
    subpolygon_id: [101, 'Sub A'],
    channel_ids: [[1, 'Mayoreo']],
    visit_days: ['monday'],
    time_window_id: [3, 'Tarde'],
  }), {
    id: 55,
    customer_id: 55,
    stop_id: 9001,
    name: 'Abarrotes Sol',
    address: 'Av 1',
    source: 'manual',
    subpolygon_id: 101,
    subpolygon_name: 'Sub A',
    channels: ['Mayoreo'],
    visit_days: ['monday'],
    time_window: 'Tarde',
  })
})
```

- [ ] **Step 3: Write failing tests for editability/publication states**

Add:

```js
test('canEditRoutePlanCustomers only allows draft editable plans', () => {
  assert.equal(canEditRoutePlanCustomers({ state: 'draft' }), true)
  assert.equal(canEditRoutePlanCustomers({ state: 'published' }), false)
  assert.equal(canEditRoutePlanCustomers({ state: 'in_progress' }), false)
  assert.equal(canEditRoutePlanCustomers({ state: 'draft', load_sealed: true }), false)
})

test('canPublishRoutePlan only allows draft plans with customers', () => {
  assert.equal(canPublishRoutePlan({ state: 'draft', customersCount: 1 }), true)
  assert.equal(canPublishRoutePlan({ state: 'draft', customersCount: 0 }), false)
  assert.equal(canPublishRoutePlan({ state: 'published', customersCount: 1 }), false)
})
```

- [ ] **Step 4: Run focused tests and verify they fail**

Run:

```bash
npm run test -- tests/supervisorRoutePlanning.test.mjs
```

Expected: FAIL because the new helpers are not exported.

- [ ] **Step 5: Implement helpers in `routePlanning.js`**

Add:

```js
function toNumber(value) {
  return Number(value || 0) || 0
}

export function buildRoutePlanPreviewPayload({
  routeId,
  dateTarget,
  polygonId,
  subpolygonIds,
  channelIds,
  visitDays,
  timeWindowId,
  demandClasses,
}) {
  return {
    route_id: toNumber(routeId),
    date_target: dateTarget,
    polygon_id: toNumber(polygonId),
    subpolygon_ids: toNumberList(subpolygonIds),
    channel_ids: toNumberList(channelIds),
    visit_days: Array.isArray(visitDays) ? visitDays.filter(Boolean) : [],
    time_window_id: timeWindowId ? toNumber(timeWindowId) : null,
    demand_classes: sanitizeDemandClasses(demandClasses),
  }
}

export function normalizeRoutePlanCustomer(row = {}) {
  const customerRef = row.customer_id || row.partner_id || row.id
  return {
    id: toM2oId(customerRef) || toNumber(row.id),
    customer_id: toM2oId(customerRef) || toNumber(row.customer_id || row.partner_id || row.id),
    stop_id: toNumber(row.stop_id),
    name: toM2oName(customerRef, row.name || row.customer_name || ''),
    address: row.address || row.street || row.contact_address || '',
    source: row.source || row.origin || 'suggested',
    subpolygon_id: toM2oId(row.subpolygon_id),
    subpolygon_name: toM2oName(row.subpolygon_id, row.subpolygon_name || ''),
    channels: (Array.isArray(row.channel_ids) ? row.channel_ids : [])
      .map((item) => Array.isArray(item) ? item[1] : String(item || ''))
      .filter(Boolean),
    visit_days: Array.isArray(row.visit_days) ? row.visit_days : [],
    time_window: toM2oName(row.time_window_id, row.time_window || ''),
  }
}

export function canEditRoutePlanCustomers(plan = {}) {
  const state = String(plan.state || plan.plan_state || '').toLowerCase()
  return state === 'draft' && plan.load_sealed !== true && !toM2oId(plan.load_picking_id)
}

export function canPublishRoutePlan({ state, plan_state, customersCount = 0, load_sealed, load_picking_id } = {}) {
  return canEditRoutePlanCustomers({ state: state || plan_state, load_sealed, load_picking_id })
    && Number(customersCount || 0) > 0
}
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npm run test -- tests/supervisorRoutePlanning.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/supervisor-ventas/routePlanning.js tests/supervisorRoutePlanning.test.mjs
git commit -m "feat: add route plan preview helpers"
```

---

### Task 2: Add Supervisor Route Plan API Wrappers

**Files:**
- Modify: `src/modules/supervisor-ventas/api.js`
- Test: no direct unit test unless a local API path builder pattern is introduced; verify through BFF tests and build.

- [ ] **Step 1: Add client wrappers**

In `src/modules/supervisor-ventas/api.js`, near the existing route planning wrappers, add:

```js
export function previewRoutePlanCustomers(criteria = {}) {
  return api('POST', '/pwa-supv/route-plan-preview-customers', criteria)
}

export function saveRoutePlanDraft(payload = {}) {
  return api('POST', '/pwa-supv/route-plan-save-draft', payload)
}

export function removeCustomerFromRoutePlan(routePlanId, customerOrStopId) {
  return api('POST', '/pwa-supv/route-plan-remove-customer', {
    route_plan_id: Number(routePlanId || 0),
    customer_id: Number(customerOrStopId?.customer_id || customerOrStopId || 0),
    stop_id: Number(customerOrStopId?.stop_id || 0),
  })
}

export function publishRoutePlan(routePlanId) {
  return api('POST', '/pwa-supv/route-plan-publish', {
    route_plan_id: Number(routePlanId || 0),
  })
}
```

- [ ] **Step 2: Run build to catch import/export syntax issues**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/supervisor-ventas/api.js
git commit -m "feat: add route plan publication API wrappers"
```

---

### Task 3: Add BFF Proxy Handlers

**Files:**
- Modify: `src/lib/api.js`
- Test: use existing app build and add unit coverage only if current tests expose `api()` fixtures for `/pwa-supv/*`.

- [ ] **Step 1: Add payload sanitizers near `/pwa-supv/route-plan-ensure`**

In `src/lib/api.js`, inside `directSupervisorVentas()` before new route plan handlers, add local sanitizers:

```js
const cleanNumberList = (values) => (Array.isArray(values) ? values : [])
  .map(Number)
  .filter(Boolean)

const cleanDemandClasses = (values) => {
  const allowed = ['AA', 'A', 'B', 'C']
  const seen = new Set()
  for (const raw of Array.isArray(values) ? values : []) {
    const v = String(raw || '').trim().toUpperCase()
    if (allowed.includes(v)) seen.add(v)
  }
  return allowed.filter((v) => seen.has(v))
}
```

- [ ] **Step 2: Add preview handler**

Add before `/pwa-supv/forecast-products`:

```js
if (cleanPath === '/pwa-supv/route-plan-preview-customers' && method === 'POST') {
  return odooJson('/gf/salesops/supervisor/v2/route_plan/preview_customers', {
    meta: supervisorMeta(),
    data: {
      route_id: Number(body?.route_id || 0),
      date_target: body?.date_target || undefined,
      polygon_id: Number(body?.polygon_id || 0) || undefined,
      subpolygon_ids: cleanNumberList(body?.subpolygon_ids),
      channel_ids: cleanNumberList(body?.channel_ids),
      visit_days: Array.isArray(body?.visit_days) ? body.visit_days.filter(Boolean) : [],
      time_window_id: body?.time_window_id ? Number(body.time_window_id) : null,
      demand_classes: cleanDemandClasses(body?.demand_classes),
    },
  })
}
```

- [ ] **Step 3: Add save draft handler**

Add:

```js
if (cleanPath === '/pwa-supv/route-plan-save-draft' && method === 'POST') {
  return odooJson('/gf/salesops/supervisor/v2/route_plan/save_draft', {
    meta: supervisorMeta(),
    data: {
      route_plan_id: Number(body?.route_plan_id || 0) || undefined,
      route_id: Number(body?.route_id || 0) || undefined,
      date_target: body?.date_target || undefined,
      polygon_id: Number(body?.polygon_id || 0) || undefined,
      subpolygon_ids: cleanNumberList(body?.subpolygon_ids),
      customer_ids: cleanNumberList(body?.customer_ids),
    },
  })
}
```

- [ ] **Step 4: Add remove customer handler**

Add:

```js
if (cleanPath === '/pwa-supv/route-plan-remove-customer' && method === 'POST') {
  return odooJson('/gf/salesops/supervisor/v2/route_plan/remove_customer', {
    meta: supervisorMeta(),
    data: {
      route_plan_id: Number(body?.route_plan_id || 0),
      customer_id: Number(body?.customer_id || 0) || undefined,
      stop_id: Number(body?.stop_id || 0) || undefined,
    },
  })
}
```

- [ ] **Step 5: Add publish handler**

Add:

```js
if (cleanPath === '/pwa-supv/route-plan-publish' && method === 'POST') {
  return odooJson('/gf/salesops/supervisor/v2/route_plan/publish', {
    meta: supervisorMeta(),
    data: { route_plan_id: Number(body?.route_plan_id || 0) },
  })
}
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.js
git commit -m "feat: proxy supervisor route plan publication"
```

---

### Task 4: Rework Manual Pronostico State Shape

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenPronostico.jsx`
- Test: build only in this task; behavior is verified in later tasks.

- [ ] **Step 1: Import new helpers and APIs**

Extend imports:

```js
  previewRoutePlanCustomers,
  saveRoutePlanDraft,
  removeCustomerFromRoutePlan,
  publishRoutePlan,
  searchPlanningCustomers,
  addCustomerToRoutePlan,
```

Extend `routePlanning` imports:

```js
  buildRoutePlanPreviewPayload,
  normalizeRoutePlanCustomer,
  normalizeCustomerSearchResult,
  canEditRoutePlanCustomers,
  canPublishRoutePlan,
```

- [ ] **Step 2: Add selected detail state**

Near existing manual state:

```js
const [manualView, setManualView] = useState('routes') // 'routes' | 'detail'
const [routePlanId, setRoutePlanId] = useState(null)
const [selectedSubpolygonIds, setSelectedSubpolygonIds] = useState([])
const [previewCustomers, setPreviewCustomers] = useState([])
const [previewLoading, setPreviewLoading] = useState(false)
const [customerQuery, setCustomerQuery] = useState('')
const [customerResults, setCustomerResults] = useState([])
const [customerSearching, setCustomerSearching] = useState(false)
const [customerActionLoading, setCustomerActionLoading] = useState(null)
```

Keep existing `selectedSubpolygonId` until the old single-select UI is removed in Task 5.

- [ ] **Step 3: Reset detail state when changing date**

In `handleDateTargetChange`, add:

```js
setManualView('routes')
setRoutePlanId(null)
setSelectedSubpolygonIds([])
setPreviewCustomers([])
setCustomerQuery('')
setCustomerResults([])
```

- [ ] **Step 4: Add helpers for opening/closing route detail**

Add:

```js
function handleOpenRouteDetail(route) {
  setSelectedRouteId(route.route_id)
  setRoutePlanId(route.plan_id || null)
  setPreviewCustomers([])
  setCustomerQuery('')
  setCustomerResults([])
  setManualView('detail')
}

function handleBackToRoutes() {
  setManualView('routes')
  setPreviewCustomers([])
  setCustomerQuery('')
  setCustomerResults([])
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenPronostico.jsx
git commit -m "feat: add pronostico route detail state"
```

---

### Task 5: Implement Date-First Route Cards

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenPronostico.jsx`

- [ ] **Step 1: Replace manual route card action**

In the manual mode route list area, make date remain the first visible control and make each route card open detail instead of immediately creating plan.

Use route action labels:

```js
function routePrimaryActionLabel(route) {
  if (!route.plan_id) return 'Crear propuesta'
  if (String(route.plan_state || '').toLowerCase() === 'published') return 'Ver publicado'
  return 'Revisar clientes'
}
```

- [ ] **Step 2: Gate manual form body by `manualView`**

Render:

```jsx
{manualView === 'routes' ? renderRoutesList() : renderRouteDetail()}
```

Keep the existing product forecast editor below detail only if still required for the current forecast flow. If it is not part of the new daily route plan publication path, move it below route detail as a secondary section and do not block route plan publication on product lines.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenPronostico.jsx
git commit -m "feat: make pronostico date-first route list"
```

---

### Task 6: Implement Route Detail Criteria and Customer Preview

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenPronostico.jsx`
- Modify if needed: `src/modules/supervisor-ventas/routePlanning.js`
- Test if helper changes: `tests/supervisorRoutePlanning.test.mjs`

- [ ] **Step 1: Replace single subpolygon selector with multi-select chips in route detail**

Use `selectedSubpolygonIds` and include a visible all-poligono option:

```jsx
<button
  type="button"
  aria-pressed={selectedSubpolygonIds.length === 0}
  onClick={() => setSelectedSubpolygonIds([])}
>
  Todo el poligono
</button>
```

Each subpolygon chip toggles membership.

- [ ] **Step 2: Add preview action**

Add:

```js
async function handlePreviewCustomers() {
  if (!selectedRoute) { flashMsg('Selecciona una ruta'); return }
  if (!selectedPolygonId) { flashMsg('Selecciona un poligono'); return }
  setPreviewLoading(true)
  setMsg(null)
  try {
    const payload = buildRoutePlanPreviewPayload({
      routeId: selectedRoute.route_id,
      dateTarget,
      polygonId: selectedPolygonId,
      subpolygonIds: selectedSubpolygonIds,
      channelIds: selectedChannelIds,
      visitDays: selectedVisitDays,
      timeWindowId: selectedTimeWindowId,
      demandClasses: selectedDemandClasses,
    })
    const resp = await previewRoutePlanCustomers(payload)
    if (resp?.ok === false || resp?.status === 'error') {
      flashMsg(getSupervisorRouteErrorMessage(resp), 5000)
      return
    }
    const data = resp?.data || resp || {}
    setRoutePlanId(data.route_plan_id || data.plan_id || routePlanId || null)
    setPreviewCustomers(unwrapList(data.customers || data.items || data.records || data).map(normalizeRoutePlanCustomer).filter((c) => c.id))
    await loadData()
  } catch (e) {
    logScreenError('ScreenPronostico', 'previewRoutePlanCustomers', e)
    flashMsg(getSupervisorRouteErrorMessage(e), 5000)
  } finally {
    setPreviewLoading(false)
  }
}
```

- [ ] **Step 3: Render preview customer list**

For each customer show:

- name;
- address;
- source badge (`manual`, `suggested`, `existing`);
- subpolygon label when present;
- remove button only when `canEditRoutePlanCustomers({ state: selectedRoute.plan_state, load_sealed: selectedRoute.load_sealed, load_picking_id: selectedRoute.load_picking_id })`.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenPronostico.jsx
git commit -m "feat: preview route plan customers"
```

---

### Task 7: Add Manual Customer Add/Remove in Pronostico Detail

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenPronostico.jsx`

- [ ] **Step 1: Add debounced customer search effect**

Use the same pattern from `ScreenPlanDiarioClientes.jsx`:

```js
useEffect(() => {
  const needle = customerQuery.trim()
  if (manualView !== 'detail' || needle.length < 2) {
    setCustomerResults([])
    setCustomerSearching(false)
    return undefined
  }
  setCustomerSearching(true)
  const timer = setTimeout(async () => {
    try {
      const result = await searchPlanningCustomers(needle)
      setCustomerResults(unwrapList(result).map(normalizeCustomerSearchResult).filter((customer) => customer.id))
    } catch (e) {
      logScreenError('ScreenPronostico', 'searchPlanningCustomers', e)
      setCustomerResults([])
      flashMsg(getSupervisorRouteErrorMessage(e), 5000)
    } finally {
      setCustomerSearching(false)
    }
  }, 300)
  return () => clearTimeout(timer)
}, [customerQuery, manualView])
```

- [ ] **Step 2: Add manual add handler**

```js
async function handleAddCustomer(customer) {
  if (!routePlanId) {
    flashMsg('Genera primero la propuesta de clientes')
    return
  }
  setCustomerActionLoading(`add-${customer.id}`)
  try {
    const resp = await addCustomerToRoutePlan(routePlanId, customer.id, '')
    if (resp?.ok === false || resp?.status === 'error') throw resp
    const data = resp?.data || resp || {}
    const added = normalizeRoutePlanCustomer(data.customer || { ...customer, source: 'manual' })
    setPreviewCustomers((prev) => prev.some((c) => c.id === added.id) ? prev : [...prev, added])
    setCustomerQuery('')
    setCustomerResults([])
  } catch (e) {
    logScreenError('ScreenPronostico', 'addCustomerToRoutePlan', e)
    flashMsg(getSupervisorRouteErrorMessage(e), 5000)
  } finally {
    setCustomerActionLoading(null)
  }
}
```

- [ ] **Step 3: Add remove handler**

```js
async function handleRemoveCustomer(customer) {
  if (!routePlanId) return
  setCustomerActionLoading(`remove-${customer.stop_id || customer.id}`)
  try {
    const resp = await removeCustomerFromRoutePlan(routePlanId, customer)
    if (resp?.ok === false || resp?.status === 'error') throw resp
    setPreviewCustomers((prev) => prev.filter((c) => {
      if (customer.stop_id) return c.stop_id !== customer.stop_id
      return c.id !== customer.id
    }))
  } catch (e) {
    logScreenError('ScreenPronostico', 'removeCustomerFromRoutePlan', e)
    flashMsg(getSupervisorRouteErrorMessage(e), 5000)
  } finally {
    setCustomerActionLoading(null)
  }
}
```

- [ ] **Step 4: Render search UI and add buttons**

Keep it compact:

- search input;
- loading text;
- result rows with name/address/channel chips;
- `Agregar` button per result.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenPronostico.jsx
git commit -m "feat: edit route plan customers manually"
```

---

### Task 8: Add Publish Flow and State Refresh

**Files:**
- Modify: `src/modules/supervisor-ventas/ScreenPronostico.jsx`
- Modify if needed: `src/modules/supervisor-ventas/routePlanning.js`
- Test if helper changes: `tests/supervisorRoutePlanning.test.mjs`

- [ ] **Step 1: Add publish handler**

```js
async function handlePublishRoutePlan() {
  if (!routePlanId) {
    flashMsg('Genera primero la propuesta de clientes')
    return
  }
  if (!canPublishRoutePlan({
    state: selectedRoute?.plan_state || 'draft',
    customersCount: previewCustomers.length,
    load_sealed: selectedRoute?.load_sealed,
    load_picking_id: selectedRoute?.load_picking_id,
  })) {
    flashMsg('Este plan no se puede publicar en su estado actual')
    return
  }
  setSubmitting(true)
  try {
    const resp = await publishRoutePlan(routePlanId)
    if (resp?.ok === false || resp?.status === 'error') throw resp
    flashMsg('Plan diario publicado')
    await loadData()
    setManualView('routes')
  } catch (e) {
    logScreenError('ScreenPronostico', 'publishRoutePlan', e)
    flashMsg(getSupervisorRouteErrorMessage(e), 5000)
  } finally {
    setSubmitting(false)
  }
}
```

- [ ] **Step 2: Add publish button**

Button text:

- `Publicar plan diario` when editable.
- Disabled with `Sin clientes para publicar` when `previewCustomers.length === 0`.
- Hidden or disabled in read-only states.

- [ ] **Step 3: Update state labels for `published`**

In `routePlanning.js`, update `getRoutePlanningState()` and UI `routeStateLabel()` as needed so a `gf.route.plan.state === 'published'` route card reads `Publicado` even before load starts.

Add tests if helper changes:

```js
assert.equal(getRoutePlanningState({ plan_id: 10, plan_state: 'published' }), 'published')
```

- [ ] **Step 4: Run focused tests if helper changed**

Run:

```bash
npm run test -- tests/supervisorRoutePlanning.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/supervisor-ventas/ScreenPronostico.jsx src/modules/supervisor-ventas/routePlanning.js tests/supervisorRoutePlanning.test.mjs
git commit -m "feat: publish supervisor route plans"
```

---

### Task 9: Full Verification and Cleanup

**Files:**
- Verify all changed files.
- Modify docs only if implementation changed the approved contract.

- [ ] **Step 1: Run focused route planning tests**

Run:

```bash
npm run test -- tests/supervisorRoutePlanning.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start dev server for manual browser QA**

Run:

```bash
npm run dev
```

Open the local Vite URL printed by the command.

- [ ] **Step 5: Browser QA**

In the browser:

1. Navigate to `/equipo/pronostico`.
2. Confirm date picker appears before route cards.
3. Change date and confirm route cards reload.
4. Open a route without plan and confirm detail view appears.
5. Select polygon and multiple subpolygons.
6. Generate customer proposal.
7. Confirm customer list appears.
8. Remove one customer.
9. Search and add one customer.
10. Publish the route plan.
11. Confirm route list refreshes and the card shows published.

- [ ] **Step 6: Check git status**

Run:

```bash
git status --short
```

Expected: only intended files changed, or clean if all task commits were made.

- [ ] **Step 7: Final commit if needed**

If there are verification/doc tweaks:

```bash
git add <changed-files>
git commit -m "chore: verify supervisor route plan publication"
```

---

## Notes for Implementation

- Do not change `Plan Maestro Semanal` behavior in `ScreenPronostico.jsx`.
- Do not compute polygon membership in the PWA.
- Do not delete customers from `res.partner`; remove stops/list membership only.
- Keep existing `ScreenPlanDiarioClientes.jsx` working. Its API wrappers must remain compatible.
- If an Odoo endpoint is not deployed yet, BFF should surface the functional error from Odoo instead of silently falling back to generic writes.
- If the backend returns `status: "error"`, translate through `getSupervisorRouteErrorMessage()` wherever possible.

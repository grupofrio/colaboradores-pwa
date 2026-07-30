# Ventas Iguala Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone, access-controlled PWA module where Angélica and Sugey can browse, select, total, and batch-print historical POS sales from Iguala.

**Architecture:** A new `src/modules/ventas-iguala` feature owns client access, API normalization, selection state, the responsive screen, and print documents. A custom registry policy and route guard expose it only to configured employee sessions; the backend is still the authority for personnel and the fixed Iguala scope.

**Tech Stack:** React 18, React Router v6, Vite, native Node test runner, Odoo `gf_pwa_admin`.

---

## Preconditions and repository boundary

This worktree is only the PWA. Before these changes are deployed, the Odoo owner must deploy and test the two endpoints specified in [the approved design](../specs/2026-07-30-historial-ventas-iguala-design.md):

- `GET /pwa-admin/iguala-sales-history`
- `POST /pwa-admin/iguala-sales-tickets`

They must enforce the Angélica/Sugey allowlist and permanent Iguala scope
server-side. Do not fall back to `today-sales` or individual
`sale-detail` requests.

## File structure

| File | Responsibility |
| --- | --- |
| `.env.example` | Documents the non-secret client visibility allowlist. |
| `src/modules/ventas-iguala/access.js` | Pure fail-closed session access decision. |
| `src/modules/ventas-iguala/salesHistoryApi.js` | Query serialization, normalizers, and endpoint calls. |
| `src/modules/ventas-iguala/salesHistoryState.js` | Pure cross-page selection snapshots, limit, deduplication, and total helpers. |
| `src/modules/ventas-iguala/TicketDocument.jsx` | Reusable read-only 80 mm ticket document. |
| `src/modules/ventas-iguala/ScreenVentasIguala.jsx` | Filters, table/cards, selection, errors, and print flow. |
| `src/modules/registry.js` | Registers `ventas_iguala` with its custom policy. |
| `src/lib/navModel.js` | Applies the policy to home, rail, mobile navigation, and More. |
| `src/App.jsx` | Lazy load and direct-route guard. |
| `tests/ventasIgualaAccess.test.mjs` | Access and navigation policy behavior. |
| `tests/ventasIgualaState.test.mjs` | API normalization, selection, total, and limits. |
| `tests/ventasIgualaUi.test.mjs` | Static screen, route, and print-wiring integration assertions. |

### Task 1: Define the access policy with TDD

**Files:**
- Create: `src/modules/ventas-iguala/access.js`
- Create: `tests/ventasIgualaAccess.test.mjs`

- [ ] **Step 1: Write the failing access test**

~~~js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAllowedEmployeeIds, readVentasIgualaAccess } from '../src/modules/ventas-iguala/access.js'

const session = (employee_id, extra = {}) => ({ employee_id, session_token: 'valid.token', ...extra })

test('allowlist accepts only unique positive IDs', () => {
  assert.deepEqual(parseAllowedEmployeeIds('717, 900,717,foo,0,-1'), [717, 900])
})

test('configured session enters and all other sessions fail closed', () => {
  assert.equal(readVentasIgualaAccess(session(717), [717, 900]).level, 'iguala_sales')
  assert.equal(readVentasIgualaAccess(session(901), [717, 900]).level, 'none')
  assert.equal(readVentasIgualaAccess({ employee_id: 717 }, [717, 900]).level, 'none')
})
~~~

- [ ] **Step 2: Run it to verify RED**

Run: `node --test tests/ventasIgualaAccess.test.mjs`  
Expected: FAIL because the access module does not exist.

- [ ] **Step 3: Implement the minimal fail-closed access helper**

~~~js
import { isValidAuthenticatedSession } from '../../lib/session.js'

export function parseAllowedEmployeeIds(raw = '') {
  return [...new Set(String(raw).split(',')
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0))]
}

export function readVentasIgualaAccess(session, allowedEmployeeIds = []) {
  if (!isValidAuthenticatedSession(session)) return { level: 'none', reason: 'invalid_session' }
  return allowedEmployeeIds.includes(Number(session.employee_id))
    ? { level: 'iguala_sales', reason: 'configured_employee' }
    : { level: 'none', reason: 'not_authorized' }
}
~~~

Read `VITE_IGUALA_SALES_EMPLOYEE_IDS` once and expose a no-argument wrapper.
Do not hardcode either employee ID in source.

- [ ] **Step 4: Run it to verify GREEN**

Run: `node --test tests/ventasIgualaAccess.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/modules/ventas-iguala/access.js tests/ventasIgualaAccess.test.mjs
git commit -m "feat: add Ventas Iguala access policy"
~~~

### Task 2: Register the dedicated module and route

**Files:**
- Modify: `.env.example`
- Modify: `src/modules/registry.js`
- Modify: `src/lib/navModel.js`
- Modify: `src/App.jsx`
- Modify: `tests/ventasIgualaAccess.test.mjs`

- [ ] **Step 1: Extend the failing tests**

Assert a configured session sees `ventas_iguala` through
`getVisibleModulesForSession`, an unconfigured one does not, and direct-route
source has a guard that redirects invalid sessions to `/login` and unauthorized
sessions to `/`.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/ventasIgualaAccess.test.mjs`  
Expected: FAIL because the registry and navigation model do not know
`iguala_sales`.

- [ ] **Step 3: Wire the policy through the app**

Add this module in `src/modules/registry.js`:

~~~js
{
  id: 'ventas_iguala',
  label: 'Ventas Iguala',
  shortLabel: 'Ventas',
  route: '/ventas-iguala',
  tone: 'blueSoft',
  roles: ['*'],
  accessPolicy: 'iguala_sales',
  status: 'live',
  icon: 'kpis',
  navPriority: 14,
}
~~~

In `src/lib/navModel.js`, import the no-argument helper and add an
`iguala_sales` branch to both `isModuleVisibleForSession` and
`getModuleEntryDecisionForSession`, following the M2 pattern exactly.

In `src/App.jsx`, lazy import the screen and create a `VentasIgualaRoute`
that checks `isValidAuthenticatedSession` then the access helper. Mount:

~~~jsx
<Route path="/ventas-iguala" element={
  <VentasIgualaRoute><ScreenVentasIguala /></VentasIgualaRoute>
} />
~~~

Do not use `ModuleRoleRoute`, `AdminShell`, or `/admin`. In
`.env.example`, document
`VITE_IGUALA_SALES_EMPLOYEE_IDS=717,ID_DE_SUGEY` as non-secret UX
configuration; Odoo remains authoritative.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test tests/ventasIgualaAccess.test.mjs`  
Expected: PASS; configured sessions get navigation and route access, all other
sessions fail closed.

- [ ] **Step 5: Commit**

~~~bash
git add .env.example src/modules/registry.js src/lib/navModel.js src/App.jsx tests/ventasIgualaAccess.test.mjs
git commit -m "feat: register Ventas Iguala module"
~~~

### Task 3: Build the API and selection model with TDD

**Files:**
- Create: `src/modules/ventas-iguala/salesHistoryApi.js`
- Create: `src/modules/ventas-iguala/salesHistoryState.js`
- Create: `tests/ventasIgualaState.test.mjs`

- [ ] **Step 1: Write failing contract tests**

~~~js
test('history path serializes filters without scope parameters', () => {
  assert.equal(
    buildSalesHistoryPath({
      dateFrom: '2026-07-29', dateTo: '2026-07-30', search: 'S25375', page: 2,
    }),
    '/pwa-admin/iguala-sales-history?date_from=2026-07-29&date_to=2026-07-30&search=S25375&page=2&page_size=50',
  )
})

test('selection is unique, capped, and totals selected orders', () => {
  const orders = [{ id: 1, amount_total: 12.5 }, { id: 2, amount_total: 7.5 }]
  const selected = toggleOrderSelection([{ id: 1, amount_total: 12.5 }], 2, orders)
  assert.deepEqual(selected, [{ id: 1, amount_total: 12.5 }, { id: 2, amount_total: 7.5 }])
  assert.equal(selectedAmount(selected), 20)
})
~~~

Also cover direct payload and `{ ok, data }` envelopes, invalid monetary
values, mixed-payment breakdowns, select-page behavior with rows from two
pages, rejecting 101 IDs before an API request, and a batch-ticket response
that preserves the requested `order_id` order, rejects a missing or
duplicate requested ID atomically, and discards malformed optional ticket
fields safely.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/ventasIgualaState.test.mjs`  
Expected: FAIL because the state and API modules do not exist.

- [ ] **Step 3: Implement the minimum pure modules**

`salesHistoryApi.js` must export `PAGE_SIZE = 50`,
`MAX_SELECTED_TICKETS = 100`, `buildSalesHistoryPath`,
`normalizeSalesHistory`, `normalizeSalesTickets`,
`getIgualaSalesHistory`, and
`getIgualaSalesTickets`. It sends only dates, search, page, and page size:
never company, warehouse, analytic account, or employee ID. Normalize money
only to finite numbers, optional arrays to `[]`, retain the backend
`ordered_at` ISO string, and accept a ticket only when its positive
`order_id` is one of the request IDs. Return tickets in request order, not
backend order. If the normalized ticket IDs are not exactly the requested
unique ID list, throw an `invalid_batch_ticket_contract` error and return no
tickets, so the screen cannot print a partial selection.

`salesHistoryState.js` must export `toggleOrderSelection`,
`togglePageSelection`, `selectedAmount`, and `isSelectionAtLimit`.
Store a stable snapshot per selected row containing only `id` and the
unformatted finite `amount_total`, in display order. This preserves the
accumulated total across page loads; deduplicate strictly by ID and never store
formatted amounts or a full order object.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test tests/ventasIgualaState.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/modules/ventas-iguala/salesHistoryApi.js src/modules/ventas-iguala/salesHistoryState.js tests/ventasIgualaState.test.mjs
git commit -m "feat: add Iguala sales history data model"
~~~

### Task 4: Extract the reusable print document

**Files:**
- Create: `src/modules/ventas-iguala/TicketDocument.jsx`
- Modify: `src/modules/admin/ScreenTicket.jsx`
- Create: `tests/ventasIgualaUi.test.mjs`

- [ ] **Step 1: Write failing print-wiring assertions**

Assert the ticket document has a repeatable class, an 80 mm print rule, a
page break between tickets, a batch-only print wrapper that hides the history
screen, and that `ScreenTicket` imports it rather than owning a duplicate
ticket-card body.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/ventasIgualaUi.test.mjs`  
Expected: FAIL because the shared component does not exist.

- [ ] **Step 3: Extract presentation only**

Create a `TicketDocument` that receives normalized ticket data and optional
`printId`, and renders header, folio, CDMX date/time, customer, lines,
subtotal, total, payment label, and payment breakdown. It must not fetch,
navigate, cancel, or invoke `window.print()`.

Refactor `ScreenTicket.jsx` to adapt its one-ticket payload to the component
without changing cancellation behavior. Use class-based print styles so batch
output does not repeat `id="ticket-card"`:

~~~css
@media print {
  .ventas-iguala-screen { display: none !important; }
  .gf-batch-ticket-print { display: block !important; }
  .gf-ticket-document { width: 80mm; break-after: page; }
  .gf-ticket-document:last-child { break-after: auto; }
}
~~~

Outside print media, `.gf-batch-ticket-print` defaults to
`display: none`. In the sales screen it must be a sibling of
`.ventas-iguala-screen`, not a descendant:

~~~jsx
<>
  <div className="ventas-iguala-screen">{/* interactive history */}</div>
  <div className="gf-batch-ticket-print">{/* selected TicketDocument nodes */}</div>
</>
~~~

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test tests/ventasIgualaUi.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/modules/ventas-iguala/TicketDocument.jsx src/modules/admin/ScreenTicket.jsx tests/ventasIgualaUi.test.mjs
git commit -m "refactor: share printable ticket document"
~~~

### Task 5: Implement the responsive sales screen

**Files:**
- Create: `src/modules/ventas-iguala/ScreenVentasIguala.jsx`
- Modify: `tests/ventasIgualaUi.test.mjs`

- [ ] **Step 1: Write failing screen-wiring tests**

Assert that the screen imports both Iguala API calls, the selection helpers,
and `TicketDocument`; renders labels `Desde`, `Hasta`, `Buscar cliente o
folio`, `Sucursal fija: Iguala`, and `Imprimir tickets`; and does not
import `AdminShell` or `AdminProvider`. Also assert source wiring disables
the print button while the applied filters are updating.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/ventasIgualaUi.test.mjs`  
Expected: FAIL because the screen does not exist.

- [ ] **Step 3: Implement the screen around the pure modules**

Use `useState`, `useEffect`, `useMemo`, and `useRef` to:

1. implement `cdmxDateString` and `formatCdmxDateTime` with
   `Intl.DateTimeFormat` and `timeZone: 'America/Mexico_City'`; initialize
   both dates from the former and use the latter for every displayed order time;
2. debounce only text search and clear selection/page when applied filters change;
3. sequence requests and ignore obsolete responses;
4. render desktop columns for checkbox, folio, CDMX datetime, customer,
   responsible employee, expandable lines, payment type, and total;
5. render the same information as mobile cards;
6. add explicit Anterior/Siguiente pagination from
   `pagination.page`, `pagination.page_size`, and `pagination.total`;
   changing page preserves the selected snapshots and their accumulated total,
   while changing applied filters clears both selection and page;
7. show a fixed selection bar with count, selected MXN total, page checkbox,
   100-ticket cap, and disabled/progress print action;
8. fetch selected tickets, render `TicketDocument` for each in response
   order in a sibling `.gf-batch-ticket-print` wrapper, wait for a render
   frame, then call `window.print()`;
9. preserve selection after print failure and block concurrent print requests;
   disable printing while a newer filter request is pending so stale rows cannot
   be printed;
10. render independent loading, empty, denied, invalid-contract, and retry states.

Do not provide a branch/company/warehouse selector or derive a local Iguala
filter. The endpoint is the source of scope.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test tests/ventasIgualaUi.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/modules/ventas-iguala/ScreenVentasIguala.jsx tests/ventasIgualaUi.test.mjs
git commit -m "feat: add Ventas Iguala history screen"
~~~

### Task 6: Verify the complete feature

**Files:**
- Modify: only verification fixes.

- [ ] **Step 1: Run all focused tests**

~~~bash
node --test tests/ventasIgualaAccess.test.mjs tests/ventasIgualaState.test.mjs tests/ventasIgualaUi.test.mjs
~~~

Expected: PASS with zero failures.

- [ ] **Step 2: Run the full PWA checks**

~~~bash
npm test
npm run lint
npm run build
~~~

Expected: every command exits 0.

- [ ] **Step 3: Manually verify against deployed Odoo**

Using either authorized session: confirm entry visibility, fixed Iguala label,
date range, client and folio search, CDMX time, responsible employee, order
lines, cash/credit/mixed payment rendering, cross-page exact selection total,
100-ticket cap, and two-ticket printing as two 80 mm pages with no surrounding
history UI.

Using an unauthorized session: confirm no module in navigation and no data when
calling the endpoint directly.

- [ ] **Step 4: Commit only verified fixes**

~~~bash
git status --short
git add <verified-files-only>
git commit -m "fix: verify Ventas Iguala flow"
~~~

Skip the commit when verification found no defect.

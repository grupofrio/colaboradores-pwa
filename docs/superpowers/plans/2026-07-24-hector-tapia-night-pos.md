# Hector Tapia Night POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a nominal `POS nocturno` entry for Héctor Tapia that reuses the current POS controller and defaults to `Venta Publico Iguala Noche` without granting Admin Sucursal access.

**Architecture:** A pure session-identity policy will own Héctor-specific access and plug into the existing session-aware module registry/navigation. The existing POS and ticket screens will receive a small route-flow configuration so the administrative and nocturnal routes share all sale logic while returning to their own URLs. The local default-customer resolver will select the nocturnal partner only for Héctor and fail explicitly instead of falling back to the daytime public customer.

**Tech Stack:** React 18, React Router 6, Vite 5, Node test runner, existing Odoo BFF in `src/lib/api.js`.

---

## File map

**Create**

- `src/modules/admin/nightPosAccess.js` — pure normalized identity/access policy for Héctor Tapia.
- `src/modules/admin/posFlow.js` — shared administrative/nocturnal route configuration and payment readiness helpers.
- `tests/nightPosAccess.test.mjs` — identity, module visibility, and entry-decision coverage.
- `tests/posFlow.test.mjs` — route construction and customer/payment readiness coverage.
- `tests/posScreenFlowWiring.test.mjs` — mobile/desktop screen integration with the shared route flow.
- `tests/nightPosRouting.test.mjs` — route guard and nocturnal route wiring coverage.

**Modify**

- `src/modules/registry.js` — register the nominal `pos_nocturno` module.
- `src/lib/navModel.js` — evaluate the nominal policy and hide global navigation in the nocturnal flow.
- `src/App.jsx` — add the fail-closed guard and POS/ticket routes.
- `src/lib/api.js` — choose the night customer for Héctor and throw the documented structured error when missing.
- `src/modules/admin/ScreenPOS.jsx` — consume route configuration in mobile and desktop variants.
- `src/modules/admin/forms/AdminPosForm.jsx` — use the configured ticket route and block payment without a customer.
- `src/modules/admin/ScreenTicket.jsx` — return to the configured POS route.
- `src/modules/admin/components/AdminShell.jsx` — support a standalone desktop surface with no Admin Sucursal sidebar.
- `src/modules/admin/posCustomers.js` — expose a shared positive-customer-id check.
- `tests/globalNav.test.mjs` — cover the nocturnal full-screen prefix and Héctor navigation.
- `tests/navGuards.test.mjs` — cover the specialized route guard and access-policy registry entry.
- `tests/posCustomers.test.mjs` — cover the shared valid-customer predicate.
- `tests/posAdminAuth.test.mjs` — cover daytime/nighttime default partner resolution and the missing-night-customer error.

**Do not stage**

- `.gitignore` — pre-existing user change.
- `scripts/__pycache__/` — pre-existing/untracked cache.

---

### Task 1: Add the nominal access policy and module visibility

**Files:**

- Create: `src/modules/admin/nightPosAccess.js`
- Create: `tests/nightPosAccess.test.mjs`
- Modify: `src/modules/registry.js:116-174`
- Modify: `src/lib/navModel.js:13-20,102-155`
- Modify: `tests/globalNav.test.mjs:1-55`

- [ ] **Step 1: Write the failing identity and navigation tests**

Create `tests/nightPosAccess.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { canAccessHectorNightPos } from '../src/modules/admin/nightPosAccess.js'
import {
  getHomeModulesForSession,
  getModuleEntryDecisionForSession,
} from '../src/lib/navModel.js'
import { getModuleById } from '../src/modules/registry.js'

const session = (name, extra = {}) => ({
  employee_id: 730,
  session_token: 'h.p.s',
  role: 'almacenista_entregas',
  name,
  ...extra,
})

test('recognizes Hector Tapia across accents, case, and additional names', () => {
  assert.equal(canAccessHectorNightPos(session('Héctor Tapia')), true)
  assert.equal(canAccessHectorNightPos(session('HECTOR TAPIA')), true)
  assert.equal(canAccessHectorNightPos(session('Héctor Manuel Tapia Gómez')), true)
  assert.equal(canAccessHectorNightPos(session('', {
    employee: { name: 'Hector Tapia' },
  })), true)
})

test('fails closed for partial names, other employees, and invalid sessions', () => {
  assert.equal(canAccessHectorNightPos(session('Héctor')), false)
  assert.equal(canAccessHectorNightPos(session('Héctor Pérez')), false)
  assert.equal(canAccessHectorNightPos(session('Juan Tapia')), false)
  assert.equal(canAccessHectorNightPos(session('Héctor Tapiazo')), false)
  assert.equal(canAccessHectorNightPos({ name: 'Héctor Tapia' }), false)
})

test('exposes POS nocturno only to Hector and enters it directly', () => {
  const hector = session('Héctor Tapia')
  const other = session('Héctor Pérez')
  const module = getModuleById('pos_nocturno')

  assert.ok(module)
  assert.equal(module.route, '/pos-nocturno')
  assert.equal(
    getHomeModulesForSession(hector).some((item) => item.id === 'pos_nocturno'),
    true,
  )
  assert.equal(
    getHomeModulesForSession(other).some((item) => item.id === 'pos_nocturno'),
    false,
  )
  assert.equal(getModuleEntryDecisionForSession(module, hector).type, 'direct')
  assert.equal(getModuleEntryDecisionForSession(module, other).type, 'denied')
})

test('does not grant Admin Sucursal to Hector', () => {
  const ids = getHomeModulesForSession(session('Héctor Tapia')).map((item) => item.id)
  assert.equal(ids.includes('pos_nocturno'), true)
  assert.equal(ids.includes('admin_sucursal'), false)
})
```

Also add a focused assertion to `tests/globalNav.test.mjs`:

```js
test('Hector Tapia receives POS nocturno without Admin Sucursal', () => {
  const session = {
    employee_id: 730,
    session_token: 'h.p.s',
    role: 'almacenista_entregas',
    name: 'Héctor Tapia',
  }
  const nav = ids(getNavModules(session))
  assert.equal(nav.includes('pos_nocturno'), true)
  assert.equal(nav.includes('admin_sucursal'), false)
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test tests/nightPosAccess.test.mjs tests/globalNav.test.mjs
```

Expected: FAIL because `nightPosAccess.js` and `pos_nocturno` do not exist.

- [ ] **Step 3: Implement the pure identity policy**

Create `src/modules/admin/nightPosAccess.js`:

```js
import { isValidAuthenticatedSession } from '../../lib/session.js'

function normalizeIdentity(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function identityTokens(value) {
  return normalizeIdentity(value).split(/[^a-z0-9]+/).filter(Boolean)
}

function sessionNameCandidates(session = {}) {
  return [
    session?.name,
    session?.display_name,
    session?.employee?.name,
  ].filter(Boolean)
}

export function hasHectorTapiaIdentity(session = {}) {
  return sessionNameCandidates(session).some((candidate) => {
    const tokens = identityTokens(candidate)
    return tokens.includes('hector') && tokens.includes('tapia')
  })
}

export function canAccessHectorNightPos(session = {}) {
  return isValidAuthenticatedSession(session) && hasHectorTapiaIdentity(session)
}
```

- [ ] **Step 4: Register the module and wire the access policy**

Add this registry entry immediately before `admin_sucursal`:

```js
{
  id: 'pos_nocturno',
  label: 'POS nocturno',
  shortLabel: 'POS Noche',
  route: '/pos-nocturno',
  tone: 'blueDeep',
  roles: ['hector_tapia'],
  accessPolicy: 'hectorNightPos',
  status: 'live',
  icon: 'admin',
  navPriority: 10,
  showOnHome: true,
  showInNav: true,
},
```

`roles` is documentation-only because `accessPolicy` makes
`isModuleVisibleForRoles` fail closed.

Import `canAccessHectorNightPos` into `src/lib/navModel.js` and add the policy to
both session-aware decisions:

```js
if (module.accessPolicy === 'hectorNightPos') {
  return canAccessHectorNightPos(session)
}
```

and:

```js
if (module?.accessPolicy === 'hectorNightPos') {
  return canAccessHectorNightPos(session)
    ? { type: 'direct', compatibleRoles: [], selectedRole: '' }
    : { type: 'denied', compatibleRoles: [], selectedRole: '' }
}
```

Keep the unknown-policy fallback unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/nightPosAccess.test.mjs tests/globalNav.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the access policy**

```bash
git add src/modules/admin/nightPosAccess.js src/modules/registry.js src/lib/navModel.js tests/nightPosAccess.test.mjs tests/globalNav.test.mjs
git commit -m "feat(pos): add Hector night POS access policy"
```

---

### Task 2: Make the existing POS flow route-aware and customer-safe

**Files:**

- Create: `src/modules/admin/posFlow.js`
- Create: `tests/posFlow.test.mjs`
- Create: `tests/posScreenFlowWiring.test.mjs`
- Modify: `src/modules/admin/posCustomers.js`
- Modify: `tests/posCustomers.test.mjs`
- Modify: `src/modules/admin/ScreenPOS.jsx:25-58,64-210,430-490`
- Modify: `src/modules/admin/forms/AdminPosForm.jsx:38-225,700-840`
- Modify: `src/modules/admin/ScreenTicket.jsx:9-14,135-150,260-275`
- Modify: `src/modules/admin/components/AdminShell.jsx:60-76,145-230`
- Modify: `tests/navGuards.test.mjs:210-230`

- [ ] **Step 1: Write failing tests for route configuration and payment readiness**

Create `tests/posFlow.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_POS_FLOW,
  NIGHT_POS_FLOW,
  buildPosTicketPath,
  canOpenPosPayment,
} from '../src/modules/admin/posFlow.js'

test('keeps the current admin routes as defaults', () => {
  assert.deepEqual(ADMIN_POS_FLOW, {
    backTo: '/admin',
    posRoute: '/admin/pos',
    ticketBasePath: '/admin/ticket',
    title: 'Venta mostrador',
    standalone: false,
  })
  assert.equal(buildPosTicketPath(ADMIN_POS_FLOW, 9001), '/admin/ticket/9001')
})

test('defines an isolated nocturnal flow', () => {
  assert.deepEqual(NIGHT_POS_FLOW, {
    backTo: '/',
    posRoute: '/pos-nocturno',
    ticketBasePath: '/pos-nocturno/ticket',
    title: 'POS nocturno',
    standalone: true,
  })
  assert.equal(buildPosTicketPath(NIGHT_POS_FLOW, 9001), '/pos-nocturno/ticket/9001')
})

test('requires cart lines and a positive customer id before opening payment', () => {
  assert.equal(canOpenPosPayment([], { id: 44 }), false)
  assert.equal(canOpenPosPayment([{ product_id: 1 }], { id: null }), false)
  assert.equal(canOpenPosPayment([{ product_id: 1 }], { id: 44 }), true)
})
```

Extend `tests/posCustomers.test.mjs`:

```js
test('hasValidPosCustomer accepts only positive ids', () => {
  assert.equal(hasValidPosCustomer({ id: 44 }), true)
  assert.equal(hasValidPosCustomer({ id: 0 }), false)
  assert.equal(hasValidPosCustomer({ id: null }), false)
})
```

Create `tests/posScreenFlowWiring.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mobile = readFileSync(
  new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url),
  'utf8',
)
const desktop = readFileSync(
  new URL('../src/modules/admin/forms/AdminPosForm.jsx', import.meta.url),
  'utf8',
)
const ticket = readFileSync(
  new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url),
  'utf8',
)
const shell = readFileSync(
  new URL('../src/modules/admin/components/AdminShell.jsx', import.meta.url),
  'utf8',
)

test('mobile POS consumes flow routes and validates a wrapped order id', () => {
  assert.match(mobile, /flow = ADMIN_POS_FLOW/)
  assert.match(mobile, /const data = result\?\.data \?\? result/)
  assert.match(mobile, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(mobile, /Venta creada pero sin folio/)
  assert.match(mobile, /canOpenPosPayment\(cart, customer\)/)
})

test('desktop POS consumes flow routes and blocks payment without a customer', () => {
  assert.match(desktop, /flow = ADMIN_POS_FLOW/)
  assert.match(desktop, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(desktop, /canOpenPosPayment\(cart, customer\)/)
  assert.match(desktop, /Selecciona un cliente antes de cobrar/)
})

test('ticket and desktop shell stay inside the selected flow', () => {
  assert.match(ticket, /flow = ADMIN_POS_FLOW/)
  assert.match(ticket, /navigate\(flow\.posRoute\)/)
  assert.match(shell, /hideNavigation = false/)
  assert.match(shell, /!hideNavigation &&/)
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test tests/posFlow.test.mjs tests/posCustomers.test.mjs tests/posScreenFlowWiring.test.mjs
```

Expected: FAIL because the new helpers do not exist.

- [ ] **Step 3: Implement the shared flow helpers**

Create `src/modules/admin/posFlow.js`:

```js
import { hasValidPosCustomer } from './posCustomers.js'

export const ADMIN_POS_FLOW = Object.freeze({
  backTo: '/admin',
  posRoute: '/admin/pos',
  ticketBasePath: '/admin/ticket',
  title: 'Venta mostrador',
  standalone: false,
})

export const NIGHT_POS_FLOW = Object.freeze({
  backTo: '/',
  posRoute: '/pos-nocturno',
  ticketBasePath: '/pos-nocturno/ticket',
  title: 'POS nocturno',
  standalone: true,
})

export function buildPosTicketPath(flow = ADMIN_POS_FLOW, orderId) {
  const id = Number(orderId || 0)
  if (!id) return ''
  return `${String(flow.ticketBasePath || ADMIN_POS_FLOW.ticketBasePath).replace(/\/+$/, '')}/${id}`
}

export function canOpenPosPayment(cart = [], customer = {}) {
  return Array.isArray(cart) && cart.length > 0 && hasValidPosCustomer(customer)
}
```

Add to `src/modules/admin/posCustomers.js`:

```js
export function hasValidPosCustomer(customer) {
  return Number(customer?.id || 0) > 0
}
```

Have `canRefreshCustomerPricelist` delegate to this helper.

- [ ] **Step 4: Parameterize the POS and ticket screens**

Update `ScreenPOS` to accept `flow = ADMIN_POS_FLOW`.
Call `useNavigate()` in the top-level `ScreenPOS` component so its desktop
`AdminShell` can honor `flow.backTo`; `MobilePOS` keeps its own navigator.

Pass the same `flow` to `MobilePOS` and `AdminPosForm`. Replace hardcoded
`/admin`, `/admin/ticket/:id`, and `POS Mostrador` values with:

```js
navigate(flow.backTo)
navigate(buildPosTicketPath(flow, orderId), { state: { order_id: orderId } })
flow.title
```

In the mobile sale-success branch, preserve the same defensive envelope handling
already used by the desktop form:

```js
const data = result?.data ?? result
const orderId = data?.order_id || data?.id
if (orderId) {
  navigate(buildPosTicketPath(flow, orderId), { state: { order_id: orderId } })
} else {
  setError('Venta creada pero sin folio')
}
```

Never call `navigate` with the empty string returned by
`buildPosTicketPath(flow, orderId)` for an invalid ID.

For the desktop wrapper:

```jsx
<AdminShell
  activeBlock="pos"
  title={flow.title}
  onBack={() => navigate(flow.backTo)}
  hideNavigation={flow.standalone}
  hideActivityFeed={flow.standalone}
>
  <AdminPosForm flow={flow} />
</AdminShell>
```

Update `AdminPosForm({ flow = ADMIN_POS_FLOW })` and use
`buildPosTicketPath(flow, orderId)` after a successful sale.

Update `ScreenTicket({ flow = ADMIN_POS_FLOW })`; both its back button and
`Nueva Venta` button must call `navigate(flow.posRoute)`.

- [ ] **Step 5: Block opening or confirming payment without a customer**

In both mobile and desktop forms:

```js
const canOpenPayment = canOpenPosPayment(cart, customer)
```

Use `canOpenPayment` for the cash/card buttons' `disabled`, opacity, cursor, and
click condition.

At the start of each `confirmPay`:

```js
if (!payConfirm || cart.length === 0) return
if (!hasValidPosCustomer(customer)) {
  setError('Selecciona un cliente antes de cobrar.')
  return
}
```

When `getDefaultCustomer` fails, keep `logScreenError` and also set:

```js
setError(e?.message || 'No se pudo cargar el cliente predeterminado.')
```

When an explicit customer is selected, call `setError('')` before closing the
search so a missing-default error no longer blocks the operator.

- [ ] **Step 6: Add standalone support to AdminShell**

Add `hideNavigation = false` to `AdminShell` props.

Use:

```js
const showActivityFeed = !hideNavigation && !hideActivityFeed && sw >= 1366
```

For desktop columns:

```js
gridTemplateColumns: hideNavigation
  ? 'minmax(0, 1fr)'
  : showActivityFeed
    ? '220px 1fr 320px'
    : '220px 1fr'
```

Render the left `<nav>` only when `!hideNavigation`. Keep the top bar and main
content shared. Update the existing `AdminShell` source-contract assertion in
`tests/navGuards.test.mjs` for the new conditional expression.

- [ ] **Step 7: Run focused tests and lint the touched components**

Run:

```bash
node --test tests/posFlow.test.mjs tests/posCustomers.test.mjs tests/posScreenFlowWiring.test.mjs tests/navGuards.test.mjs
npx eslint src/modules/admin/ScreenPOS.jsx src/modules/admin/forms/AdminPosForm.jsx src/modules/admin/ScreenTicket.jsx src/modules/admin/components/AdminShell.jsx src/modules/admin/posFlow.js src/modules/admin/posCustomers.js
```

Expected: PASS with zero warnings.

- [ ] **Step 8: Commit the shared POS flow**

```bash
git add src/modules/admin/posFlow.js src/modules/admin/posCustomers.js src/modules/admin/ScreenPOS.jsx src/modules/admin/forms/AdminPosForm.jsx src/modules/admin/ScreenTicket.jsx src/modules/admin/components/AdminShell.jsx tests/posFlow.test.mjs tests/posCustomers.test.mjs tests/posScreenFlowWiring.test.mjs tests/navGuards.test.mjs
git commit -m "refactor(pos): support isolated POS routes"
```

---

### Task 3: Add the fail-closed nocturnal routes

**Files:**

- Create: `tests/nightPosRouting.test.mjs`
- Modify: `src/App.jsx:1-16,198-216,480-570`
- Modify: `src/lib/navModel.js:57-95`
- Modify: `tests/globalNav.test.mjs:120-165`
- Modify: `tests/navGuards.test.mjs:1-130`

- [ ] **Step 1: Write the failing route guard tests**

Create `tests/nightPosRouting.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('NightPosRoute validates the session and Hector identity', () => {
  const start = app.indexOf('function NightPosRoute')
  const block = app.slice(start, start + 500)
  assert.ok(start >= 0)
  assert.match(block, /isValidAuthenticatedSession\(session\)/)
  assert.match(block, /canAccessHectorNightPos\(session\)/)
  assert.match(block, /Navigate to="\/login"/)
  assert.match(block, /Navigate to="\/"/)
})

test('mounts the nocturnal POS and ticket with the shared night flow', () => {
  assert.match(
    app,
    /path="\/pos-nocturno" element=\{<NightPosRoute><ScreenPOS flow=\{NIGHT_POS_FLOW\} \/><\/NightPosRoute>\}/,
  )
  assert.match(
    app,
    /path="\/pos-nocturno\/ticket\/:orderId" element=\{<NightPosRoute><ScreenTicket flow=\{NIGHT_POS_FLOW\} \/><\/NightPosRoute>\}/,
  )
})
```

Extend `tests/globalNav.test.mjs`:

```js
test('nav oculta: todo el flujo POS nocturno', () => {
  assert.equal(isNavHiddenForPath('/pos-nocturno'), true)
  assert.equal(isNavHiddenForPath('/pos-nocturno/ticket/9001'), true)
  assert.equal(isNavHiddenForPath('/pos-nocturnos'), false)
})
```

Extend `tests/navGuards.test.mjs` with source assertions for `NightPosRoute` and
the two exact route paths.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test tests/nightPosRouting.test.mjs tests/globalNav.test.mjs tests/navGuards.test.mjs
```

Expected: FAIL because the guard, routes, and hidden prefix are absent.

- [ ] **Step 3: Add the specialized guard and routes**

Import:

```js
import { canAccessHectorNightPos } from './modules/admin/nightPosAccess'
import { NIGHT_POS_FLOW } from './modules/admin/posFlow'
```

Add next to the other specialized guards:

```jsx
function NightPosRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (!canAccessHectorNightPos(session)) return <Navigate to="/" replace />
  return children
}
```

Add routes inside the authenticated `AppShell` route group and outside the
`/admin` subtree:

```jsx
<Route path="/pos-nocturno" element={<NightPosRoute><ScreenPOS flow={NIGHT_POS_FLOW} /></NightPosRoute>} />
<Route path="/pos-nocturno/ticket/:orderId" element={<NightPosRoute><ScreenTicket flow={NIGHT_POS_FLOW} /></NightPosRoute>} />
```

- [ ] **Step 4: Hide the global navigation for the complete night flow**

Add `'/pos-nocturno'` to `NAV_HIDDEN_PREFIXES` in `src/lib/navModel.js`.
Preserve exact-prefix boundary handling so `/pos-nocturnos` remains visible.

- [ ] **Step 5: Run route and navigation tests**

Run:

```bash
node --test tests/nightPosRouting.test.mjs tests/nightPosAccess.test.mjs tests/globalNav.test.mjs tests/navGuards.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit route wiring**

```bash
git add src/App.jsx src/lib/navModel.js tests/nightPosRouting.test.mjs tests/globalNav.test.mjs tests/navGuards.test.mjs
git commit -m "feat(pos): route Hector night POS"
```

---

### Task 4: Resolve the nocturnal default customer without daytime fallback

**Files:**

- Modify: `src/lib/api.js:1-60,625-635,907-915,1208-1240`
- Modify: `tests/posAdminAuth.test.mjs:1-45` and append focused tests

- [ ] **Step 1: Write the failing default-customer tests**

In `tests/posAdminAuth.test.mjs`, add a small fetch fixture that:

- returns Iguala analytic account `201` for `account.analytic.account`;
- records every `res.partner` domain;
- returns a supplied partner only when the exact `name =ilike` term matches.

Use it in these tests:

```js
test('Hector default customer is Venta Publico Iguala Noche', async () => {
  setSession({
    employee_id: 730,
    name: 'Héctor Tapia',
    role: 'almacenista_entregas',
  })
  const calls = installDefaultCustomerFixture({
    'VENTA PUBLICO IGUALA NOCHE': {
      id: 62001,
      name: 'Venta Publico Iguala Noche',
      x_analytic_un_id: [201, '[IGU] Iguala'],
      pricelist_id: [92, 'Iguala Noche'],
    },
  })

  const result = await api('GET', '/pwa-admin/default-customer?company_id=34')

  assert.equal(result.data.id, 62001)
  assert.equal(result.data.name, 'Venta Publico Iguala Noche')
  assert.equal(result.data.pricelist_id, 92)
  assert.equal(calls.some((call) => domainHasExactName(
    call.payload?.params?.domain,
    'VENTA PUBLICO IGUALA NOCHE',
  )), true)
  assert.equal(calls.some((call) => domainHasExactName(
    call.payload?.params?.domain,
    'VENTA PUBLICO IGUALA',
  )), false)
})

test('other users retain Venta Publico Iguala', async () => {
  setSession({ name: 'Angélica Jaimes', role: 'gerente_sucursal' })
  installDefaultCustomerFixture({
    'VENTA PUBLICO IGUALA': {
      id: 61000,
      name: 'VENTA PUBLICO IGUALA',
      x_analytic_un_id: [201, '[IGU] Iguala'],
    },
  })

  const result = await api('GET', '/pwa-admin/default-customer?company_id=34')
  assert.equal(result.data.id, 61000)
})

test('missing Hector night customer throws the structured error without daytime fallback', async () => {
  setSession({
    employee_id: 730,
    name: 'Héctor Tapia',
    role: 'almacenista_entregas',
  })
  const calls = installDefaultCustomerFixture({
    'VENTA PUBLICO IGUALA': {
      id: 61000,
      name: 'VENTA PUBLICO IGUALA',
    },
  })

  await assert.rejects(
    () => api('GET', '/pwa-admin/default-customer?company_id=34'),
    (error) => {
      assert.equal(error instanceof ApiError, true)
      assert.equal(error.status, 404)
      assert.equal(error.code, 'night_pos_default_customer_missing')
      assert.equal(error.message, 'No se encontró el cliente Venta Publico Iguala Noche.')
      return true
    },
  )
  assert.equal(calls.some((call) => domainHasExactName(
    call.payload?.params?.domain,
    'VENTA PUBLICO IGUALA',
  )), false)
})
```

Import `ApiError` with `api` in the test. The fixture helpers should be local to
the test file and must not change production code.

- [ ] **Step 2: Run the three focused tests and verify failure**

Run:

```bash
node --test --test-name-pattern="default customer|missing Hector night" tests/posAdminAuth.test.mjs
```

Expected: the night test resolves the daytime name or the missing-customer test
does not throw the documented error.

- [ ] **Step 3: Implement session-aware partner selection**

Import `canAccessHectorNightPos` into `src/lib/api.js`.

Add constants near the existing POS identity constants:

```js
const POS_DEFAULT_CUSTOMER_NAME = 'VENTA PUBLICO IGUALA'
const NIGHT_POS_DEFAULT_CUSTOMER_NAME = 'VENTA PUBLICO IGUALA NOCHE'
```

Refactor `getDefaultPosCustomerFromModels`:

```js
async function getDefaultPosCustomerFromModels(companyId) {
  const nightPos = canAccessHectorNightPos(getSession())
  const targetName = nightPos
    ? NIGHT_POS_DEFAULT_CUSTOMER_NAME
    : POS_DEFAULT_CUSTOMER_NAME
  const baseCompanyId = Number(companyId || 0)
  const analyticUnitIds = await resolvePosCustomerAnalyticUnitIds()
  const baseDomains = buildPosCustomerBaseDomains(baseCompanyId, analyticUnitIds)
  let partner = null

  for (const baseDomain of baseDomains) {
    const exactRows = await readPosCustomerRows(
      [...baseDomain, ['name', '=ilike', targetName]],
      1,
    )
    if (exactRows[0]) {
      partner = exactRows[0]
      break
    }
  }

  if (!partner && nightPos) {
    throw new ApiError(
      'No se encontró el cliente Venta Publico Iguala Noche.',
      { status: 404, code: 'night_pos_default_customer_missing' },
    )
  }

  // Keep the existing PUBLICO/PUBLIC/MOSTRADOR fallback only for non-night POS.
  if (!partner) {
    // existing fallback loop unchanged
  }

  return {
    ok: true,
    message: 'OK',
    data: partner ? shapePosCustomer(partner) : null,
  }
}
```

The customer-resolution task does not create a second endpoint:
`/pwa-admin/sale-create` remains the shared controller. A security follow-up
from Task 3 hardens that existing controller in the backend repository so it
authorizes Héctor from the employee resolved by the token and validates the
company/warehouse scope.

- [ ] **Step 4: Run the POS API tests**

Run:

```bash
node --test tests/posAdminAuth.test.mjs tests/adminApi.test.mjs tests/posCustomers.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the customer resolver**

```bash
git add src/lib/api.js tests/posAdminAuth.test.mjs
git commit -m "feat(pos): default Hector to night customer"
```

---

### Task 5: Verify the complete feature and regressions

**Files:**

- Modify only if verification exposes a defect in the files already listed.

- [ ] **Step 1: Run all focused POS and access tests**

Run:

```bash
node --test tests/nightPosAccess.test.mjs tests/posFlow.test.mjs tests/posScreenFlowWiring.test.mjs tests/nightPosRouting.test.mjs tests/posCustomers.test.mjs tests/posAdminAuth.test.mjs tests/adminApi.test.mjs tests/posCatalog.test.mjs tests/posCart.test.mjs tests/posPricing.test.mjs tests/globalNav.test.mjs tests/navGuards.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0 with zero warnings.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds and produces `dist/`.

- [ ] **Step 5: Run graphify after code changes**

The security review added changes to the existing controller and its tests in
an isolated `GrupoFrio` worktree. Run the repository-required graph refresh
there and confirm that generated ignored artifacts do not leave tracked
changes. Also run `py_compile` for the controller and test module; if a complete
Odoo runtime is unavailable locally, record that limitation explicitly and
leave the HttpCase suite as a CI/runtime gate.

- [ ] **Step 6: Inspect the final diff and preserve user changes**

Run:

```bash
git status --short
git diff --check HEAD~4..HEAD
git diff --stat HEAD~4..HEAD
```

Expected:

- feature commits include only the files in this plan;
- `.gitignore` remains an unstaged user modification;
- `scripts/__pycache__/` remains untracked and unstaged;
- no whitespace errors.

- [ ] **Step 7: Perform a manual browser smoke test if a dev server is available**

Check:

1. a valid Héctor Tapia session sees `POS nocturno`;
2. another employee does not see it and is redirected from direct URLs;
3. Héctor sees `Venta Publico Iguala Noche`;
4. cash and terminal buttons stay disabled until a customer is selected;
5. a successful sale opens `/pos-nocturno/ticket/:id`;
6. `Nueva Venta` returns to `/pos-nocturno`;
7. Angélica still uses `/admin/pos`, `/admin/ticket/:id`, and
   `VENTA PUBLICO IGUALA`.

- [ ] **Step 8: Commit any verification-only corrections**

If verification required code corrections, stage only those intentional files
and commit:

```bash
git add <exact-corrected-files>
git commit -m "fix(pos): complete night POS verification"
```

If no correction was needed, do not create an empty commit.

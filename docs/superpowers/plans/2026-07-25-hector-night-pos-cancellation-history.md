# Héctor Tapia Night POS Cancellation and Today-Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Héctor Tapia to see only his own sales from today and cancel an eligible sale by selecting one of four server-enforced reasons, without granting Admin Sucursal access or changing Angélica's administrative flow.

**Architecture:** Extend the existing shared Odoo controllers with an explicit Héctor policy instead of creating nocturnal endpoints. Odoo remains authoritative for identity, ownership, Mexico-day scope, state, configurable manager threshold, and reason codes; the PWA consumes `can_cancel` and `cancel_block_code`, adds a protected today-sales screen, and renders a closed reason selector only for `NIGHT_POS_FLOW`.

**Tech Stack:** Odoo HTTP/JSON controllers and `common.HttpCase`; React 18, React Router, Vite, Node test runner, ESLint; existing `gf_pwa_admin` and POS flow helpers.

---

## Repository and branch context

- PWA worktree: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/hector-night-pos`
- PWA branch: `codex/hector-night-pos`
- PWA PR: `grupofrio/colaboradores-pwa#106`, based on `main`
- Odoo worktree: `/private/tmp/grupofrio-hector-night-pos-auth`
- Odoo branch: `codex/hector-night-pos-auth`, tracking `origin/GrupoFrio`
- Design spec: `docs/superpowers/specs/2026-07-25-hector-night-pos-cancellation-history-design.md`

Do not modify the dirty PWA checkout at
`/Users/sebis/Documents/odoo/gf-pwa-colaboradores`; its `.gitignore` and
`scripts/__pycache__/` changes belong to the user.

## File map

### Odoo

- Modify `gf_pwa_admin/controllers/pwa_admin_api.py`: canonical reasons,
  nocturnal eligibility decision, strict detail/today scope, and cancellation.
- Modify `gf_pwa_admin/tests/test_pwa_admin_api.py`: HttpCases and pure helper
  coverage for identity, ownership, date, status, threshold, reasons, and
  administrative regression.

### PWA

- Modify `src/modules/admin/posFlow.js`: night history route, closed reasons,
  cancellation mode, and eligibility helpers.
- Modify `src/modules/admin/api.js`: today-sales request and reason-code payload.
- Create `src/modules/admin/nightPosSales.js`: response normalization and stable
  status/block labels.
- Create `src/modules/admin/ScreenNightPosSales.jsx`: today-only history screen.
- Modify `src/modules/admin/ScreenPOS.jsx`: history entry action in mobile and
  desktop layouts.
- Modify `src/modules/admin/ScreenTicket.jsx`: server-driven eligibility and
  closed reason selector for the night flow.
- Modify `src/App.jsx`: protected `/pos-nocturno/ventas` route.
- Modify `src/lib/navModel.js`: hide global navigation for the new full-screen
  nocturnal history route only if the existing prefix does not already cover it.
- Modify the focused POS, routing, API, and source-contract tests listed below.

---

### Task 1: Define the backend nocturnal scope and cancellation decision

**Files:**

- Modify: `/private/tmp/grupofrio-hector-night-pos-auth/gf_pwa_admin/controllers/pwa_admin_api.py:27-60,1068-1178`
- Test: `/private/tmp/grupofrio-hector-night-pos-auth/gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Add failing tests for the canonical reason and decision contract**

Add tests that exercise the real controller helpers with lightweight records
where possible and HttpCase records where ORM fields matter. Cover these exact
codes:

```python
{
    "duplicate": "Duplicidad",
    "error": "Error",
    "customer_cancelled": "Canceló",
    "out_of_stock": "Falta de stock",
}
```

The decision result must use this stable shape:

```python
{
    "can_cancel": False,
    "cancel_block_code": "not_owner",
}
```

Enumerate the block codes in tests:

```python
NIGHT_CANCEL_BLOCK_CODES = {
    "not_owner",
    "out_of_scope",
    "not_today",
    "already_cancelled",
    "closed",
    "invalid_state",
    "manager_required",
}
```

Test one eligible `sale` order and every blocking branch. Assert that an order
at exactly the configured threshold is `manager_required`.

Create independent scope cases for: wrong `x_pwa_employee_id`, disallowed
company, warehouse different from Héctor's assigned warehouse, warehouse whose
company differs from the order company, missing/mismatched employee analytic,
missing/mismatched warehouse analytic, and missing/mismatched order
`x_analytic_account_id`. Every dimension must fail closed. Add a Mexico-day
boundary case while `request.env.user.tz` is `UTC`; an order inside the current
`America/Mexico_City` day must remain eligible and an adjacent-day order must
be `not_today`.

- [ ] **Step 2: Run the focused backend test and verify RED**

Run the real focused HttpCase when an Odoo test runtime is available:

```bash
python3 odoo-bin -d <test-db> --test-enable --stop-after-init \
  -i gf_pwa_admin --test-tags /gf_pwa_admin:TestPWAAdminAPI.test_night_sale_cancel_decision
```

Expected: FAIL because the constants and decision helper do not exist.

If the local checkout lacks `odoo`, `pytz`, `odoo-bin`, or a disposable test
DB, extract the pure helper source with `ast` and run the same decision matrix
against record stubs. The RED run must demonstrate missing behavior rather
than an import failure. This fallback supports local iteration only; Task 7
still requires the real HttpCase before the feature may be declared complete
or merged.

- [ ] **Step 3: Add the canonical constants and a single decision helper**

In `GFPWAAdminAPI`, add immutable mappings/sets:

```python
_night_cancel_reason_labels = {
    "duplicate": "Duplicidad",
    "error": "Error",
    "customer_cancelled": "Canceló",
    "out_of_stock": "Falta de stock",
}

_night_cancel_block_codes = frozenset({
    "not_owner",
    "out_of_scope",
    "not_today",
    "already_cancelled",
    "closed",
    "invalid_state",
    "manager_required",
})

_night_cancel_block_messages = {
    "not_owner": "No tienes acceso a esta venta.",
    "out_of_scope": "No tienes acceso a esta venta.",
    "not_today": "No tienes acceso a esta venta.",
    "already_cancelled": "La orden ya está cancelada.",
    "closed": "La venta está cerrada y requiere reversión manual.",
    "invalid_state": "La venta no se puede cancelar en su estado actual.",
    "manager_required": "Esta venta requiere autorización de un gerente.",
}
```

Add a helper that is the only source for `can_cancel`:

```python
def _night_sale_cancel_decision(self, employee, order, today=None):
    # Exact x_pwa_employee_id ownership; legacy attribution is never enough.
    # Strict company/warehouse/analytic scope.
    # date_order must fall inside today's Mexico UTC bounds.
    # cancel -> already_cancelled; done -> closed; non-sale -> invalid_state.
    # amount_total >= configured threshold -> manager_required.
    # Otherwise return can_cancel=True and cancel_block_code=None.
```

Use `_has_hector_tapia_identity()` as the single identity predicate. Reuse
`_sales_day_utc_bounds()` and
`_employee_company_and_warehouse_in_scope(..., require_allowed_company=True)`;
do not implement a second timezone or scope algorithm.

Add `_night_cancel_block_message(code)` as the single lookup for safe mutation
errors. It must read from `_night_cancel_block_messages`, use the same generic
message for ownership/scope/date failures, and return the `invalid_state`
message for an unknown code. Keep the PWA's display-copy mapping separate; the
backend helper is authoritative for rejected mutation responses.

Add two fail-closed scope helpers:

```python
def _night_employee_sale_scope(self, employee):
    # Require Héctor identity, an assigned warehouse, a warehouse company that
    # is allowed for the employee, and matching non-empty employee/warehouse
    # analytics. Return trusted company, warehouse, analytic; otherwise False.

def _night_sale_order_scope_block_code(self, employee, order):
    # Exact x_pwa_employee_id or `not_owner`.
    # Exact trusted company + warehouse, warehouse/company consistency, and
    # exact non-empty order analytic equal to the trusted analytic, otherwise
    # `out_of_scope`. Return None only when every dimension matches.
```

The second helper is the only order-scope decision for nocturnal history
summaries, ticket detail, and cancellation. Do not reuse legacy attribution or
allow client `company_id`/`warehouse_id` to define Héctor's scope.

Keep the administrative timezone behavior unchanged by extending the shared
bounds helper compatibly:

```python
def _sales_day_utc_bounds(self, selected_date, timezone=None):
    timezone = timezone or self._sales_timezone()
    ...

def _night_sales_today(self):
    return fields.Date.context_today(
        request.env.user.with_context(tz=self._mexico_tz.zone)
    )
```

The nocturnal decision must call
`_sales_day_utc_bounds(today or _night_sales_today(), timezone=self._mexico_tz)`.
Normal admin callers continue omitting `timezone`, preserving the API user's
existing timezone behavior.

- [ ] **Step 4: Run GREEN tests and static compilation**

Rerun the exact focused HttpCase command from Step 2 and require it to pass. If
using the local AST fallback, rerun the same decision/scope/timezone matrix and
require it to pass, while keeping the real HttpCase open as the Task 7 gate.
Then run:

```bash
python3 -m py_compile \
  gf_pwa_admin/controllers/pwa_admin_api.py \
  gf_pwa_admin/tests/test_pwa_admin_api.py
git diff --check
```

Expected: focused decision tests (real or local fallback) pass and compilation
exits 0.

- [ ] **Step 5: Commit the backend decision primitive**

```bash
git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git commit -m "feat(pos): define Hector cancellation policy"
```

---

### Task 2: Enforce today-only history and ticket detail in Odoo

**Files:**

- Modify: `/private/tmp/grupofrio-hector-night-pos-auth/gf_pwa_admin/controllers/pwa_admin_api.py:1068-1285`
- Test: `/private/tmp/grupofrio-hector-night-pos-auth/gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Write failing history and detail HttpCases**

Create orders for Héctor today, Héctor yesterday, another employee today, a
legacy unattributed order, a cancelled order, and a done order. Add tests for:

```text
GET /pwa-admin/today-sales?...&night_pos=1&date=<yesterday>
GET /pwa-admin/sale-detail?order_id=<id>
```

Assert:

- `night_pos=1` rejects a non-Héctor token;
- a Héctor token always selects the strict nocturnal branch even when
  `night_pos` is omitted; supplying `night_pos=0`, an empty value, or a
  malformed value is rejected as an inconsistent request rather than falling
  back to admin behavior;
- a manipulated `date` cannot expose yesterday;
- only exact `x_pwa_employee_id = Héctor` rows from today appear;
- `sale`, `done`, and `cancel` rows remain present;
- summaries expose `can_cancel` and `cancel_block_code`;
- direct detail for another employee, yesterday, or legacy returns the same
  generic 403 envelope;
- manipulated `company_id`/`warehouse_id` cannot expand the history, and a
  mismatch is rejected instead of becoming the query scope;
- an order with wrong company, warehouse, warehouse/company pairing, employee
  analytic, warehouse analytic, or order analytic is excluded/rejected;
- with the API user timezone set to UTC, both history and detail still use the
  current `America/Mexico_City` day;
- eligible detail returns the server decision fields;
- normal admin `today-sales` date behavior remains unchanged.

- [ ] **Step 2: Run the new tests and verify RED**

Expected failures: cancelled rows are absent; manipulated dates are accepted;
detail lacks strict Héctor scope and decision fields.

- [ ] **Step 3: Extend `_sale_summary` and `_sale_detail_payload` safely**

Accept an optional decision without changing existing callers:

```python
def _sale_summary(self, order, cancel_decision=None):
    data = { ...existing fields... }
    if cancel_decision is not None:
        data.update(cancel_decision)
    return data
```

Apply the same optional enrichment to `_sale_detail_payload`.

- [ ] **Step 4: Add the identity-selected nocturnal branch to `api_today_sales`**

Resolve the token employee before choosing request behavior. The authoritative
branch selector is `_has_hector_tapia_identity(employee)`, never the
client-controlled `night_pos` flag:

- every Héctor token uses strict today-only nocturnal behavior even when the
  flag is omitted;
- if Héctor supplies `night_pos`, require its exact string value to be `"1"`;
  reject `0`, empty, booleans, or malformed values without admin fallback;
- if a non-Héctor supplies `night_pos=1`, reject access;
- only non-Héctor employees with no nocturnal flag use the existing admin
  branch and date behavior.

In the Héctor branch, derive company, warehouse, and analytic from
`_night_employee_sale_scope(employee)`. Treat client `company_id` and
`warehouse_id` only as consistency assertions: if supplied values differ from
the trusted values, reject the request. Never use those parameters to define
nocturnal scope.

Build the branch as follows:

```python
night_flag_supplied = "night_pos" in params
is_hector = self._has_hector_tapia_identity(employee)

if is_hector:
    if night_flag_supplied and params.get("night_pos") != "1":
        raise ValidationError("Solicitud nocturna inválida.")
    trusted_scope = self._night_employee_sale_scope(employee)
    if not trusted_scope:
        raise AccessError("No tienes acceso al historial nocturno.")
    company, warehouse, analytic = trusted_scope
    selected_date = self._night_sales_today()
    today_str, tomorrow_str = self._sales_day_utc_bounds(
        selected_date,
        timezone=self._mexico_tz,
    )
    domain.extend([
        ("company_id", "=", company.id),
        ("warehouse_id", "=", warehouse.id),
        ("x_analytic_account_id", "=", analytic.id),
        ("x_pwa_employee_id", "=", employee.id),
    ])
    allowed_states = ["sale", "done", "cancel"]
elif night_flag_supplied:
    raise AccessError("No tienes acceso al historial nocturno.")
else:
    # Preserve the existing administrative implementation unchanged.
```

Keep the existing employee-domain/date behavior only for non-Héctor employees
without the nocturnal flag. Do not combine the manager analytic expansion with
the exact Héctor domain. Keep the existing POS-channel exclusions. Enrich each
nocturnal summary with `_night_sale_cancel_decision()`, which must call the
single strict order-scope helper again so history, detail, and mutation cannot
drift.

- [ ] **Step 5: Harden `api_sale_detail` for Héctor**

After resolving the token employee and order:

```python
if self._has_hector_tapia_identity(employee):
    decision = self._night_sale_cancel_decision(employee, order)
    if decision["cancel_block_code"] in {"not_owner", "out_of_scope", "not_today"}:
        return _error("sale_forbidden", 403)
    payload = self._sale_detail_payload(order, cancel_decision=decision)
else:
    # Preserve existing _sale_order_in_employee_scope behavior.
```

Do not return the distinct ownership/date block code in the 403 response.

- [ ] **Step 6: Run tests, compile, and commit**

Rerun the focused history/detail HttpCases from Step 1 and require GREEN. If a
local Odoo runtime is unavailable, rerun an HTTP/controller harness covering
the same trusted-scope and Mexico-boundary matrix; this does not waive Task 7's
real HttpCase gate.

```bash
python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git diff --check
git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git commit -m "feat(pos): expose Hector today sales"
```

Expected: focused decision/history/detail tests pass in the available local
runner, compilation passes, and the real HttpCase remains mandatory at Task 7
if the local run used a harness.

---

### Task 3: Add the special Héctor cancellation branch without changing admins

**Files:**

- Modify: `/private/tmp/grupofrio-hector-night-pos-auth/gf_pwa_admin/controllers/pwa_admin_api.py:3646-3745`
- Test: `/private/tmp/grupofrio-hector-night-pos-auth/gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Write failing cancellation HttpCases**

Cover:

- four valid `reason_code` values cancel an eligible own sale and store the
  canonical label in chatter;
- empty, unknown, free-text-only, and code-plus-`reason` payloads fail (even if
  `reason_code` itself is valid); Héctor accepts `reason_code` only;
- spoofed `employee_id` cannot activate Héctor authorization;
- other employee, yesterday, legacy, `draft`, `sent`, `done`, `cancel`, and
  amount exactly at/above threshold fail without state mutation;
- an existing admin with `allow_cancel_sales` still cancels with free-text
  `reason` and retains the manager threshold behavior;
- a valid header token takes precedence over any payload `employee_id`.

- [ ] **Step 2: Run the tests and verify RED**

Expected: Héctor is rejected by the existing `allow_cancel_sales` check and
reason codes are not validated.

- [ ] **Step 3: Branch authorization after `_resolve_employee(data)`**

`_resolve_employee` already implements the required precedence: a present
header is validated without fallback; user/API-key and payload fallback apply
only when the header is absent. Preserve that helper.

Add this structure:

```python
employee = self._resolve_employee(data)
is_hector_night = (
    request.httprequest.headers.get("X-GF-Employee-Token") is not None
    and self._has_hector_tapia_identity(employee)
)

if is_hector_night:
    if "reason" in data:
        raise ValidationError("El POS nocturno solo acepta un código de cancelación.")
    reason_code = str(data.get("reason_code") or "").strip()
    reason = self._night_cancel_reason_labels.get(reason_code)
    if not reason:
        raise ValidationError("Selecciona un motivo de cancelación válido.")
    decision = self._night_sale_cancel_decision(employee, order)
    if not decision["can_cancel"]:
        raise ValidationError(self._night_cancel_block_message(decision["cancel_block_code"]))
else:
    # Preserve allow_cancel_sales + free-text reason behavior exactly.
```

Browse and validate the order before calling the decision. Re-run the decision
immediately before `action_cancel()`; the UI's earlier `can_cancel` is advisory.
The decision must use `_night_sale_order_scope_block_code()` and the explicit
Mexico timezone path from Task 1. Do not call the legacy order-scope helper in
the nocturnal branch.

- [ ] **Step 4: Keep mutation and chatter shared**

Both branches must converge on the existing:

```python
order.action_cancel()
# verify resulting state
order.message_post(...)
```

Return both `reason` (canonical label for Héctor) and `reason_code` (only when
the nocturnal branch was used). Do not duplicate stock-reversal logic.

- [ ] **Step 5: Run checks and commit**

Rerun the exact focused cancellation and administrative-regression HttpCases
from Step 1 and require GREEN. If only the local controller harness is
available, rerun the full payload/token/ownership/reason/state/threshold matrix
through that harness and retain the real HttpCases as a blocking Task 7 gate.

```bash
python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git diff --check
git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git commit -m "feat(pos): let Hector cancel own sales"
```

---

### Task 4: Define the PWA history and cancellation contracts

**Files:**

- Modify: `src/modules/admin/posFlow.js`
- Modify: `src/modules/admin/api.js`
- Create: `src/modules/admin/nightPosSales.js`
- Modify: `tests/posFlow.test.mjs`
- Modify: `tests/posAdminAuth.test.mjs`
- Create: `tests/nightPosSales.test.mjs`

- [ ] **Step 1: Write failing pure contract tests**

Assert the exact night flow contract:

```js
NIGHT_POS_FLOW.salesRoute === '/pos-nocturno/ventas'
NIGHT_POS_FLOW.allowSaleCancellation === true
NIGHT_POS_FLOW.cancellationMode === 'closed-reasons'
NIGHT_POS_FLOW.cancelReasons === [
  { code: 'duplicate', label: 'Duplicidad' },
  { code: 'error', label: 'Error' },
  { code: 'customer_cancelled', label: 'Canceló' },
  { code: 'out_of_stock', label: 'Falta de stock' },
]
```

Assert `ADMIN_POS_FLOW.cancellationMode === 'free-text'` and its route behavior
is unchanged.

Add a focused submission-helper test that passes a spy `cancelFn` and proves
the actual function used by `ScreenTicket.doCancel()` submits
`(orderId, { reasonCode })` for night mode while admin submits
`(orderId, reason.trim())`. This guards against the current early return on
`allowSaleCancellation` even if static flow assertions pass.

For `nightPosSales.js`, test normalization of `data.items`, `data.orders`, and
direct arrays; stable status labels (`sale → Activa`, `done → Cerrada`,
`cancel → Cancelada`); unknown state fallback; and block-message mappings:

```js
manager_required -> 'Esta venta requiere autorización de un gerente.'
already_cancelled -> 'Esta venta ya está cancelada.'
closed -> 'Esta venta está cerrada y requiere reversión manual.'
invalid_state -> 'Esta venta no se puede cancelar en su estado actual.'
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/posFlow.test.mjs tests/nightPosSales.test.mjs tests/posAdminAuth.test.mjs
```

Expected: missing route, reasons, normalizer, and API request behavior.

- [ ] **Step 3: Implement the flow, submission helper, and pure normalizer**

Set `NIGHT_POS_FLOW.allowSaleCancellation = true`; freeze the reason
objects/array and `NIGHT_POS_FLOW`. Keep state labels and block copy in
`nightPosSales.js`, not inside JSX.

Add a small exported `submitPosCancellation({ flow, orderId, reasonCode,
reason, cancelFn })` helper in `posFlow.js`. It must enforce the active flow,
require one closed reason for night mode, preserve trimmed free text for admin,
and call the injected `cancelFn`. `ScreenTicket.doCancel()` will use this exact
helper in Task 6, making the submission contract directly testable without
duplicating handler logic.

- [ ] **Step 4: Add API functions without breaking admin callers**

Add:

```js
export function getNightTodaySales({ warehouseId, companyId }) {
  return api('GET', `/pwa-admin/today-sales${toQuery({
    warehouse_id: warehouseId,
    company_id: companyId,
    night_pos: 1,
  })}`)
}
```

Do not send a date.

Extend cancellation compatibly:

```js
export function cancelSaleOrder(orderId, reasonOrOptions) {
  const options = typeof reasonOrOptions === 'object' ? reasonOrOptions : null
  return api('POST', '/pwa-admin/sale-cancel', {
    order_id: orderId,
    ...(options ? { reason_code: options.reasonCode } : { reason: reasonOrOptions || '' }),
  })
}
```

Tests must prove the night call contains only `order_id` and `reason_code`,
while the admin call still sends `reason`.

- [ ] **Step 5: Run GREEN tests and commit**

```bash
node --test tests/posFlow.test.mjs tests/nightPosSales.test.mjs tests/posAdminAuth.test.mjs
npx eslint src/modules/admin/posFlow.js src/modules/admin/nightPosSales.js src/modules/admin/api.js
git diff --check
git add src/modules/admin/posFlow.js src/modules/admin/nightPosSales.js src/modules/admin/api.js \
  tests/posFlow.test.mjs tests/nightPosSales.test.mjs tests/posAdminAuth.test.mjs
git commit -m "feat(pos): define Hector today-sales contract"
```

---

### Task 5: Add the protected Ventas de hoy screen

**Files:**

- Create: `src/modules/admin/ScreenNightPosSales.jsx`
- Modify: `src/modules/admin/ScreenPOS.jsx`
- Modify: `src/App.jsx`
- Modify: `src/lib/navModel.js` only if the existing `/pos-nocturno` prefix does not already cover the new path
- Create: `tests/nightPosSalesScreen.test.mjs`
- Modify: `tests/nightPosRouting.test.mjs`
- Modify: `tests/navGuards.test.mjs`
- Modify: `tests/globalNav.test.mjs` if a new nav assertion is needed

- [ ] **Step 1: Write failing route and screen tests**

Tests must require:

- `/pos-nocturno/ventas` is wrapped by `NightPosRoute`;
- no date input, `date`, `date_from`, or `date_to` is rendered/sent;
- `getNightTodaySales` receives only warehouse/company context;
- loading, empty, error, and rows are present;
- rows expose time, folio, customer, total, and stable status label;
- clicking a row builds `/pos-nocturno/ticket/:orderId` with the existing safe
  ID helper;
- both mobile and desktop POS expose `Ventas de hoy` only when
  `flow.salesRoute` exists;
- `/pos-nocturno/ventas` keeps global navigation hidden via the existing exact
  prefix boundary and `/pos-nocturnos` remains unaffected.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test tests/nightPosSalesScreen.test.mjs tests/nightPosRouting.test.mjs tests/navGuards.test.mjs tests/globalNav.test.mjs
```

- [ ] **Step 3: Implement `ScreenNightPosSales`**

Use `useSession`, `softWarehouse`, and session company ID. Fetch on mount and on
an explicit retry button only. Normalize through `nightPosSales.js`; do not
client-filter ownership or dates because the server is authoritative.

Use a simple list/card layout shared across viewport sizes. A row navigates with:

```js
navigate(buildPosTicketPath(NIGHT_POS_FLOW, sale.order_id))
```

Ignore rows with unsafe IDs.

- [ ] **Step 4: Wire the route and entry actions**

Add the route inside authenticated `AppShell`, outside `/admin`:

```jsx
<Route
  path="/pos-nocturno/ventas"
  element={<NightPosRoute><ScreenNightPosSales /></NightPosRoute>}
/>
```

In desktop `ScreenPOS`, render the history action above `AdminPosForm`; in
`MobilePOS`, render it near the page header. Both use `flow.salesRoute` so the
admin POS receives no new action.

- [ ] **Step 5: Run tests, lint, and commit**

```bash
node --test tests/nightPosSalesScreen.test.mjs tests/nightPosRouting.test.mjs tests/navGuards.test.mjs tests/globalNav.test.mjs
npx eslint src/modules/admin/ScreenNightPosSales.jsx src/modules/admin/ScreenPOS.jsx src/App.jsx src/lib/navModel.js
git diff --check
git add src/modules/admin/ScreenNightPosSales.jsx src/modules/admin/ScreenPOS.jsx src/App.jsx \
  tests/nightPosSalesScreen.test.mjs tests/nightPosRouting.test.mjs tests/navGuards.test.mjs
git commit -m "feat(pos): show Hector today sales"
```

Before committing, inspect `git status --short`. If `src/lib/navModel.js` or
`tests/globalNav.test.mjs` changed to satisfy the prefix-boundary test, stage
those exact changed files with a separate `git add`; otherwise leave them
unstaged. Do not stage unrelated or unchanged optional files.

---

### Task 6: Enable closed-reason cancellation in the nocturnal ticket

**Files:**

- Modify: `src/modules/admin/ScreenTicket.jsx`
- Modify: `src/modules/admin/posFlow.js` only if a helper is added after Task 4
- Modify: `tests/posScreenFlowWiring.test.mjs`
- Create: `tests/nightPosCancellation.test.mjs`

- [ ] **Step 1: Write failing eligibility and payload tests**

Prefer pure helpers in `posFlow.js` for behavior assertions:

```js
canCancelPosOrder(ADMIN_POS_FLOW, order, true)
canCancelPosOrder(NIGHT_POS_FLOW, { can_cancel: true }, true)
getPosCancelBlockMessage(order.cancel_block_code)
```

Test:

- night requires `order.can_cancel === true`;
- admin preserves its existing state-based rule;
- cancelled/done night orders never expose the action;
- four radio options render, textarea does not render in night mode;
- admin textarea remains;
- confirm is disabled with no selection;
- night submits `{ reasonCode }`; admin submits free text;
- the real `submitPosCancellation` helper used by `doCancel()` does not return
  early for `NIGHT_POS_FLOW` and invokes the API spy exactly once;
- reloaded cancelled detail hides the action and shows `Cancelada`;
- `manager_required` displays the manager message without a cancel button.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test tests/nightPosCancellation.test.mjs tests/posScreenFlowWiring.test.mjs tests/posFlow.test.mjs
```

- [ ] **Step 3: Implement server-driven eligibility**

Replace the current night-agnostic `canCancel` expression with a helper that
preserves admin behavior but requires backend authorization for closed reasons:

```js
const canCancel = canCancelPosOrder(flow, order, BACKEND_CAPS.saleCancel)
```

Never compare `$5,000` or `amount_total` in the PWA.

- [ ] **Step 4: Render the closed reason selector**

When `flow.cancellationMode === 'closed-reasons'`, render accessible radio
buttons from `flow.cancelReasons`; keep `cancelReasonCode` state separate from
the existing admin `cancelReason` text.

Submit:

```js
await submitPosCancellation({
  flow,
  orderId,
  reasonCode: cancelReasonCode,
  reason: cancelReason,
  cancelFn: cancelSaleOrder,
})
```

The helper preserves the existing admin call
`cancelSaleOrder(orderId, cancelReason.trim())`. Remove the old independent
early-return condition from `doCancel()` or make it delegate only to the helper;
there must be one active-flow guard, not two guards that can drift.

Reset reason state after success/close and keep the current reload/error flow.

- [ ] **Step 5: Run GREEN tests, lint, and commit**

```bash
node --test tests/nightPosCancellation.test.mjs tests/posScreenFlowWiring.test.mjs tests/posFlow.test.mjs tests/posAdminAuth.test.mjs
npx eslint src/modules/admin/ScreenTicket.jsx src/modules/admin/posFlow.js
git diff --check
git add src/modules/admin/ScreenTicket.jsx src/modules/admin/posFlow.js \
  tests/nightPosCancellation.test.mjs tests/posScreenFlowWiring.test.mjs tests/posFlow.test.mjs
git commit -m "feat(pos): let Hector cancel eligible sales"
```

---

### Task 7: Verify the complete feature and prepare publication

**Files:**

- Modify only if verification exposes a defect in files already listed.

- [ ] **Step 1: Run all focused PWA tests**

```bash
node --test \
  tests/nightPosAccess.test.mjs \
  tests/nightPosRouting.test.mjs \
  tests/nightPosSales.test.mjs \
  tests/nightPosSalesScreen.test.mjs \
  tests/nightPosCancellation.test.mjs \
  tests/posFlow.test.mjs \
  tests/posScreenFlowWiring.test.mjs \
  tests/posCustomers.test.mjs \
  tests/posAdminAuth.test.mjs \
  tests/adminApi.test.mjs \
  tests/globalNav.test.mjs \
  tests/navGuards.test.mjs \
  tests/koldOsAccessPolicy.test.mjs
```

Expected: zero failures.

- [ ] **Step 2: Run complete PWA gates**

```bash
npm test
npm run lint
npm run build
git diff --check origin/main..HEAD
git status --short --branch
```

Expected: all Node tests pass, zero lint warnings, Vite and M3/M4/M7 leak
checks pass, no whitespace errors, clean worktree.

- [ ] **Step 3: Run backend gates**

Run the real Odoo HttpCases for the decision, strict scope, Mexico-day
boundaries, today history, direct detail, nocturnal cancellation, token
precedence, closed reasons, and existing administrative cancellation
regression. Use a disposable database/runtime with the repository's supported
Odoo command, for example:

```bash
python3 odoo-bin -d <test-db> --test-enable --stop-after-init \
  -i gf_pwa_admin --test-tags /gf_pwa_admin:TestPWAAdminAPI
```

The exact test class may be narrowed while iterating, but the full affected
class must be GREEN here. An AST harness, `py_compile`, skipped tests caused by
missing required fixture fields, or a pending CI job does **not** satisfy this
final gate. If no real Odoo test runtime is available, stop publication and
report the feature as blocked on this gate; do not declare completion and do
not merge.

After the real suite passes, run the static checks:

```bash
python3 -m py_compile \
  gf_pwa_admin/controllers/pwa_admin_api.py \
  gf_pwa_admin/tests/test_pwa_admin_api.py
git diff --check origin/GrupoFrio..HEAD
git status --short --branch
```

Record the command, database/runtime, and passing result for the handoff. Do
not report HttpCases as passing when only `py_compile` or an AST harness ran.

- [ ] **Step 4: Refresh the required backend graph**

From the Odoo worktree, follow its `AGENTS.md` and run:

```bash
./.graphify-env/bin/graphify update
```

If HTML rendering exceeds the node limit, record that exact limitation and
confirm the graph processed controller/tests without leaving tracked generated
files.

- [ ] **Step 5: Review diffs and preserve user changes**

Confirm:

- PWA diff contains only the approved spec/plan and POS feature files;
- backend diff contains only controller/tests;
- the main PWA checkout still has the user's `.gitignore` and
  `scripts/__pycache__/` changes untouched;
- no production deployment or merge occurs without explicit user direction.

- [ ] **Step 6: Request final code review**

Use `superpowers:requesting-code-review` with both repository ranges. Resolve
all blocking findings through the same TDD cycle, then rerun the relevant gates.

- [ ] **Step 7: Publish only after explicit authorization**

When requested, push backend to the intended Odoo branch and update PWA PR
`#106`. Verify the remote SHAs, mergeability, and CI/Vercel status after push.
Do not merge until the real backend HttpCase gate above and all PWA gates are
green.

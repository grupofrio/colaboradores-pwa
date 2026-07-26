# Assignable Day POS Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an assignable `pos_diurno` employee permission that provides a standalone day POS with ticket printing, own-today sales history, and closed-reason cancellation without granting Admin Sucursal.

**Architecture:** Odoo remains authoritative: the employee token resolves the employee, the new primary/additional role selects a restricted POS policy, and shared scope helpers enforce owner, Mexico day, company, warehouse, analytic, state, and threshold. The PWA adds a `DAY_POS_FLOW`, transports the allowlisted `pos_scope=day` intent through its proxy, reuses the existing POS/ticket components, and extracts the nocturnal sales list into a flow-driven restricted-sales screen.

**Tech Stack:** Odoo 18/Python/PostgreSQL, React 19, React Router, Node test runner, Vite, ESLint.

---

## Worktrees and source documents

- PWA: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/day-pos-role`
- Odoo: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend`
- Approved spec: `docs/superpowers/specs/2026-07-26-assignable-day-pos-role-design.md`

Use `@superpowers:test-driven-development` for every behavior change. Do not edit
the dirty primary checkouts. Keep backend and PWA commits separate because they
belong to different repositories.

## File map

### Odoo

- `os_customer_zones/models/pwa_job_key.py`: canonical primary/additional role resolution.
- `os_customer_zones/models/models_hr.py`: `hr.employee` checkbox.
- `os_customer_zones/views/views_hr.xml`: employee-form assignment control.
- `os_customer_zones/tests/test_pwa_job_key.py`: dependency-free role resolver tests.
- `os_api/tests/test_employee_signin_security.py`: login payload contract.
- `gf_pwa_admin/controllers/pwa_admin_api.py`: POS policy selection, scoped reads, creation, and cancellation.
- `gf_pwa_admin/tests/test_pwa_admin_api.py`: HTTP and helper policy coverage.
- `gf_pwa_admin/tests/test_pwa_admin_cancel_concurrency.py`: committed-transaction cancellation race coverage.
- `os_customer_zones/__manifest__.py` and `gf_pwa_admin/__manifest__.py`: upgrade versions.

### PWA

- `src/modules/admin/posFlow.js`: `DAY_POS_FLOW`, shared reasons, and strict intent propagation.
- `src/modules/admin/api.js`: day history/detail/cancel/default-customer wrappers.
- `src/lib/api.js`: proxy allowlist and exact day-customer resolution.
- `src/modules/admin/ScreenRestrictedPosSales.jsx`: reusable own-today sales presentation.
- `src/modules/admin/ScreenNightPosSales.jsx`: compatibility wrapper for Héctor.
- `src/modules/admin/ScreenDayPosSales.jsx`: day-flow wrapper.
- `src/modules/admin/nightPosSales.js`: shared normalization aliases without breaking current imports.
- `src/modules/admin/ScreenPOS.jsx`: mobile day customer and creation intent.
- `src/modules/admin/forms/AdminPosForm.jsx`: desktop day customer and creation intent.
- `src/modules/admin/ScreenTicket.jsx`: flow-aware detail and cancellation requests.
- `src/modules/registry.js`: `pos_diurno` module metadata.
- `src/App.jsx`: guarded day routes.
- `src/lib/navModel.js`: hide operational day POS subroutes from global navigation.
- `tests/dayPosRole.test.mjs`: card/nav/role visibility.
- `tests/dayPosApi.test.mjs`: wrapper/proxy/default customer contract.
- `tests/dayPosRouting.test.mjs`: direct-route guards and flow wiring.
- `tests/dayPosSalesScreen.test.mjs`: reusable history screen behavior.
- `tests/dayPosCancellation.test.mjs`: ticket intent and reason payload.
- Existing POS/night/nav tests: regression coverage.

### Task 0: Prepare and characterize the isolated test runtime

**Files:**
- None.

- [ ] **Step 1: Start the disposable PostgreSQL cluster**

Check it without changing production state:

```bash
/Library/PostgreSQL/17/bin/pg_ctl -D /private/tmp/pg-hector-test status
```

If it is stopped, run:

```bash
/Library/PostgreSQL/17/bin/pg_ctl \
  -D /private/tmp/pg-hector-test \
  -l /private/tmp/pg-day-pos-test.log start
```

- [ ] **Step 2: Create a feature-only database**

```bash
/Library/PostgreSQL/17/bin/createdb \
  -h /private/tmp/pg-hector-socket \
  -p 55437 \
  -U sebis \
  gf_day_pos_test_20260726
```

Expected: a new disposable database. If it already exists from this plan, reuse
it; never substitute a production/shared database.

- [ ] **Step 3: Install the unchanged baseline and run representative POS tests**

```bash
/private/tmp/odoo18-hector-venv/bin/python -B \
  /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 \
  --db_host=/private/tmp/pg-hector-socket \
  --db_port=55437 \
  --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all \
  --http-port=18069 \
  --gevent-port=18072 \
  --test-enable \
  --stop-after-init \
  -i gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_night_cancel_contract_is_exact_immutable_and_safe,/gf_pwa_admin:TestPWAAdminAPI.test_pos_sale_create_access_accepts_each_admin_role_source' \
  --log-level=test \
  --logfile=/private/tmp/day-pos-baseline.log
```

Expected: both representative baseline tests pass before feature code changes.

- [ ] **Step 4: Reconfirm the PWA and pure-role baselines**

```bash
cd /Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/day-pos-role
npm test
cd /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend
python3 os_customer_zones/tests/test_pwa_job_key.py
```

Expected: 1,761 PWA tests and 13 pure role tests pass.

### Task 1: Add the canonical assignable Odoo role

**Files:**
- Modify: `os_customer_zones/models/pwa_job_key.py`
- Modify: `os_customer_zones/models/models_hr.py`
- Modify: `os_customer_zones/views/views_hr.xml`
- Modify: `os_customer_zones/tests/test_pwa_job_key.py`
- Modify: `os_api/tests/test_employee_signin_security.py`
- Modify: `os_customer_zones/__manifest__.py`

- [ ] **Step 1: Write all failing role and login tests first**

Import `PWA_ADDITIONAL_ROLE_SPECS` and add assertions equivalent to:

```python
def test_pos_diurno_is_a_canonical_additional_role(self):
    self.assertIn(
        ("pwa_extra_pos_diurno", "pos_diurno"),
        PWA_ADDITIONAL_ROLE_SPECS,
    )
    employee = _DummyEmployee(pwa_extra_pos_diurno=True)
    self.assertEqual(
        resolve_employee_pwa_additional_job_keys(employee),
        ["pos_diurno"],
    )

def test_pos_diurno_is_not_duplicated_when_primary(self):
    employee = _DummyEmployee(
        job_id=_DummyJob("pos_diurno"),
        pwa_extra_pos_diurno=True,
    )
    self.assertEqual(resolve_employee_pwa_additional_job_keys(employee), [])
```

In `TestEmployeeSignInSecurity`, add one test for a primary
`hr.job.x_job_key="pos_diurno"` and one for
`pwa_extra_pos_diurno=True`. Sign in through the existing controller and assert:

```python
self.assertEqual(primary_result["status"], 200)
self.assertEqual(primary_result["employee"]["pwa_job_key"], "pos_diurno")
self.assertEqual(primary_result["employee"]["role"], "pos_diurno")
self.assertEqual(primary_result["employee"]["additional_job_keys"], [])

self.assertEqual(additional_result["status"], 200)
self.assertIn("pos_diurno", additional_result["employee"]["additional_job_keys"])
self.assertIn("pos_diurno", additional_result["employee"]["additional_roles"])
```

- [ ] **Step 2: Run the pure tests and verify RED**

Run:

```bash
cd /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend
python3 os_customer_zones/tests/test_pwa_job_key.py
```

Expected: FAIL because `pwa_extra_pos_diurno` is not in the canonical specs.

Run the exact Odoo RED test as well:

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u os_customer_zones,os_api \
  --test-tags='/os_api:TestEmployeeSignInSecurity.test_employee_sign_in_publishes_primary_pos_diurno_role,/os_api:TestEmployeeSignInSecurity.test_employee_sign_in_publishes_additional_pos_diurno_role' \
  --log-level=test --logfile=/private/tmp/day-pos-role-red.log
```

Expected: FAIL because the new field/role does not exist.

- [ ] **Step 3: Implement the role catalog, field, and view**

Add exactly this role pair to `PWA_ADDITIONAL_ROLE_SPECS`:

```python
("pwa_extra_pos_diurno", "pos_diurno"),
```

Add the employee field and expose it under `Puestos adicionales`:

```python
pwa_extra_pos_diurno = fields.Boolean(string="POS diurno", default=False)
```

```xml
<field name="pwa_extra_pos_diurno"/>
```

Bump `os_customer_zones` from `18.0.2.2.2` to `18.0.2.2.3`.

- [ ] **Step 4: Run both role test layers and verify GREEN**

Run `python3 os_customer_zones/tests/test_pwa_job_key.py`, then rerun the exact
Odoo command from Step 2. Expected: pure tests and both login methods pass. Do
not add name matching or special Ruth data.

- [ ] **Step 5: Commit the Odoo role change**

```bash
git add os_customer_zones os_api/tests/test_employee_signin_security.py
git commit -m "feat(pos): add assignable day POS role"
```

### Task 2: Lock the authoritative POS policy matrix

**Files:**
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Write failing helper tests for every policy row**

Add table-driven tests for:

```python
cases = (
    # day, admin, hector, pos_scope, night_supplied, night_value, expected
    (True,  False, False, "day", False, None, "day"),
    (True,  False, False, None,  False, None, "day"),
    (False, True,  False, "day", False, None, "forbidden"),
    (True,  True,  False, "day", False, None, "day"),
    (True,  True,  False, None,  False, None, "admin"),
    (False, True,  False, None,  False, None, "admin"),
    (False, False, True, None,   False, None, "night"),
    (False, False, True, "day", False, None, "forbidden"),
    (True,  False, True, "day", False, None, "day"),
    (True,  False, True, None,  False, None, "night"),
)
```

Also assert that unknown/non-scalar `pos_scope`, `night_pos != "1"`, and
`pos_scope` combined with any supplied `night_pos` raise `AccessError`. Payload
employee IDs or names must not affect the result.

Extend the table with explicit HTTP/helper rows for:

- Héctor with `night_pos=1` → night;
- day-only, admin-only, and unrelated users with `night_pos=1` → forbidden;
- admin+Héctor with omitted or `night_pos=1` → night;
- admin+Héctor with `day` but no day role → forbidden;
- admin+day+Héctor with `day` → day;
- admin+day+Héctor with omitted or `night_pos=1` → night;
- any of those identities with both supplied intents → forbidden;
- sale-create with omitted, `day`, `night_pos=1`, malformed, and conflicting
  body values using the same precedence.

- [ ] **Step 2: Run the focused policy tests and verify RED**

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_policy_selector_matrix' \
  --log-level=test --logfile=/private/tmp/day-pos-policy-red.log
```

Expected: FAIL with the missing selector/role behavior.

- [ ] **Step 3: Implement small, testable policy helpers**

Add immutable constants and helpers with this behavior:

```python
_POS_SCOPE_DAY = "day"
_POS_POLICY_ADMIN = "admin"
_POS_POLICY_DAY = "day"
_POS_POLICY_NIGHT = "night"

def _has_day_pos_role(self, employee):
    keys = {self._employee_primary_job_key(employee)}
    keys.update(self._employee_additional_job_keys(employee))
    return "pos_diurno" in {str(key or "").strip().lower() for key in keys}
```

Implement `_select_pos_policy(...)` so that:

1. conflicting day/night intent raises `AccessError`;
2. supplied `pos_scope` must be the scalar string `day`;
3. `day` requires the authoritative role;
4. Héctor defaults to night when day was not selected;
5. a day-only employee defaults to restricted day even when intent is omitted;
6. a day+admin employee without intent keeps admin behavior;
7. no invalid value can fall through to admin.

Reuse `get_pwa_additional_job_keys()`; do not trust session JSON or payload role.
Keep `_has_hector_tapia_identity()` intact for backward compatibility.

- [ ] **Step 4: Run the focused policy tests and verify GREEN**

Rerun the exact command from Step 2, then run:

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_night_today_sales_uses_authoritative_identity_and_strict_flag,/gf_pwa_admin:TestPWAAdminAPI.test_pos_sale_create_access_accepts_each_admin_role_source' \
  --log-level=test --logfile=/private/tmp/day-pos-policy-regression.log
```

Expected: every matrix row and the Hector/admin characterization tests pass.

- [ ] **Step 5: Commit the backend policy selector**

```bash
git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git commit -m "feat(pos): select restricted day POS policy"
```

### Task 3: Authorize day POS operations and persist trusted analytic scope

**Files:**
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_api.py`
- Modify: `gf_pwa_admin/__manifest__.py`

- [ ] **Step 1: Write failing operational-read and sale-create tests**

Cover primary `x_job_key=pos_diurno`, additional
`pwa_extra_pos_diurno=True`, a same-name employee without the role, a role
revoked after token creation, payload identity spoofing, cross-company,
cross-warehouse, and missing/mismatched analytic scope. Include admin+day with
`pos_scope=day` (restricted) and with omitted scope (existing admin behavior).

For `/pos-products`, `/customers`, and `/default-customer`, assert a day token
derives company, warehouse, and analytic context from the live employee record;
client-supplied company/warehouse mismatches fail. Characterize that the valid
catalog returns the scoped stock and current pricelist price, and customer search
returns only active customers from the trusted company/shared domain.

For the day default customer, create exact case-insensitive, inactive, other-
company, zero-match, and two-eligible-match fixtures. Assert exactly one active
eligible `VENTA PUBLICO IGUALA` succeeds; zero returns
`day_pos_default_customer_missing`, two return
`day_pos_default_customer_ambiguous`, and no fallback name is selected.

After creating a valid mobile session, revoke `pwa_extra_pos_diurno` and assert
catalog, customers, default customer, and sale-create all fail immediately even
though the client token/session is unchanged.

For a valid sale-create request, assert:

```python
self.assertEqual(order.x_pwa_employee_id, day_employee)
self.assertEqual(order.company_id, day_company)
self.assertEqual(order.warehouse_id, day_warehouse)
self.assertEqual(order.x_analytic_account_id, day_employee.x_analytic_account_id)
```

- [ ] **Step 2: Run the operational endpoint tests and verify RED**

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_catalog_customers_and_default_customer_are_live_scoped,/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_sale_create_persists_trusted_identity_and_analytic,/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_operational_endpoints_revoke_immediately' \
  --log-level=test --logfile=/private/tmp/day-pos-operations-red.log
```

Expected: day intent is not authorized, default-customer ambiguity is not
detected, and analytic attribution is missing.

- [ ] **Step 3: Implement minimal create authorization and attribution**

Add `pos_diurno`/`pwa_extra_pos_diurno` to the existing create-role sources.
Run the request through `_select_pos_policy()` using the optional JSON
`pos_scope`, so mixed admin+day roles follow the approved precedence and an
unknown scope cannot be ignored. Parse supplied/value `night_pos` as well so a
day/night conflict is rejected instead of discarded.
Make strict scope resolution accept a `require_restricted_analytic` flag and
return the trusted analytic record. Enable that flag only for the selected day
policy; preserve the current admin and Hector creation behavior. Write the
analytic only for the day policy:

```python
trusted_analytic = self._require_pos_sale_create_scope(
    employee,
    company,
    warehouse,
    require_restricted_analytic=(selected_policy == _POS_POLICY_DAY),
)
if selected_policy == _POS_POLICY_DAY and "x_analytic_account_id" not in sale_fields:
    raise AccessError("No se pudo establecer el alcance analítico del POS diurno.")
if selected_policy == _POS_POLICY_DAY:
    order_vals["x_analytic_account_id"] = trusted_analytic.id
```

Require the strict analytic only for `_POS_POLICY_DAY`; fail closed if the day
employee, warehouse, and stock-location analytic are not all present and
identical. Add characterization tests before this change proving that night
creation stays byte-compatible, then preserve the current admin and Hector
behavior.

- [ ] **Step 4: Route day catalog/customer reads through live Odoo authority**

For `pos_scope=day`, make `/pos-products`, `/customers`, and
`/default-customer` resolve the employee from `X-GF-Employee-Token`, select the
day policy, and derive trusted company/warehouse/analytic context. The day
default-customer search must use `limit=2`, detect ambiguity, and never fall back.
Keep omitted-scope admin behavior unchanged.

Bump `gf_pwa_admin` from `18.0.2.1.8` to `18.0.2.1.9`.

- [ ] **Step 5: Run operational endpoint tests and verify GREEN**

Rerun the exact command from Step 2. Expected: both role sources load scoped
catalog/prices/customers and create attributed orders; ambiguity, revocation,
spoofing, and scope mismatches fail. Also rerun the existing Hector/admin create
tests named in Task 2 Step 4 to prove no analytic-policy regression.

- [ ] **Step 6: Commit operational POS authorization**

```bash
git add gf_pwa_admin
git commit -m "feat(pos): authorize day POS in trusted employee scope"
```

### Task 4: Generalize own-today history and ticket detail

**Files:**
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Write failing history and detail tests**

Create two day employees in the same branch plus orders for the exact first
instant of today in Mexico, yesterday, the exact first instant of the next
Mexico day, other employee, other company, other warehouse,
other analytic, KoldHome, website, `sale`, `done`, and `cancel`.

Assert `/today-sales?pos_scope=day` returns only the authenticated employee's
current Mexico-day `sale/done/cancel` rows. Assert supplied date/company/
warehouse/employee parameters cannot widen the domain. Assert omitted intent for
a day-only role stays restricted and revoked role fails immediately.

For `/sale-detail?order_id=...&pos_scope=day`, assert own-today rows return the
shared cancellation decision and every hidden target returns the same generic
403 without revealing existence. Revoke the role while keeping the same token
and assert both history and detail fail immediately.

- [ ] **Step 2: Run the new read tests and verify RED**

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_today_sales_forces_owner_and_mexico_day,/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_sale_detail_is_owner_today_only_and_revokes_live,/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_create_history_detail_round_trip' \
  --log-level=test --logfile=/private/tmp/day-pos-reads-red.log
```

Expected: day employees currently enter the admin branch or receive admin-shaped
detail.

- [ ] **Step 3: Extract shared restricted-POS scope helpers**

Generalize the existing nocturnal helpers around a policy argument while
keeping compatibility wrappers used by Hector tests:

```python
def _restricted_pos_employee_sale_scope(self, employee, policy): ...
def _restricted_pos_sales_context(self, employee, policy, today=None): ...
def _restricted_pos_sale_visibility_domain(self, employee, context): ...
def _restricted_pos_sale_cancel_decision(self, employee, order, context): ...
```

The visibility domain must include all of:

```python
[
    ("company_id", "=", context["company"].id),
    ("warehouse_id", "=", context["warehouse"].id),
    ("x_analytic_account_id", "=", context["analytic"].id),
    ("x_pwa_employee_id", "=", context["employee_id"]),
    ("date_order", ">=", context["utc_start_string"]),
    ("date_order", "<", context["utc_end_string"]),
    ("state", "in", ["sale", "done", "cancel"]),
    ("x_studio_canal_origen", "not in", ["pwa_koldhome"]),
    ("website_id", "=", False),
]
```

Use `America/Mexico_City`, not the API user's timezone. Missing threshold keeps
the existing `$5,000` default; invalid configured values produce
`manager_required`.

- [ ] **Step 4: Wire `today-sales` and `sale-detail` through the selector**

Parse `pos_scope` without coercion. Restricted policies ignore arbitrary date
range input and derive company/warehouse/analytic from the employee. Admin keeps
its current date/filter contract. Preserve `night_pos=1` and reject day/night
conflicts.

- [ ] **Step 5: Add the creation → history → detail integration assertion**

Create through `/sale-create`, then call day history and detail with the same
token. Assert the new order appears without backfill and its
`x_analytic_account_id` is the trusted analytic.

- [ ] **Step 6: Run read tests and Hector/admin regressions**

Rerun the exact command from Step 2, then run the existing Hector history/detail
methods with:

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_night_today_sales_is_today_only_exact_owner_and_includes_all_terminal_states,/gf_pwa_admin:TestPWAAdminAPI.test_night_sale_detail_allows_own_today_states_with_cancel_decision' \
  --log-level=test --logfile=/private/tmp/day-pos-reads-regression.log
```

Expected: all day, night, and admin history/detail tests pass.

- [ ] **Step 7: Commit scoped reads**

```bash
git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git commit -m "feat(pos): expose own day sales and tickets"
```

### Task 5: Extend closed-reason cancellation and concurrency protection

**Files:**
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_api.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_cancel_concurrency.py`

- [ ] **Step 1: Write failing day cancellation tests**

For each canonical code, cancel an own-today order below the threshold,
including exactly `$4,999.99`, and
assert the canonical Spanish label and authenticated employee are posted. Reject
free text, invalid/accessor-like values, other employee, legacy unattributed,
yesterday, future boundary, other scope, `draft`, `done`, already cancelled,
exactly `$5,000`, and invalid threshold configuration.

Add policy-matrix requests:

- day-only with valid, omitted, and malformed intent;
- no role with `pos_scope=day`;
- admin+day with and without `pos_scope=day`;
- Héctor with/without day role;
- day plus nocturnal intent conflict;
- payload `employee_id`/name spoofing without a valid mobile token.

After a successful detail decision, revoke `pwa_extra_pos_diurno` without
renewing the token and assert cancellation is rejected before lock, mutation, or
chatter.

- [ ] **Step 2: Run cancellation tests and verify RED**

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_sale_cancel_accepts_canonical_reasons,/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_sale_cancel_rejects_every_scope_and_state_violation,/gf_pwa_admin:TestPWAAdminAPI.test_day_pos_sale_cancel_policy_matrix_and_live_revocation' \
  --log-level=test --logfile=/private/tmp/day-pos-cancel-red.log
```

Expected: day requests use or attempt the admin free-text branch.

- [ ] **Step 3: Reuse the restricted cancellation transaction**

Replace the binary `is_night_cancel` decision with a restricted policy value.
For day and night, require `reason_code`, reject `reason`, use the same immutable
allowlist, pre-authorize through the restricted domain, lock the authorized row,
invalidate employee/order scope inputs, rebuild context, re-search, re-run
`can_cancel`, cancel, verify final state, and post escaped chatter.

Keep the administrative free-text branch byte-for-byte equivalent except for
the surrounding selector.

- [ ] **Step 4: Add committed-transaction day concurrency coverage**

Generalize the concurrency fixture so two simultaneous day cancellations of the
same order yield exactly one success, one safe terminal response, one cancelled
order, and one canonical audit message. Keep the existing Hector race test.

- [ ] **Step 5: Run cancellation and concurrency suites**

Rerun Step 2, then run:

```bash
/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 --db_host=/private/tmp/pg-hector-socket --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all --http-port=18069 --gevent-port=18072 \
  --test-enable --stop-after-init -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminCancelConcurrency,/gf_pwa_admin:TestPWAAdminAPI.test_night_sale_cancel_accepts_each_exact_reason_code_and_posts_canonical_label,/gf_pwa_admin:TestPWAAdminAPI.test_sale_cancel_admin_token_keeps_free_text_response_chatter_and_manager_policy' \
  --log-level=test --logfile=/private/tmp/day-pos-cancel-green.log
```

Expected: every restricted cancellation test passes, including one-winner
concurrency; admin and Hector regressions remain green.

- [ ] **Step 6: Commit cancellation**

```bash
git add gf_pwa_admin
git commit -m "feat(pos): cancel own day sales with canonical reasons"
```

### Task 6: Add the PWA day flow and strict transport contract

**Files:**
- Modify: `src/modules/admin/posFlow.js`
- Modify: `src/modules/admin/api.js`
- Modify: `src/lib/api.js`
- Create: `tests/dayPosApi.test.mjs`
- Modify: `tests/posAdminAuth.test.mjs`
- Modify: `tests/posFlow.test.mjs`

- [ ] **Step 1: Write failing flow and wrapper tests**

Assert `DAY_POS_FLOW` is frozen and contains:

```javascript
{
  backTo: '/',
  posRoute: '/pos-diurno',
  ticketBasePath: '/pos-diurno/ticket',
  salesRoute: '/pos-diurno/ventas',
  title: 'POS día',
  standalone: true,
  posScope: 'day',
  defaultCustomerName: 'VENTA PUBLICO IGUALA',
  allowSaleCancellation: true,
  cancellationMode: 'closed-reasons',
}
```

Assert the reason list is the same immutable four-code catalog used by night.
Assert printing is provided by the shared `ScreenTicket`/`printTicketViaQz`
path, not by a second day-printer implementation.
Assert the public wrappers produce exactly:

```text
/pwa-admin/pos-products?...&pos_scope=day
/pwa-admin/customers?...&pos_scope=day
/pwa-admin/today-sales?pos_scope=day
/pwa-admin/sale-detail?order_id=9001&pos_scope=day
POST /pwa-admin/sale-create {...sale, pos_scope: day}
POST /pwa-admin/sale-cancel {order_id: 9001, reason_code: duplicate, pos_scope: day}
/pwa-admin/default-customer?company_id=34&pos_scope=day
```

Unknown, whitespace, inherited, accessor-backed, array, or object scopes must
throw before transport. Direct proxy calls with supplied malformed/conflicting
intent must be forwarded for backend rejection, never silently downgraded. Add
a fetch-capture test that proves `sale-create` sends `pos_scope` and any supplied
`night_pos` all the way to the Odoo JSON params; conflicting values must reach
the backend selector or fail locally, never disappear.

- [ ] **Step 2: Run focused Node tests and verify RED**

```bash
cd /Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/day-pos-role
node --test tests/dayPosApi.test.mjs tests/posFlow.test.mjs tests/posAdminAuth.test.mjs
```

Expected: missing `DAY_POS_FLOW`, wrappers, and proxy forwarding.

- [ ] **Step 3: Implement strict flow-aware wrappers**

Introduce a single validator:

```javascript
export function normalizePosScope(value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value !== 'day') {
    throw new TypeError('El alcance del POS no es válido.')
  }
  return value
}
```

Add `getDayTodaySales()`, make `getSaleOrder(orderId, { posScope } = {})`,
`getDefaultCustomer(companyId, { posScope } = {})`, and closed cancellation
options carry the validated scope. `submitPosCancellation()` must pass
`flow.posScope` to the cancel function. Extend catalog and customer-search path
builders with the same optional scope. `createSaleOrder()` must validate an own
`pos_scope`/`night_pos` property without reading accessors, then preserve the
allowlisted scalar values in the body.

- [ ] **Step 4: Forward the allowlisted intent through `src/lib/api.js`**

For day catalog, customer search, default customer, today-sales, and detail,
preserve `pos_scope` in the dedicated Odoo HTTP query. For sale-create and
cancel, preserve it in JSON params. Do not let an existing `night_pos` branch or
body field drop a simultaneous `pos_scope`; both must reach Odoo or be rejected
locally as a conflict.

- [ ] **Step 5: Implement exact day default-customer resolution**

When `pos_scope=day`, delegate catalog, customer search, and default customer to
their dedicated Odoo controllers with the employee token. Do not authorize from
the cached session role or reproduce the exact/ambiguous search in JavaScript.
Surface the stable backend codes `day_pos_default_customer_missing` and
`day_pos_default_customer_ambiguous`. Preserve current local/direct-model admin
and Hector customer behavior when day scope is absent.

- [ ] **Step 6: Run focused tests and verify GREEN**

Expected: new day contracts and all existing proxy/night/admin tests pass.

- [ ] **Step 7: Commit the PWA flow contract**

```bash
git add src/modules/admin/posFlow.js src/modules/admin/api.js src/lib/api.js tests
git commit -m "feat(pos): add strict day POS flow contract"
```

### Task 7: Extract the reusable restricted-sales screen

**Files:**
- Create: `src/modules/admin/ScreenRestrictedPosSales.jsx`
- Modify: `src/modules/admin/ScreenNightPosSales.jsx`
- Create: `src/modules/admin/ScreenDayPosSales.jsx`
- Modify: `src/modules/admin/nightPosSales.js`
- Create: `tests/dayPosSalesScreen.test.mjs`
- Modify: `tests/nightPosSalesScreen.test.mjs`
- Modify: `tests/nightPosSales.test.mjs`

- [ ] **Step 1: Write failing reusable-screen tests**

Mount the shared screen with injected `flow` and `loadSales`. Verify loading,
empty, retry, safe failure envelope, unmount/stale-request suppression, order,
Mexico time, statuses, and ticket path. Add one night wrapper and one day wrapper
test proving each passes the correct loader and flow. Confirm no date input or
range control exists.

- [ ] **Step 2: Run screen tests and verify RED**

```bash
node --test tests/dayPosSalesScreen.test.mjs tests/nightPosSalesScreen.test.mjs tests/nightPosSales.test.mjs
```

Expected: missing generic/day screen.

- [ ] **Step 3: Move presentation into `ScreenRestrictedPosSales`**

Give the shared component this narrow interface:

```javascript
export default function ScreenRestrictedPosSales({
  flow,
  loadSales,
  screenName,
})
```

Use `buildPosTicketPath(flow, orderId)` and `navigate(flow.posRoute)`; do not
import `NIGHT_POS_FLOW` or inspect employee identity in the generic component.
Keep the current safe response normalization and status labels. Export generic
normalizer names while retaining compatibility aliases from
`nightPosSales.js` so existing imports do not break in the same commit.

- [ ] **Step 4: Implement thin wrappers**

`ScreenNightPosSales` passes `NIGHT_POS_FLOW/getNightTodaySales`.
`ScreenDayPosSales` passes `DAY_POS_FLOW/getDayTodaySales`. No wrapper contains
duplicated rendering or data filtering.

- [ ] **Step 5: Run screen tests and verify GREEN**

Expected: night behavior unchanged and day behavior uses its own routes.

- [ ] **Step 6: Commit the shared sales screen**

```bash
git add src/modules/admin/ScreenRestrictedPosSales.jsx src/modules/admin/ScreenNightPosSales.jsx src/modules/admin/ScreenDayPosSales.jsx src/modules/admin/nightPosSales.js tests
git commit -m "refactor(pos): share restricted sales history screen"
```

### Task 8: Wire role-based navigation, POS, ticket, and printing

**Files:**
- Modify: `src/modules/registry.js`
- Modify: `src/App.jsx`
- Modify: `src/lib/navModel.js`
- Modify: `src/modules/admin/ScreenPOS.jsx`
- Modify: `src/modules/admin/forms/AdminPosForm.jsx`
- Modify: `src/modules/admin/ScreenTicket.jsx`
- Create: `tests/dayPosRole.test.mjs`
- Create: `tests/dayPosRouting.test.mjs`
- Create: `tests/dayPosCancellation.test.mjs`
- Modify: `tests/navGuards.test.mjs`
- Modify: `tests/globalNav.test.mjs`
- Modify: `tests/posScreenFlowWiring.test.mjs`

- [ ] **Step 1: Write failing navigation and direct-route tests**

Assert `pos_diurno` is the only role for the module, the primary and additional
role both show/enter it, unrelated/Hector-only/admin-only sessions do not, and
the role does not expose `admin_sucursal`.

Assert all routes are inside the authenticated `AppShell` and each uses
`ModuleRoleRoute moduleId="pos_diurno"`:

```jsx
<Route path="/pos-diurno" ... />
<Route path="/pos-diurno/ventas" ... />
<Route path="/pos-diurno/ticket/:orderId" ... />
```

Assert day sales and ticket subroutes are hidden from global nav without hiding
the module root.

- [ ] **Step 2: Write failing flow-propagation tests**

Verify mobile and desktop POS call default-customer/create with `day`,
`ScreenTicket` requests detail with `flow.posScope`, cancellation carries the
same scope, and printing still calls `printTicketViaQz` with the shared order.
Verify admin and night calls remain byte-compatible.

Simulate a cached PWA session that still contains `pos_diurno` while each
protected backend call returns 403. Assert POS, history, and ticket show a safe
access/configuration error and never retry as admin or strip the scope.

- [ ] **Step 3: Run focused UI tests and verify RED**

```bash
node --test tests/dayPosRole.test.mjs tests/dayPosRouting.test.mjs tests/dayPosCancellation.test.mjs tests/navGuards.test.mjs tests/globalNav.test.mjs tests/posScreenFlowWiring.test.mjs
```

- [ ] **Step 4: Register and route the module**

Add module metadata with `roles: ['pos_diurno']`, `route: '/pos-diurno'`, live
status, admin icon, standalone navigation priority, and no custom name policy.
Lazy-load `ScreenDayPosSales` and mount POS, history, and ticket behind
`ModuleRoleRoute`.

- [ ] **Step 5: Pass flow scope through both POS layouts and ticket**

Use `{ posScope: flow.posScope }` for the day default customer and detail.
Include `pos_scope: flow.posScope` in day sale-create payloads. Closed-reason
cancellation passes the flow scope through `submitPosCancellation`; admin free
text and night closed reasons remain unchanged. Do not fork ticket printing.

- [ ] **Step 6: Run focused UI tests and verify GREEN**

Expected: day module/routes/intent pass; all touched night/admin/nav tests pass.

- [ ] **Step 7: Commit the complete PWA surface**

```bash
git add src tests
git commit -m "feat(pos): expose assignable day POS module"
```

### Task 9: Run coordinated verification and review

**Files:**
- Modify if generated: `graphify-out/**`
- No functional changes unless a verification failure proves they are needed.

- [ ] **Step 1: Run the full PWA verification**

```bash
cd /Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/day-pos-role
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass (baseline was 1,761 before new tests), lint has zero
errors, production build succeeds, and no whitespace errors exist.

- [ ] **Step 2: Start the disposable PostgreSQL runtime if needed**

```bash
/Library/PostgreSQL/17/bin/pg_ctl \
  -D /private/tmp/pg-hector-test \
  -l /private/tmp/pg-day-pos-test.log start
```

Use socket `/private/tmp/pg-hector-socket`, port `55437`, user `sebis`, and the
dedicated database `gf_day_pos_test_20260726`. Never run these tests against production
or a shared database.

- [ ] **Step 3: Run the focused Odoo role and POS suites**

First run the pure role test:

```bash
cd /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend
python3 os_customer_zones/tests/test_pwa_job_key.py
```

Then install/update the disposable database and run:

```bash
/private/tmp/odoo18-hector-venv/bin/python -B \
  /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 \
  --db_host=/private/tmp/pg-hector-socket \
  --db_port=55437 \
  --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all \
  --http-port=18069 \
  --gevent-port=18072 \
  --test-enable \
  --stop-after-init \
  -u os_customer_zones,os_api,gf_pwa_admin \
  --test-tags='/os_api:TestEmployeeSignInSecurity,/gf_pwa_admin:TestPWAAdminAPI' \
  --log-level=test \
  --logfile=/private/tmp/day-pos-focused.log
```

Expected: role/login and focused POS tests pass. If the pre-existing unrelated
full HttpCase failures reappear, separate them from the named day/night POS
methods and do not widen permissions to make unrelated tests green.

- [ ] **Step 4: Run committed-transaction concurrency coverage**

```bash
/private/tmp/odoo18-hector-venv/bin/python -B \
  /private/tmp/odoo18-hector/odoo-bin \
  -d gf_day_pos_test_20260726 \
  --db_host=/private/tmp/pg-hector-socket \
  --db_port=55437 \
  --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend \
  --without-demo=all \
  --http-port=18069 \
  --gevent-port=18072 \
  --test-enable \
  --stop-after-init \
  -u gf_pwa_admin \
  --test-tags='/gf_pwa_admin:TestPWAAdminCancelConcurrency' \
  --log-level=test \
  --logfile=/private/tmp/day-pos-concurrency.log
```

- [ ] **Step 5: Refresh the backend architecture graph**

Per `AGENTS.md`, run from the backend worktree after code changes:

```bash
/Users/sebis/Documents/odoo/GrupoFrio/.graphify-env/bin/graphify update .
git status --short
```

Review generated changes and commit only graph artifacts caused by this feature:

```bash
git add graphify-out
git commit -m "docs: refresh backend code graph for day POS"
```

- [ ] **Step 6: Request final code review**

Use `@superpowers:requesting-code-review` across both worktrees. Require the
reviewer to inspect authorization bypasses, mixed-role precedence, exact owner
and Mexico-day scope, cancellation race behavior, proxy parameter stripping,
default-customer ambiguity, and regressions for Angy/Hector.

- [ ] **Step 7: Apply review fixes test-first and rerun all affected gates**

For every accepted finding: add/reproduce a failing test, implement the smallest
fix, rerun focused tests, then repeat the full PWA and Odoo gates above.

- [ ] **Step 8: Verify final repository state**

```bash
git -C /Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/day-pos-role status --short --branch
git -C /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend status --short --branch
git -C /Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/day-pos-role log --oneline origin/main..HEAD
git -C /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/day-pos-role-backend log --oneline origin/GrupoFrio..HEAD
```

Expected: both worktrees are clean and contain only intentional feature commits.
Do not push, merge, deploy, or assign the role to Ruth until the user requests
that publication/rollout step.

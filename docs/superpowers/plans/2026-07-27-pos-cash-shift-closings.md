# POS Cash Shift Closings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual day/night POS cash-shift closings, operational dates, product and payment reports, physical cash counts, immutable audit versions, and safe reopen/cancel behavior administered by Angy.

**Architecture:** Odoo is authoritative for the active shift, movement assignment, operational-date sequence, calculations, locking, snapshots, permissions, evidence, and audit. Every PWA POS sale and PWA-admin expense is assigned to the branch's active shift under the same PostgreSQL advisory lock used by opening and closing; the PWA renders server DTOs, captures denominations/adjustments/evidence, and recovers idempotently from uncertain responses. The existing calendar-day closing remains readable but becomes write-disabled per branch after cash shifts are activated.

**Tech Stack:** Odoo 18/Python/PostgreSQL, React 19, React Router, Node test runner, Vite, ESLint, browser print CSS.

---

## Worktrees and source documents

- PWA: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings`
- Odoo: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend`
- Approved spec: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/docs/superpowers/specs/2026-07-27-pos-cash-shift-closings-design.md`

Use `@superpowers:test-driven-development` for every behavior change. Before any
completion claim use `@superpowers:verification-before-completion`; before the
PR/push handoff use `@superpowers:requesting-code-review` and
`@superpowers:finishing-a-development-branch`.

Do not edit either dirty primary checkout. Keep Odoo and PWA commits separate.
Deploy and upgrade Odoo before releasing the PWA capability.

## Baseline note

The PWA baseline is green at 1,892 tests. Five directly executed Odoo static
contracts are green. One pre-existing static contract,
`tests/test_gf_pwa_admin_auth_contract.py`, is stale: it searches for the removed
test `test_waiting_request_rechecks_policy_after_row_lock`, while the live
concurrency suite now covers the same behavior in
`test_restricted_cancel_revalidates_committed_mutations_after_lock`. Task 0
repairs only that test-contract drift before feature code starts.

## File map

### Odoo

- `gf_pwa_admin/models/cash_shift_lock.py`: stable branch lock keys and advisory-lock helper.
- `gf_pwa_admin/models/gf_pos_cash_shift.py`: config, shift, immutable version, denomination/adjustment/authorization/event lines, lifecycle, totals, and consolidated report.
- `gf_pwa_admin/models/gf_pos_cash_shift_audit.py`: structured cancellation audit, single-use evidence token, and idempotent operation record.
- `gf_pwa_admin/models/sale_order.py`: shift linkage, cash timestamp/channel, and model-level cancel guard.
- `gf_pwa_admin/models/hr_expense.py`: shift linkage, cash effect, and protected monetary fields.
- `gf_pwa_admin/models/__init__.py`: register new models.
- `gf_pwa_admin/hooks.py`: record the authoritative cash-instrumentation deployment boundary on fresh install.
- `gf_pwa_admin/migrations/18.0.2.2.0/post-migrate.py`: record that boundary once on upgrade.
- `gf_pwa_admin/__init__.py`: expose the install hook.
- `gf_pwa_admin/controllers/cash_shift_api.py`: dedicated active/preview/open/close/history/detail/reopen/authorize API.
- `gf_pwa_admin/controllers/pwa_admin_api.py`: sale/expense assignment, structured cancel context, evidence upload, capabilities, and legacy-write gate.
- `gf_pwa_admin/controllers/__init__.py`: register the dedicated controller.
- `gf_pwa_admin/security/ir.model.access.csv`: read/write/no-delete access for new audit models.
- `gf_pwa_admin/data/sequences.xml`: `CT/POS/<year>/` cut sequence.
- `gf_pwa_admin/__manifest__.py`: data file and version bump.
- `os_customer_zones/models/models_hr.py`: canonical `allow_manage_pos_cash_shifts` field beside existing financial permissions.
- `os_customer_zones/views/views_hr.xml`: permission visibility in the employee form.
- `os_customer_zones/__manifest__.py`: version bump.
- `os_api/controllers/employee_login.py`: publish only the relevant finance permissions to the PWA session.
- `os_api/tests/test_employee_signin_security.py`: login payload authorization contract.
- `os_api/__manifest__.py`: version bump.
- `gf_pwa_admin/tests/test_pos_cash_shift.py`: model/lifecycle/snapshot/guard tests.
- `gf_pwa_admin/tests/test_pos_cash_shift_api.py`: authenticated API and permission tests.
- `gf_pwa_admin/tests/test_pos_cash_shift_concurrency.py`: committed transaction races.
- `gf_pwa_admin/tests/__init__.py`: register Odoo test modules.
- `tests/test_pos_cash_shift_contract.py`: dependency-free manifest/schema/route contracts.
- `tests/test_gf_pwa_admin_auth_contract.py`: repair stale pre-existing concurrency reference.
- `tests/run_pos_cash_shift_odoo.sh`: repeatable isolated PostgreSQL/Odoo RED/GREEN runner.

### PWA

- `src/modules/admin/cashShiftModel.js`: strict DTO normalization, local denomination math, transition labels, schedule warnings, and error classification.
- `src/modules/admin/cashShiftService.js`: orchestrated loads, idempotent writes, and uncertain-response recovery.
- `src/modules/admin/api.js`: raw cash-shift endpoint wrappers.
- `src/modules/admin/adminService.js`: fail-closed capabilities and compatibility boundary.
- `src/modules/admin/ScreenCierreCaja.jsx`: responsive entry point for the new cash-shift dashboard.
- `src/modules/admin/components/CashShiftDashboard.jsx`: active/cut/history/legacy view state.
- `src/modules/admin/components/CashShiftActivePanel.jsx`: active shift and preview.
- `src/modules/admin/components/CashShiftFirstOpenForm.jsx`: one-time bootstrap.
- `src/modules/admin/components/CashShiftCloseForm.jsx`: cut/reclose workflow.
- `src/modules/admin/components/CashShiftDenominations.jsx`: MXN count grid.
- `src/modules/admin/components/CashShiftAdjustments.jsx`: audited income/expense lines.
- `src/modules/admin/components/CashShiftHistory.jsx`: operational-date history and consolidated report.
- `src/modules/admin/components/CashShiftPrintView.jsx`: printable immutable report.
- `src/modules/admin/components/LegacyCashClosingHistory.jsx`: read-only historical daily closings.
- `src/modules/admin/cashShift.css`: responsive/print styles.
- `src/modules/admin/components/AdminShell.jsx`: permission-aware `Cortes de caja` navigation.
- `src/modules/admin/ScreenAdminPanel.jsx`: permission-aware mobile card copy.
- `src/App.jsx`: retain `/admin/cierre` while rendering the new screen.
- `src/lib/navModel.js`: update route documentation only; route behavior remains hidden from global nav.
- `tests/cashShiftModel.test.mjs`: normalization/math/date/schedule tests.
- `tests/cashShiftApi.test.mjs`: exact endpoint and payload tests.
- `tests/cashShiftScreen.test.mjs`: active/bootstrap/cut/recovery UI tests.
- `tests/cashShiftHistory.test.mjs`: operational ordering, consolidation, and print tests.
- `tests/cashShiftRouting.test.mjs`: session permission and existing route compatibility.

### Task 0: Restore a trustworthy isolated baseline

**Files:**
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/tests/test_gf_pwa_admin_auth_contract.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/tests/run_pos_cash_shift_odoo.sh`

- [ ] **Step 1: Point the stale AST contract at the current concurrency test**

Replace the removed function name with:

```python
"test_restricted_cancel_revalidates_committed_mutations_after_lock"
```

Assert the current test contains the `amount` mutation, `6000`,
`_run_restricted_waiting_mutation`, and `manager_required`. Do not weaken or
remove the concurrency assertions.

- [ ] **Step 2: Run the repaired static baseline**

Workdir: Odoo worktree.

```bash
python3 tests/test_gf_pwa_admin_auth_contract.py
```

Expected: 6 tests pass.

- [ ] **Step 3: Add the isolated Odoo RED/GREEN runner**

Create an executable script that accepts one exact `--test-tags` selector. It
must start the already provisioned private PostgreSQL cluster when needed,
recreate only the explicit disposable database, and install the three touched
modules into that fresh database:

```bash
#!/usr/bin/env bash
set -euo pipefail

test_tag="${1:?usage: tests/run_pos_cash_shift_odoo.sh TEST_TAG}"
pg_bin=/Library/PostgreSQL/17/bin
pg_data=/private/tmp/pg-hector-test
pg_socket=/private/tmp/pg-hector-socket
test_db=gf_cash_shift_test_20260727

mkdir -p "$pg_socket" /private/tmp/odoo18-hector-data
if ! "$pg_bin/pg_ctl" -D "$pg_data" status >/dev/null 2>&1; then
  "$pg_bin/pg_ctl" -D "$pg_data" -o "-k $pg_socket -p 55437" -w start
fi
"$pg_bin/dropdb" --if-exists -h "$pg_socket" -p 55437 -U sebis "$test_db"
"$pg_bin/createdb" -h "$pg_socket" -p 55437 -U sebis "$test_db"

/private/tmp/odoo18-hector-venv/bin/python -B /private/tmp/odoo18-hector/odoo-bin \
  -d "$test_db" \
  --db_host="$pg_socket" --db_port=55437 --db_user=sebis \
  --data-dir=/private/tmp/odoo18-hector-data \
  --addons-path=/private/tmp/odoo18-hector/addons,/private/tmp/odoo18-hector-stubs,/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend \
  --without-demo=all --http-port=18079 --gevent-port=18082 \
  --workers=0 --max-cron-threads=0 --test-enable --stop-after-init \
  -i os_api,os_customer_zones,gf_pwa_admin \
  --test-tags="$test_tag" --log-level=test \
  --logfile=/private/tmp/cash-shift-odoo.log
```

Run `chmod +x tests/run_pos_cash_shift_odoo.sh`. The hard-coded database name
is deliberately disposable and must never be replaced with a shared or
production name.

- [ ] **Step 4: Smoke-test the isolated runner**

Workdir: Odoo worktree.

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestAdminInternalPermissions'
```

Expected: the selected existing suite is green and the log names only
`gf_cash_shift_test_20260727`.

- [ ] **Step 5: Reconfirm the PWA baseline**

Workdir: PWA worktree.

```bash
npm test
```

Expected: 1,892 tests pass before feature code changes.

- [ ] **Step 6: Commit the baseline and isolated runner**

Workdir: Odoo worktree.

```bash
git add tests/test_gf_pwa_admin_auth_contract.py tests/run_pos_cash_shift_odoo.sh
git commit -m "test(pos): align cash shift test baseline"
```

### Task 1: Add the cash-shift schema and database invariants

**Files:**
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/models/cash_shift_lock.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/models/gf_pos_cash_shift.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/models/sale_order.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/models/hr_expense.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/models/__init__.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/hooks.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/migrations/18.0.2.2.0/post-migrate.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/__init__.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/security/ir.model.access.csv`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/data/sequences.xml`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/__manifest__.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/tests/test_pos_cash_shift.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/gf_pwa_admin/tests/__init__.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/tests/test_pos_cash_shift_contract.py`

- [ ] **Step 1: Write RED model tests**

Create `TestPosCashShiftSchema(common.TransactionCase)` with fixtures for one company,
warehouse, employee, and these assertions:

```python
self.assertEqual(shift.shift_type, "night")
self.assertEqual(shift.business_date, date(2026, 7, 27))
self.assertEqual(shift.state, "open")
self.assertEqual(shift.warehouse_id, self.warehouse)

with self.assertRaises(IntegrityError), self.env.cr.savepoint():
    Shift.create(second_open_vals)

with self.assertRaises(ValidationError):
    shift.unlink()
```

Also assert uniqueness of `(company_id, warehouse_id, business_date,
shift_type)`, required warehouse, immutable version numbers, and no delete for
config/shift/version records. Create one version with denomination, adjustment,
authorization, and lifecycle-event lines. Assert direct `create()` without the
private service context fails; every `write()`/`unlink()` on a version, line,
authorization, or lifecycle event fails; ordinary internal users have no model
access; and technical system administrators have read-only ACLs. Assert the
registry initializes every Monetary field with company MXN currency, accepts
every existing `DENOMINATIONS` key, and rejects `3`, negative counts, booleans,
floats-as-counts, and client-supplied subtotals.

- [ ] **Step 2: Run the focused model test and verify RED**

Workdir: Odoo worktree.

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema'
python3 tests/test_pos_cash_shift_contract.py
```

Expected: FAIL because `gf.pos.cash.shift` does not exist.

- [ ] **Step 3: Implement focused models**

Create these models:

```python
class GFPosCashShiftConfig(models.Model):
    _name = "gf.pos.cash.shift.config"
    company_id = fields.Many2one("res.company", required=True, ondelete="restrict")
    warehouse_id = fields.Many2one("stock.warehouse", required=True, ondelete="restrict")
    analytic_account_id = fields.Many2one("account.analytic.account", readonly=True, ondelete="restrict")
    state = fields.Selection([("inactive", "Inactivo"), ("active", "Activo")], default="inactive", required=True)
    timezone = fields.Char(default="America/Mexico_City", required=True)
    night_close_hour = fields.Float(default=6.0, required=True)
    day_close_hour = fields.Float(default=18.0, required=True)
    activated_at = fields.Datetime(readonly=True)
    active_shift_id = fields.Many2one("gf.pos.cash.shift", readonly=True)

class GFPosCashShiftInstrumentation(models.Model):
    _name = "gf.pos.cash.shift.instrumentation"
    code = fields.Selection([("cash_shift_v1", "Cash shift v1")], required=True, readonly=True)
    instrumented_at = fields.Datetime(required=True, readonly=True)

class GFPosCashShift(models.Model):
    _name = "gf.pos.cash.shift"
    _inherit = ["mail.thread"]
    name = fields.Char(readonly=True, copy=False, default="Nuevo")
    company_id = fields.Many2one("res.company", required=True, ondelete="restrict", index=True)
    currency_id = fields.Many2one("res.currency", related="company_id.currency_id", store=True, readonly=True)
    warehouse_id = fields.Many2one("stock.warehouse", required=True, ondelete="restrict", index=True)
    analytic_account_id = fields.Many2one("account.analytic.account", readonly=True, ondelete="restrict", index=True)
    shift_type = fields.Selection([("night", "Noche"), ("day", "Día")], required=True, index=True)
    business_date = fields.Date(required=True, index=True)
    state = fields.Selection([("open", "Abierto"), ("pending_auth", "Pendiente"), ("closed", "Cerrado"), ("reopened", "Reabierto")], required=True, default="open", index=True)
    opened_at = fields.Datetime(required=True, readonly=True)
    closed_at = fields.Datetime(readonly=True)
    opening_fund = fields.Monetary(required=True, default=0, currency_field="currency_id")
    previous_shift_id = fields.Many2one("gf.pos.cash.shift", readonly=True)
    next_shift_id = fields.Many2one("gf.pos.cash.shift", readonly=True)
    current_version_id = fields.Many2one("gf.pos.cash.shift.version", readonly=True)

class GFPosCashShiftVersion(models.Model):
    _name = "gf.pos.cash.shift.version"
    shift_id = fields.Many2one("gf.pos.cash.shift", required=True, ondelete="restrict", index=True)
    currency_id = fields.Many2one("res.currency", related="shift_id.currency_id", store=True, readonly=True)
    version_number = fields.Integer(required=True)
    sales_json = fields.Json(default=list, readonly=True)
    cancellations_json = fields.Json(default=list, readonly=True)
    expenses_json = fields.Json(default=list, readonly=True)
    products_json = fields.Json(default=list, readonly=True)
    payments_json = fields.Json(default=dict, readonly=True)
    close_kind = fields.Selection([("normal", "Corte"), ("reclose", "Recierre")], required=True, readonly=True)
    closed_by_employee_id = fields.Many2one("hr.employee", required=True, readonly=True)
    closed_by_user_id = fields.Many2one("res.users", required=True, readonly=True)
    closed_or_reclosed_at = fields.Datetime(required=True, readonly=True)
    reopen_reason = fields.Text(readonly=True)
    evidence_attachment_id = fields.Many2one("ir.attachment", readonly=True, ondelete="restrict")
    previous_version_id = fields.Many2one("gf.pos.cash.shift.version", readonly=True, ondelete="restrict")
    prior_totals_json = fields.Json(default=dict, readonly=True)

class GFPosCashShiftDenomination(models.Model):
    _name = "gf.pos.cash.shift.denomination"
    version_id = fields.Many2one("gf.pos.cash.shift.version", required=True, ondelete="restrict", index=True)
    currency_id = fields.Many2one("res.currency", related="version_id.currency_id", store=True, readonly=True)
    denomination = fields.Selection(DENOMINATIONS, required=True, readonly=True)
    count = fields.Integer(required=True, readonly=True)
    subtotal = fields.Monetary(required=True, readonly=True, currency_field="currency_id")

class GFPosCashShiftAdjustment(models.Model):
    _name = "gf.pos.cash.shift.adjustment"
    version_id = fields.Many2one("gf.pos.cash.shift.version", required=True, ondelete="restrict", index=True)
    currency_id = fields.Many2one("res.currency", related="version_id.currency_id", store=True, readonly=True)
    adjustment_type = fields.Selection([("income", "Ingreso"), ("expense", "Egreso")], required=True, readonly=True)
    amount = fields.Monetary(required=True, readonly=True, currency_field="currency_id")
    concept = fields.Char(required=True, readonly=True)
    actor_employee_id = fields.Many2one("hr.employee", required=True, readonly=True)
    recorded_at = fields.Datetime(required=True, readonly=True)

class GFPosCashShiftAuthorization(models.Model):
    _name = "gf.pos.cash.shift.authorization"
    version_id = fields.Many2one("gf.pos.cash.shift.version", required=True, ondelete="restrict", index=True)
    level = fields.Selection([("manager", "Gerencia"), ("director", "Dirección")], required=True, readonly=True)
    actor_employee_id = fields.Many2one("hr.employee", required=True, readonly=True)
    authorized_at = fields.Datetime(required=True, readonly=True)

class GFPosCashShiftEvent(models.Model):
    _name = "gf.pos.cash.shift.event"
    shift_id = fields.Many2one("gf.pos.cash.shift", required=True, ondelete="restrict", index=True)
    version_id = fields.Many2one("gf.pos.cash.shift.version", ondelete="restrict", index=True)
    event_type = fields.Selection([("open", "Apertura"), ("close", "Corte"), ("authorize", "Autorización"), ("reopen", "Reapertura"), ("reclose", "Recierre")], required=True, readonly=True)
    actor_employee_id = fields.Many2one("hr.employee", required=True, readonly=True)
    reason = fields.Text(readonly=True)
    occurred_at = fields.Datetime(required=True, readonly=True)
```

`analytic_account_id` is copied only from the authenticated employee/warehouse
scope and may be empty for the approved admin fallback. When populated, every
read/authorization additionally requires an exact trusted analytic match; an
empty value never permits crossing company or warehouse scope.

Import `DENOMINATIONS` from the existing `gf_cash_closing` model. Every other
Monetary total on shift/version/adjustment models must declare the related
`currency_id` and `currency_field="currency_id"`. Remove duplicated denomination
allowlists from controllers and validate submitted string values against
`dict(DENOMINATIONS)`; counts are nonnegative integers and subtotals are computed
server-side.

Add the movement identity fields at schema time so the activation service can
define and test its candidate domain before endpoint integration:

```python
# sale.order
x_pwa_cash_shift_id = fields.Many2one("gf.pos.cash.shift", copy=False, index=True, ondelete="restrict")
x_pwa_cash_recorded_at = fields.Datetime(copy=False, index=True)
x_pwa_cash_channel = fields.Selection([("admin", "Admin"), ("day", "Día"), ("night", "Noche"), ("legacy_pwa", "PWA anterior")], copy=False, index=True)

# hr.expense
x_pwa_cash_shift_id = fields.Many2one("gf.pos.cash.shift", copy=False, index=True, ondelete="restrict")
x_pwa_cash_recorded_at = fields.Datetime(copy=False, index=True)
x_pwa_cash_effect_amount = fields.Monetary(copy=False, currency_field="currency_id")
```

Extend the existing `_auto_init()` compatibility map for `sale.order`; use
normal module-upgrade columns for `hr.expense`.

Add monetary totals, difference/auth requirements, persisted order/expense IDs,
and one2many links to the version model. A pending version is immutable; later
authorizations append immutable authorization rows and events instead of editing
the snapshot or its original `closed_or_reclosed_at`. Use SQL uniqueness for
scope, version, one authorization per level/version, and denomination value per
version. In `_auto_init()`, create:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS gf_pos_cash_shift_one_open_scope_idx
ON gf_pos_cash_shift (company_id, warehouse_id)
WHERE state = 'open'
```

The lock module must derive deterministic signed 32-bit keys from a fixed
namespace plus company/warehouse IDs and execute `pg_advisory_xact_lock`.
Document and enforce one lock order for the entire feature:

```text
branch advisory lock
-> config/shift row FOR UPDATE
-> sale/expense rows FOR UPDATE in ascending ID order
-> version/evidence/idempotency rows
```

No controller may lock a PWA movement row before resolving and taking its
branch advisory lock.

- [ ] **Step 4: Implement immutable ORM boundaries**

All creation goes through model service methods with a private, server-only
context and `env.su`; a context key alone is not authority because RPC callers
can forge context. Override `write()`/`unlink()` so snapshots, their linked lines,
authorization/event rows, and shift identity/timestamps/links
cannot be changed directly. Shift state changes and the first assignment of a
movement link/timestamp are allowed only by the corresponding service method;
once assigned those movement fields are immutable. `closed_at` records the
first close and is never changed by reopen, authorization, or rec close.

- [ ] **Step 5: Add ACLs, sequence, imports, and manifest data**

Grant only `base.group_system` read access to the new audit models and no
create/write/unlink ACL; grant no generic `base.group_user` access.
Authenticated controller service methods use scoped `sudo()` only after token
and permission checks. Add `gf.pos.cash.shift` sequence prefix
`CT/POS/%(year)s/`.

The fresh-install hook and upgrade migration both create the unique
`cash_shift_v1` instrumentation row with server UTC only if it is absent; they
never move an existing boundary forward. Its model has a SQL-unique `code`, no
ordinary ACL, and unconditional `write()`/`unlink()` guards. Task 3 uses that immutable
deployment boundary to separate legacy `create_date` candidates from newly
stamped movements. Add a static contract for the hook/migration and a model
test proving repeated execution preserves the first timestamp. Bump
`gf_pwa_admin` to `18.0.2.2.0` and declare the post-init hook in the manifest.

- [ ] **Step 6: Run GREEN and commit**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema'
python3 tests/test_pos_cash_shift_contract.py
```

Expected: all schema/invariant/immutability tests pass.

```bash
git add gf_pwa_admin tests/test_pos_cash_shift_contract.py
git commit -m "feat(cash): add POS shift audit schema"
```

### Task 2: Add Angy's assignable permission and session contract

**Files:**
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/os_customer_zones/models/models_hr.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/os_customer_zones/views/views_hr.xml`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/os_customer_zones/__manifest__.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/os_api/controllers/employee_login.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/os_api/tests/test_employee_signin_security.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/os_api/__manifest__.py`

- [ ] **Step 1: Write RED permission/login tests**

Add an employee login test that sets:

```python
employee.allow_manage_pos_cash_shifts = True
```

Assert the login payload includes exactly:

```python
self.assertIs(result["employee"]["allow_manage_pos_cash_shifts"], True)
self.assertIn("allow_authorize_cash_closing", result["employee"])
self.assertIn("allow_reopen_cash_closing", result["employee"])
```

Also assert another auxiliary admin, Héctor's night POS profile, and the generic
day POS profile receive `False`. Existing authorization/reopen/direction flags
must not imply this management permission.

- [ ] **Step 2: Run RED**

Run only the new login contract methods:

```bash
tests/run_pos_cash_shift_odoo.sh '/os_api:TestEmployeeSignInSecurity.test_cash_shift_permission_payload'
```

Expected: FAIL because the field is absent.

- [ ] **Step 3: Implement the field and form control**

Add beside the existing finance permissions:

```python
allow_manage_pos_cash_shifts = fields.Boolean(
    string="Puede administrar cortes POS por turno",
    default=False,
)
```

Expose it on the employee form. Add the new field plus existing authorization
and reopen fields to `preferred_fields` in `employee_login.py`; keep the existing
`if f in employee._fields` compatibility guard. Do not match Angy's name or set
the flag automatically in module data.

- [ ] **Step 4: Run GREEN and commit**

```bash
tests/run_pos_cash_shift_odoo.sh '/os_api:TestEmployeeSignInSecurity.test_cash_shift_permission_payload'
```

Expected: the management field is present and remains independent from every
legacy finance flag.

```bash
git add os_customer_zones os_api
git commit -m "feat(cash): expose shift closing permission"
```

### Task 3: Implement inactive preview, first activation, and deterministic sequencing

**Files:**
- Modify: `gf_pwa_admin/models/gf_pos_cash_shift.py`
- Modify: `gf_pwa_admin/models/cash_shift_lock.py`
- Modify: `gf_pwa_admin/tests/test_pos_cash_shift.py`

- [ ] **Step 1: Write RED lifecycle tests**

Cover:

```python
night = service.open_initial(..., shift_type="night", business_date=date(2026, 7, 27), start_at=utc_26_1803)
self.assertEqual(night.business_date, date(2026, 7, 27))
self.assertEqual(service.next_identity(night), ("day", date(2026, 7, 27)))
self.assertEqual(service.next_identity(day), ("night", date(2026, 7, 28)))
```

Reject future business dates, inverted intervals, overlapping historical cuts,
wrong-company warehouses in the trusted-scope fixture, a second activation, and
any client-supplied company/warehouse/analytic field. Add explicitly stamped fixture
movements and prove the eligibility boundary:

```python
preview = service.preview_initial(
    employee=self.angy,
    shift_type="night",
    business_date=date(2026, 7, 27),
    start_at=utc_26_1803,
    preview_at=utc_26_2200,
)
self.assertEqual(preview["interval"], [utc_26_1803, utc_26_2200])
self.assertEqual(preview["eligible_order_ids"], [admin_pos.id, day_pos.id, night_pos.id])
self.assertEqual(preview["eligible_expense_ids"], [pwa_admin_expense.id])
self.assertNotIn(ecommerce_order.id, preview["eligible_order_ids"])
self.assertNotIn(external_order.id, preview["eligible_order_ids"])
self.assertNotIn(koldcup_expense.id, preview["eligible_expense_ids"])
```

Use these exact predicates:

- sale: trusted `company_id` and `warehouse_id`, non-null
  `x_pwa_employee_id`, state in `sale|done|cancel`, no shift link, and one of
  the two mutually exclusive provenance branches below;
- expense: trusted `company_id` and `x_warehouse_id`,
  `x_pwa_source='pwa_admin'`, non-null cash timestamp, no shift link, and that
  timestamp in `[start_at, server_at)`;
- current sale provenance: `x_pwa_cash_channel in ('admin','day','night')` plus
  non-null `x_pwa_cash_recorded_at` in `[start_at, server_at)`;
- legacy sale provenance: both new cash fields are null, `payment_method in
  ('cash','card')`, `create_date` in
  `[start_at, min(server_at, instrumentation.instrumented_at))`, and every installed
  external source marker is neutral: `x_kold_order_source` and `x_kold_source`
  are null/empty, while `x_source` is null/empty or its model default `manual`.
  `x_pwa_employee_id` is required because repository search and
  a static contract prove production code set it only in the shared
  `/pwa-admin/sale-create` endpoint used by admin/day/night POS;
- never include ecommerce, KoldHome, KoldField, consignment, B2B, KOLDCUP,
  manual expenses, an unstamped row created on/after the instrumentation
  boundary, or records merely sharing an analytic account.

`create_date` is used only by the legacy branch; it never substitutes for a
missing timestamp on/after the immutable deployment boundary. Legacy rows are
linked with report channel `legacy_pwa` rather than guessing admin/day/night
from mutable employee roles or customer names. Add `("legacy_pwa", "PWA
anterior")` to the selection and show that label in reports.
Assert rows outside the half-open interval are excluded, a row already linked
to another shift rejects activation, and duplicate IDs cannot be backfilled.
Test a pre-boundary legacy PWA order is included, while otherwise identical
post-boundary, ecommerce, KoldHome, KoldField, consignment, and unowned orders
are excluded.

- [ ] **Step 2: Run RED**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftActivation'
```

Expected: missing `preview_initial()`, `open_initial()`, and `next_identity()`.

- [ ] **Step 3: Implement activation under the branch lock**

Use one service method that:

```python
with branch_cash_shift_lock(self.env.cr, company.id, warehouse.id):
    activation_at = fields.Datetime.now()
    # lock/create config, validate [start_at, activation_at), backfill,
    # create shift, set config active atomically
```

Use server `create_date` for the one-time legacy backfill and explicit half-open
intervals. After activation, never accept editable start/end times.

The inactive API contract implemented later in Task 7 is fixed now:

```text
GET /pwa-admin/cash-shifts/preview?mode=initial&shift_type=night&business_date=2026-07-27&start_at=<ISO-UTC>
```

It returns `mode`, `config_state`, `server_preview_at`, the half-open interval,
requested shift identity, eligible sales/expenses with IDs and displayed
totals, and exclusion counts by reason. It never accepts company, warehouse, or
analytic IDs. `POST /open` re-evaluates the same domain under the branch lock
using its later authoritative `activation_at`; the preview is informative, not
a client-authoritative list.

- [ ] **Step 4: Run GREEN and commit**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftActivation'
```

```bash
git add gf_pwa_admin/models gf_pwa_admin/tests/test_pos_cash_shift.py
git commit -m "feat(cash): activate operational POS shifts"
```

### Task 4: Assign every PWA sale and expense to the active shift

**Files:**
- Modify: `gf_pwa_admin/models/sale_order.py`
- Modify: `gf_pwa_admin/models/hr_expense.py`
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/tests/test_pos_cash_shift.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Write RED assignment tests**

Through real authenticated endpoints, create:

- an admin POS sale during a night shift;
- a `pos_diurno` sale during that same night shift;
- a night POS sale;
- a PWA admin expense.

Assert all four receive the same authoritative shift ID, cash timestamp, and
correct channel. Assert forged employee/company/warehouse/analytic/shift IDs are
rejected before any row is created. Before activation, assert the endpoints
still take the branch lock and stamp PWA channel/timestamp/effect while leaving
the shift null; after activation, missing active shift returns
`cash_shift_missing` without creating a movement.

For `expense-create`, resolve the employee only from
`X-GF-Employee-Token`. Treat any payload company/warehouse/analytic value only
as a requested selector, resolve it against the employee's server-side allowed
scope, and build final ORM values from those trusted records. Never accept
payload `employee_id`, `cash_shift_id`, cash timestamp, channel, or cash effect.
Assert `x_pwa_source='pwa_admin'` is server-set.

- [ ] **Step 2: Run RED**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftAssignmentAPI'
```

Expected: endpoints do not stamp or assign through the cash-shift service.

- [ ] **Step 3: Implement the immutable assignment service**

Use the Task 1 fields. The service always takes the branch advisory lock before
checking config, stamps server `now()` and PWA channel/source, and assigns the
active shift only when config is active. The model guard permits only the first
assignment; later attempts to edit/unlink the shift, timestamp, channel, or cash
effect fail even under ordinary `sudo()`.

- [ ] **Step 4: Assign inside the same branch lock as creation**

Immediately before each `SaleOrder.create()` or `Expense.create()`:

```python
with cash_shift_service.locked_scope(company, warehouse) as assignment:
    vals.update(assignment.sale_vals(channel=pos_policy))
    order = SaleOrder.create(vals)
```

The expense path uses `expense_vals(total_amount)`. If config is active and no
open shift exists, fail before calling `create()`.

- [ ] **Step 5: Run GREEN and commit**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftAssignmentAPI'
```

Expected: all four authenticated PWA movements are stamped/assigned exactly
once, while forged and non-PWA inputs remain excluded.

```bash
git add gf_pwa_admin/models gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests
git commit -m "feat(cash): assign PWA movements to active shift"
```

### Task 5: Build authoritative previews, snapshots, cuts, and consolidation

**Files:**
- Modify: `gf_pwa_admin/models/gf_pos_cash_shift.py`
- Modify: `gf_pwa_admin/tests/test_pos_cash_shift.py`

- [ ] **Step 1: Write RED calculation tests**

Create cash/card orders, a cancelled order, expenses, product lines with and
without weight, denomination counts, and adjustment lines. Assert:

```python
self.assertEqual(preview["payments"]["cash"], 1200.0)
self.assertEqual(preview["payments"]["card"], 800.0)
self.assertEqual(preview["expenses_total"], 150.0)
self.assertEqual(preview["expected_cash"], 500 + 1200 + 25 - 150 - 10)
self.assertEqual(preview["physical_cash"], 1570.0)
self.assertEqual(preview["difference"], 5.0)
self.assertNotIn(cancelled_order.id, preview["realized_order_ids"])
self.assertIn(cancelled_order.id, preview["cancelled_order_ids"])
```

Assert product amounts use `sale.order.line.price_total`, names/SKU/weight are
snapshotted, unknown weight is flagged, and the operational consolidated report
does not sum opening funds, denominations, physical cash, or expected cash.
Persist denominations and adjustments as the linked immutable line models from
Task 1, not JSON. After closing, rename/change SKU/weight/taxes on the product
and change an expense approval state; assert detail built from the version is
unchanged. Build a deliberately duplicated-ID fixture and assert consolidation
deduplicates order, payment, expense, adjustment, and product-source IDs before
adding money or quantities.

Exercise the shared legacy thresholds `gf_cash_closing.threshold_manager` and
`gf_cash_closing.threshold_director` without copying numeric policy. Assert:

- every nonzero difference requires both a note and evidence, even below the
  manager threshold;
- a manager/director-sized difference creates one immutable pending version and
  the successor still opens at the manual boundary;
- a late manual night cut at 06:07 closes and opens day at 06:07, not 06:00;
- a `pending_auth` shift cannot be reopened;
- authorization appends rows/events but does not modify the version timestamp
  or the shift's original `closed_at`;
- the version stores normal/rec close actor, event time, evidence, reopen
  reason, previous version, and prior totals.

- [ ] **Step 2: Run RED**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftClosing'
```

Expected: preview/close/consolidate methods missing.

- [ ] **Step 3: Implement pure aggregation helpers**

Keep small methods for:

```python
_shift_orders(shift)
_shift_expenses(shift)
_payment_snapshot(orders)
_product_snapshot(orders)
_validate_denominations(items)
_validate_adjustments(items)
_calculate_cash_totals(...)
_build_version_values(...)
```

Treat every linked PWA expense's cash effect as authoritative regardless of HR
approval state. Store that state for display only. Adjustments must be positive
lines with `type`, `concept`, actor, and timestamp. Create denominations,
adjustments, and the immutable version in one transaction. Closed and pending
reads use only persisted version data; live aggregation is permitted only for
an open/reopened preview.

- [ ] **Step 4: Implement normal close vs rec close**

Normal close under lock must freeze `closed_at`, create version 1, transition to
`closed|pending_auth`, and create exactly one successor with the same boundary.
Opening the successor is independent of whether authorization remains pending.
Rec close must preserve boundaries/links, reject `next_opening_fund`, create
version N+1, and never create a successor. Reopen invalidates current
authorizations/evidence for the next result while retaining the prior version
and its evidence unchanged. Authorization is an append-only row; completion is
derived from required levels versus authorization rows and must not rewrite the
pending snapshot or its original close timestamp.

- [ ] **Step 5: Run GREEN and commit**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftClosing'
```

```bash
git add gf_pwa_admin/models/gf_pos_cash_shift.py gf_pwa_admin/tests/test_pos_cash_shift.py
git commit -m "feat(cash): snapshot and close POS shifts"
```

### Task 6: Enforce structured cancellation and expense immutability

**Files:**
- Create: `gf_pwa_admin/models/gf_pos_cash_shift_audit.py`
- Modify: `gf_pwa_admin/models/gf_pos_cash_shift.py`
- Modify: `gf_pwa_admin/models/sale_order.py`
- Modify: `gf_pwa_admin/models/hr_expense.py`
- Modify: `gf_pwa_admin/models/__init__.py`
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/security/ir.model.access.csv`
- Modify: `gf_pwa_admin/tests/test_pos_cash_shift.py`
- Modify: `gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Write RED direct-model and endpoint tests**

Assert:

- direct `sale.order.action_cancel()` fails for a linked `closed` or
  `pending_auth` shift;
- direct cancellation of a linked open/reopened shift without internal audit
  context fails;
- endpoint cancellation writes one structured audit row atomically;
- cancellation audit `write()` and `unlink()` always fail, ordinary internal
  users have no ACL, and technical system administrators are read-only;
- admin free text remains supported; day/night reason codes remain exact;
- failed `action_cancel()` leaves no audit row;
- changing amount/company/warehouse/shift/cash effect or unlinking a closed
  expense fails;
- approval/rejection fields can change without changing the cash snapshot;
- a controlled correction on `reopened` marks it dirty and its rec close creates
  the next immutable version;
- close versus cancel serializes in the documented global lock order and the
  sale is included exactly once as realized or cancelled, never both.

- [ ] **Step 2: Run RED**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftGuards'
```

Expected: audit model/guards missing.

- [ ] **Step 3: Implement structured cancellation audit**

Create one immutable row per cancelled PWA order with:

```python
order_id, shift_id, reason_code, reason_text,
cancelled_by_employee_id, cancelled_by_user_id,
cancelled_at, origin
```

Override `sale.order.action_cancel()`. For linked PWA orders, reject closed or
pending shifts and require private context such as
`gf_pwa_cancel_audit_values` plus `env.su`. A forged RPC context under an
ordinary user must still fail. Call `super()`, verify state, then create the audit
row in the same transaction. Leave unrelated orders unchanged.

For linked PWA orders, the model itself must acquire locks in this order:

```text
all branch advisory keys sorted by (company_id, warehouse_id)
-> linked shift rows sorted by ID
-> sale.order rows sorted by ID
-> cancellation audit rows
```

It may perform an initial non-locking read only to discover the branch keys;
after waiting it must invalidate/re-read and revalidate every trusted field.
The controller must remove its current sale-row-first lock so no path inverts
this order. Normal close already owns the same branch lock before snapshotting,
therefore close and cancel cannot cross the boundary ambiguously.

- [ ] **Step 4: Pass audit context from `/sale-cancel`**

Replace the current bare context with validated internal values:

```python
order.with_context(
    disable_cancel_warning=True,
    gf_pwa_cancel_audit_values={...},
).action_cancel()
```

Continue posting the human-readable chatter message, but reports must read the
structured model.

- [ ] **Step 5: Add expense write/unlink guards and commit**

Permit approval-only writes. Permit monetary correction only when the shift is
`reopened` and private service context is present. Never allow payload-controlled
context to reach this guard, and require `env.su` in addition to that context.
Monetary correction uses branch -> shift -> expense
row locking and never edits an older snapshot.

Run GREEN:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftGuards'
```

```bash
git add gf_pwa_admin
git commit -m "feat(cash): protect closed shift movements"
```

### Task 7: Expose the secured cash-shift API and legacy compatibility gate

**Files:**
- Create: `gf_pwa_admin/controllers/cash_shift_api.py`
- Modify: `gf_pwa_admin/controllers/__init__.py`
- Modify: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `gf_pwa_admin/models/gf_pos_cash_shift_audit.py`
- Modify: `gf_pwa_admin/security/ir.model.access.csv`
- Create: `gf_pwa_admin/tests/test_pos_cash_shift_api.py`
- Modify: `gf_pwa_admin/tests/__init__.py`
- Modify: `tests/test_pos_cash_shift_contract.py`

- [ ] **Step 1: Write RED permission and route-contract tests**

Cover all eight routes from the spec plus operation status. Test Angy-like permission, an auxiliary
admin without it, day POS, night POS, manager authorization in the same scope,
director scope, forged company/warehouse, missing mobile token, stale version,
future date, and missing/invalid evidence.

Lock this exact server permission matrix in tests; every row requires a valid
`X-GF-Employee-Token` and server-derived company/warehouse/analytic scope:

| Endpoint | Manage flag | Manager/director authorizer | Day/night/other |
|---|---:|---:|---:|
| `GET active` | full scoped DTO | deny | deny |
| `GET preview` (active or initial) | full scoped DTO | deny | deny |
| `POST open` | allow | deny | deny |
| `POST close` / rec close | allow | deny | deny |
| `GET history` | full scoped history | deny | deny |
| `GET detail` | full scoped version | minimum `pending_auth` detail only | deny |
| `POST reopen` | allow | deny | deny |
| `POST authorize` | only if separately authorized | required matching level | deny |
| `GET operations/status` | own scoped management operation | own scoped authorization operation | deny |
| legacy `GET cash-closing/history|detail` | scoped legacy history | deny | deny |

The minimum authorizer DTO contains shift/version IDs, scope labels, difference,
required authorization levels, note/evidence-present boolean, and existing
authorization actors; it omits ticket/customer/product/expense details and
cannot be printed. Manager requires `allow_authorize_cash_closing`; director
requires `is_direccion_general`. Neither flag implies management or general
read access. The manage flag alone does not imply authorization.

For active branches, legacy history/detail also require the manage flag and
trusted scope. Legacy authorize/reopen keep their specific existing permission
checks but must add the same token and record-scope validation. No legacy route
may browse a record by ID before applying company/warehouse/analytic scope.

Use this DTO shape in assertions:

```python
{
    "shift": {"id": 10, "type": "night", "business_date": "2026-07-27", "state": "open", "version": 0},
    "period": {"opened_at": "...", "closed_at": None, "timezone": "America/Mexico_City"},
    "schedule": {"expected_close": "2026-07-27 06:00:00", "overdue": False},
    "totals": {"sales_cash": 0.0, "sales_card": 0.0, "sales_total": 0.0, "expenses": 0.0, "expected_cash": 500.0},
    "products": [], "sales": [], "cancellations": [], "expenses": []
}
```

- [ ] **Step 2: Run RED**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftAPI'
python3 tests/test_pos_cash_shift_contract.py
```

Expected: routes are absent.

- [ ] **Step 3: Implement the dedicated controller**

Subclass `GFPWAAdminAPI` to reuse token, response, and trusted-scope helpers.
Expose:

```text
GET  /pwa-admin/cash-shifts/active
GET  /pwa-admin/cash-shifts/preview
POST /pwa-admin/cash-shifts/open
POST /pwa-admin/cash-shifts/close
GET  /pwa-admin/cash-shifts/history
GET  /pwa-admin/cash-shifts/detail
POST /pwa-admin/cash-shifts/reopen
POST /pwa-admin/cash-shifts/authorize
GET  /pwa-admin/cash-shifts/operations/status
```

Resolve employee/company/warehouse/analytic from the mobile token. Only the
manage flag may open/close/reopen. Existing manager/director flags may authorize
and read the minimum pending detail within trusted scope. `preview` implements
both active mode and Task 3's exact inactive `mode=initial` contract. `open`
accepts only shift type, business date, start time, opening fund, and
idempotency key; company/warehouse/analytic and movement ID lists are forbidden.

- [ ] **Step 4: Implement idempotency and secure evidence**

Create a single-use evidence record containing random token, attachment,
employee, company, warehouse, analytic scope, `shift_id`, expected shift version,
purpose `close|reclose`, MIME, size, expiry, and consumed result version. Extend
`/pwa/evidence/upload` for `context=cash_shift` to require shift ID, expected
version, and purpose and return the token. At upload, resolve the shift through
the same trusted scope and verify `open + close` or `reopened + reclose` as
appropriate. Allow only JPEG/PNG/WebP under the configured size, validate base64,
and consume the token atomically during close/reclose. Consumption requires an
exact employee/scope/shift/expected-version/purpose match after the branch and
shift locks; a token issued for a normal close cannot authorize a rec close or a
different version. Never accept an arbitrary attachment ID.

Evidence and completed idempotent-operation rows are append-only: ORM
`write()`/`unlink()` fail except the single internal evidence-consumption
transition performed under `env.su` in the same transaction as version
creation. Authorization appends its own immutable line/event to the already
immutable pending version.

Store each idempotency key with actor, operation, trusted scope, canonical
request fingerprint, state, result model/ID/version, and serialized response.
Require a key on every mutation: `open`, normal `close`, rec close, `reopen`, and
`authorize`. Same key/same body waits for/returns the original committed result;
same key/different body returns `idempotency_conflict`. A unique SQL constraint
must serialize concurrent reuse. `operations/status` accepts operation + key,
returns only the authenticated actor's scoped result, and never leaks another
actor's existence.

After the branch lock, lookup/fingerprint validation of an existing key happens
before current state/version transition validation. This is required so a
completed close can replay after its source is closed and a completed rec close
can replay after its version has advanced.

Add tests for each mutation covering same-key/same-body, same-key/different-body,
and response loss after commit. Specifically prove normal close recovery finds
the one successor, while rec-close recovery finds version N+1 even though the
active successor did not change. Evidence is consumed only once by the result
version; replaying the completed operation returns its saved response rather
than consuming it again. Also reject cross-shift, stale-version,
wrong-purpose, wrong-employee, expired, and already-consumed evidence tokens.

- [ ] **Step 5: Gate capabilities and legacy daily writes**

Add fail-closed capabilities:

```python
can_manage = bool(employee.allow_manage_pos_cash_shifts)
"cashShiftRead": can_manage,
"cashShiftManage": can_manage,
"cashShiftAuthorize": can_authorize,
"cashShiftPendingDetail": can_authorize,
"cashShiftReopen": can_manage,
"cashShiftPrint": can_manage,
```

When the branch config is active, POST `/pwa-admin/cash-closing` returns code
`legacy_cash_closing_read_only`; scoped GET/history/detail remain read-only.
The capabilities endpoint itself requires the employee token and derives all
booleans from that employee; missing/stale tokens fail closed.

- [ ] **Step 6: Run GREEN and commit**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftAPI'
python3 tests/test_pos_cash_shift_contract.py
```

```bash
git add gf_pwa_admin tests/test_pos_cash_shift_contract.py
git commit -m "feat(cash): expose secured shift closing API"
```

### Task 8: Prove committed concurrency and complete backend verification

**Files:**
- Create: `gf_pwa_admin/tests/test_pos_cash_shift_concurrency.py`
- Modify: `gf_pwa_admin/tests/__init__.py`
- Modify if a race is RED: `gf_pwa_admin/models/cash_shift_lock.py`
- Modify if a race is RED: `gf_pwa_admin/models/gf_pos_cash_shift.py`
- Modify if a race is RED: `gf_pwa_admin/models/sale_order.py`
- Modify if a race is RED: `gf_pwa_admin/models/hr_expense.py`
- Modify if a race is RED: `gf_pwa_admin/models/gf_pos_cash_shift_audit.py`
- Modify if a race is RED: `gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify if a race is RED: `gf_pwa_admin/controllers/cash_shift_api.py`

- [ ] **Step 1: Reconfirm the isolated runtime before adding races**

Task 0's runner starts PostgreSQL and recreates only the named disposable DB.
Prove the server is reachable without touching a shared database:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftAPI'
```

Expected: the API suite passes against `gf_cash_shift_test_20260727`.

- [ ] **Step 2: Write RED committed-race tests**

With independent cursors/HTTP workers, prove:

- first activation versus sale create;
- first activation versus expense create;
- normal close versus sale create;
- normal close versus expense create;
- two close requests with different idempotency keys;
- same idempotency key retried;
- same idempotency key with a different fingerprint;
- close versus cancel;
- reopen/reclose while the successor stays open.

Every movement must belong to exactly one shift; only one successor and one open
shift may exist.

- [ ] **Step 3: Run RED**

Run:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftConcurrency'
```

Expected: at least the deliberately unimplemented race assertion is RED.

- [ ] **Step 4: Fix only demonstrated serialization gaps**

Maintain the global order from Task 1. Sale/expense creation and first
activation take the branch advisory lock before reading active config. Close,
reopen, rec close, authorize, and linked cancellation take branch -> shift ->
movement rows. The cancel controller must never take the sale row first.
Idempotency inserts occur only after branch/shift locks and use their unique
constraint for same-key races. Revalidate committed company, warehouse,
analytic, state, version, and permission after every wait.

- [ ] **Step 5: Run GREEN**

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftConcurrency'
```

Expected: all committed-race tests pass using barriers/lock observation, never
`sleep()` as synchronization.

- [ ] **Step 6: Run backend regression layers**

Run the new model/API suites, existing `TestPWAAdminAPI`, existing cancel
concurrency suite, employee login tests, pure static contracts, and:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema,/gf_pwa_admin:TestPosCashShiftActivation,/gf_pwa_admin:TestPosCashShiftAssignmentAPI,/gf_pwa_admin:TestPosCashShiftClosing,/gf_pwa_admin:TestPosCashShiftGuards,/gf_pwa_admin:TestPosCashShiftAPI,/gf_pwa_admin:TestPosCashShiftConcurrency'
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPWAAdminCancelConcurrency'
tests/run_pos_cash_shift_odoo.sh '/os_api:TestEmployeeSignInSecurity'
python3 -m py_compile gf_pwa_admin/models/*.py gf_pwa_admin/controllers/*.py
/Users/sebis/Documents/odoo/GrupoFrio/.graphify-env/bin/graphify update .
python3 tests/test_gf_pwa_admin_auth_contract.py
python3 tests/test_pos_cash_shift_contract.py
```

Expected: zero failures. Graphify may refresh ignored `graphify-out/` for local
architecture validation; do not stage ignored/generated output.

- [ ] **Step 7: Commit concurrency coverage and any demonstrated fixes**

```bash
git add gf_pwa_admin/models gf_pwa_admin/controllers gf_pwa_admin/tests
git commit -m "test(cash): prove shift boundary serialization"
```

### Task 9: Add strict PWA DTOs, math, capabilities, and API wrappers

**Files:**
- Create: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/cashShiftModel.js`
- Create: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/cashShiftService.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/api.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/adminService.js`
- Create: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftModel.test.mjs`
- Create: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftApi.test.mjs`

- [ ] **Step 1: Write RED pure-model tests**

Test strict normalization, invalid IDs/dates/states, denomination math, positive
adjustment lines, no local authority over server totals, transition labels, and
Mexico schedule warnings. Exact examples:

```javascript
assert.equal(nextTransitionLabel({ type: 'night', businessDate: '2026-07-27' }), 'Cerrar Noche 27 y abrir Día 27')
assert.equal(nextTransitionLabel({ type: 'day', businessDate: '2026-07-27' }), 'Cerrar Día 27 y abrir Noche 28')
assert.equal(calculatePhysicalTotal([{ denomination: '500', count: 2 }]), 1000)
assert.throws(() => normalizeCashShift({ id: '__proto__' }), TypeError)
```

- [ ] **Step 2: Write RED wrapper and mutation-recovery tests**

Assert exact method/path/body for the eight spec endpoints plus operation
status, plus the scoped evidence-upload variant. Evidence upload sends
`context=cash_shift`, shift ID, expected version, purpose `close|reclose`, file,
and MIME; it sends no attachment ID or scope IDs. No mutation sends
company/warehouse/analytic IDs:

```text
open:      shift_type, business_date, start_at, opening_fund, idempotency_key
close:     shift_id, expected_version, denominations, adjustments, notes,
           evidence_token, next_opening_fund, idempotency_key
rec close: same as close but no next_opening_fund
reopen:    shift_id, expected_version, reason, idempotency_key
authorize: shift_id, version_id, level, idempotency_key
```

Never send expected/physical/sales totals. For every mutation, test a lost first
response, replay of the identical body/key, lookup of operation status if the
replay is also uncertain, and rejection of accidental key reuse with a changed
body. Include separate normal-close and rec-close cases.

- [ ] **Step 3: Implement minimal model and wrappers**

Add raw wrappers in `api.js`. Put generic orchestration in
`cashShiftService.js`:

```javascript
export async function mutateShiftWithRecovery(operation, input, deps) {
  const key = input.idempotencyKey || deps.createKey()
  const request = { ...input, idempotencyKey: key }
  try {
    return { status: 'completed', data: await deps.mutate(operation, request), key }
  } catch (error) {
    if (!isUncertain(error)) throw error
    try {
      return { status: 'completed', data: await deps.mutate(operation, request), key }
    } catch (replayError) {
      if (!isUncertain(replayError)) throw replayError
      const result = await deps.getOperationStatus({ operation, idempotencyKey: key })
      return recoverCommittedOperation(result, operation, key)
    }
  }
}
```

Never infer rec-close success from the active shift because its successor does
not change. If status is not yet completed, preserve the draft and key and allow
only a retry of the identical request.

Add capabilities with `false` defaults:

```javascript
cashShiftRead: false,
cashShiftManage: false,
cashShiftAuthorize: false,
cashShiftReopen: false,
cashShiftPrint: false,
```

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/cashShiftModel.test.mjs tests/cashShiftApi.test.mjs
git add src/modules/admin tests/cashShiftModel.test.mjs tests/cashShiftApi.test.mjs
git commit -m "feat(cash): add shift closing client contract"
```

### Task 10: Build permission-aware active shift and first-open UI

**Files:**
- Modify: `src/modules/admin/ScreenCierreCaja.jsx`
- Create: `src/modules/admin/components/CashShiftDashboard.jsx`
- Create: `src/modules/admin/components/CashShiftActivePanel.jsx`
- Create: `src/modules/admin/components/CashShiftFirstOpenForm.jsx`
- Create: `src/modules/admin/cashShift.css`
- Modify: `src/modules/admin/components/AdminShell.jsx`
- Modify: `src/modules/admin/ScreenAdminPanel.jsx`
- Modify: `src/lib/navModel.js`
- Create: `tests/cashShiftScreen.test.mjs`
- Create: `tests/cashShiftRouting.test.mjs`

- [ ] **Step 1: Write RED permission/navigation tests**

Assert `/admin/cierre` remains the route, its label becomes `Cortes de caja`, and
it is visible only from the server's fail-closed capabilities:

```javascript
cashShiftManage === true || cashShiftAuthorize === true
```

Héctor, `pos_diurno`, and an auxiliary admin without the explicit flag must not
see the item. A manipulated direct route may render a safe denial but must never
gain backend access. Raw legacy employee flags must not make the route visible
until the backend capability authorizes the exact mode. `cashShiftAuthorize`
renders only the pending-authorization queue/minimum detail/authorize action;
it does not render active, preview, history, print, open, close, or reopen.

- [ ] **Step 2: Write RED active/bootstrap screen tests**

Render desktop and mobile widths. Cover loading, backend capability unavailable,
missing session scope, inactive config, initial form validation, active night/day
copy, overdue warning, retry, and unmount-safe async completion.

- [ ] **Step 3: Implement one responsive screen**

Replace the divergent mobile calendar-day summary with the same authoritative
cash-shift dashboard used on desktop. Keep `AdminProvider` and `AdminShell` on
desktop; use a compact shell on mobile.

The first-open form captures only type, business date, start time, and opening
fund. It sends no company, warehouse, analytic, employee, or movement IDs. Show
the backend's inactive eligible-movement preview, its authoritative server
preview time and half-open interval, then explain that confirmation re-evaluates
eligibility under lock so a just-created PWA movement may be added safely.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/cashShiftScreen.test.mjs tests/cashShiftRouting.test.mjs
git add src/modules/admin src/lib/navModel.js tests/cashShiftScreen.test.mjs tests/cashShiftRouting.test.mjs
git commit -m "feat(cash): show active POS shift and bootstrap"
```

### Task 11: Build the cut, arqueo, evidence, and rec close workflow

**Files:**
- Create: `src/modules/admin/components/CashShiftCloseForm.jsx`
- Create: `src/modules/admin/components/CashShiftDenominations.jsx`
- Create: `src/modules/admin/components/CashShiftAdjustments.jsx`
- Modify: `src/modules/admin/components/CashShiftDashboard.jsx`
- Modify: `src/modules/admin/cashShiftService.js`
- Modify: `src/modules/admin/cashShift.css`
- Modify: `tests/cashShiftScreen.test.mjs`

- [ ] **Step 1: Write RED form/math tests**

Cover denomination integer counts, adjustment concept/positive amount, physical
total, server expected total, difference labels, note/photo gates, next opening
fund for normal close, omitted next fund for rec close, double-click lock,
idempotency reuse, and stale-version conflict.

Assert every nonzero difference blocks submission until both note and photo are
present; client-side threshold values only explain manager/director approval and
never relax that server rule. Upload the photo against the current shift,
expected version, and exact `close|reclose` purpose; discard/re-upload the token
if mode or version changes.

- [ ] **Step 2: Write RED uncertain-response recovery tests**

Simulate network failure after the backend committed. Assert the UI first
replays the identical body/key, then queries operation status only if that replay
is also uncertain, shows success once, and never generates a new key. Cover
normal close by returned successor and rec close by returned version N+1 while
the active successor remains unchanged. Add equivalent draft/key preservation
tests for open, reopen, and authorize.

- [ ] **Step 3: Implement the forms**

Render server preview sections for tickets, cash/card, products, cancellations,
expenses, and opening fund. The client may calculate physical cash for immediate
feedback but must label the server response authoritative after submit.

The final CTA must use exact copy:

```text
Cerrar Noche 27 y abrir Día 27
Cerrar Día 27 y abrir Noche 28
Volver a cerrar Noche 27
```

Do not send `next_opening_fund` in rec close mode.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/cashShiftModel.test.mjs tests/cashShiftApi.test.mjs tests/cashShiftScreen.test.mjs
git add src/modules/admin tests
git commit -m "feat(cash): close and reconcile POS shifts"
```

### Task 12: Add operational history, consolidated report, print, and legacy history

**Files:**
- Create: `src/modules/admin/components/CashShiftHistory.jsx`
- Create: `src/modules/admin/components/CashShiftPrintView.jsx`
- Create: `src/modules/admin/components/LegacyCashClosingHistory.jsx`
- Modify: `src/modules/admin/components/CashShiftDashboard.jsx`
- Modify: `src/modules/admin/cashShift.css`
- Create: `tests/cashShiftHistory.test.mjs`

- [ ] **Step 1: Write RED history/consolidation tests**

For operational date 27 assert order `Noche 27`, `Día 27`, `Consolidado 27`.
Assert unique movement IDs, combined sales/payments/expenses/products, and no
combined opening fund, denomination, expected cash, or physical cash. Differences
may appear only as `Diferencia neta de ambos turnos`.

- [ ] **Step 2: Write RED print and legacy tests**

Assert the print view contains folio, responsible person, operational date,
actual period, payment/product/expense/cancellation breakdown, denomination
count, differences, evidence/auth status, and version. Assert print CSS hides
navigation/buttons and preserves readable receipt/report width.

Assert legacy `gf.cash.closing` rows remain read-only under a clearly separate
`Cierres diarios anteriores` tab and no legacy POST control is rendered after
branch activation. The tab and its wrappers are never invoked unless
`cashShiftManage === true`; authorizer-only mode cannot view or print them.

- [ ] **Step 3: Implement history and print UI**

Use backend totals without recomputing consolidated money in the browser. Date
filters use operational `YYYY-MM-DD` in Mexico and reject future dates. Keep
the prior `getCashClosingHistory/getCashClosingDetail` wrappers only for the
legacy tab, after the capability gate; the backend independently enforces the
employee token and trusted record scope.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/cashShiftHistory.test.mjs tests/cashShiftScreen.test.mjs
git add src/modules/admin tests/cashShiftHistory.test.mjs
git commit -m "feat(cash): report and print operational shifts"
```

### Task 13: Documentation, full verification, and rollout readiness

**Files:**
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/docs/USER_MANUAL_BY_ROLE.md`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/docs/CODE_MANUAL.md`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/docs/GAPS_BACKLOG.md` only if an existing cash-closing gap changes state.
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/tests/check_pos_cash_shift_rollout.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-closings-backend/docs/validation/2026-07-27-pos-cash-shift-rollout.md`

- [ ] **Step 1: Document Angy's operating procedure**

Document first opening, normal 06:00/18:00 references, operational date example,
night/day cut, denominations, adjustments, evidence, pending authorization,
reopen/cancel/rec close, printing, and recovery after an uncertain response.

- [ ] **Step 2: Run the complete PWA gate**

Workdir: PWA worktree.

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint/build pass, no whitespace errors.

- [ ] **Step 3: Run the complete backend gate**

Workdir: Odoo worktree. Run all new tests plus existing PWA admin API,
cancellation concurrency, login, and static contracts against the disposable
database. Then run:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema,/gf_pwa_admin:TestPosCashShiftActivation,/gf_pwa_admin:TestPosCashShiftAssignmentAPI,/gf_pwa_admin:TestPosCashShiftClosing,/gf_pwa_admin:TestPosCashShiftGuards,/gf_pwa_admin:TestPosCashShiftAPI,/gf_pwa_admin:TestPosCashShiftConcurrency'
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPWAAdminAPI'
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPWAAdminCancelConcurrency'
tests/run_pos_cash_shift_odoo.sh '/os_api:TestEmployeeSignInSecurity'
python3 -m py_compile gf_pwa_admin/models/*.py gf_pwa_admin/controllers/*.py
python3 tests/test_gf_pwa_admin_auth_contract.py
python3 tests/test_pos_cash_shift_contract.py
/Users/sebis/Documents/odoo/GrupoFrio/.graphify-env/bin/graphify update .
git diff --check
```

Expected: zero failures/errors. Inspect the refreshed ignored
`graphify-out/GRAPH_REPORT.md`, but do not stage it.

- [ ] **Step 4: Perform end-to-end acceptance in a disposable DB**

Verify exact scenarios:

1. Open `Noche 27` at a simulated 26/18:00 boundary.
2. Create admin, day, and night POS sales; cash/card split is correct.
3. Create an expense; expected cash decreases.
4. Cut night with denominations and open `Día 27` atomically.
5. Create a sale after the manual boundary; it belongs to day.
6. Close day; consolidated 27 does not duplicate funds/arqueos.
7. Direct cancellation of a closed sale fails.
8. Reopen, cancel with audit, recount, and rec close without another successor.
9. Print both cut reports.
10. Confirm an unauthorized employee cannot read or mutate cuts.

- [ ] **Step 5: Add a read-only rollout checker and runbook**

`tests/check_pos_cash_shift_rollout.py` is an `odoo-bin shell` input that exits
nonzero unless module versions are installed, the partial unique index exists,
the permission field exists, and each active config has exactly one open shift
matching `active_shift_id`. It accepts no writes. The runbook records backup,
upgrade, inactive verification, activation, and post-activation queries.

- [ ] **Step 6: Commit documentation and rollout checks**

Workdir: Odoo worktree.

```bash
git add tests/check_pos_cash_shift_rollout.py docs/validation/2026-07-27-pos-cash-shift-rollout.md
git commit -m "docs(cash): add shift rollout checks"
```

Workdir: PWA worktree.

```bash
git add docs/USER_MANUAL_BY_ROLE.md docs/CODE_MANUAL.md docs/GAPS_BACKLOG.md
git commit -m "docs(cash): explain operational shift closings"
```

Only include `GAPS_BACKLOG.md` if it actually changed.

- [ ] **Step 7: Validate exact upgrade order in an Odoo.sh staging clone**

First create an Odoo.sh backup/snapshot of the staging clone. In its shell,
verify `$PGDATABASE` is the intended non-production clone, then run exactly:

```bash
test -n "${PGDATABASE:?Run inside the intended Odoo.sh staging build}"
odoo-bin -d "$PGDATABASE" -u os_api --stop-after-init --workers=0 --max-cron-threads=0
odoo-bin -d "$PGDATABASE" -u os_customer_zones --stop-after-init --workers=0 --max-cron-threads=0
odoo-bin -d "$PGDATABASE" -u gf_pwa_admin --stop-after-init --workers=0 --max-cron-threads=0
odoo-bin shell -d "$PGDATABASE" < tests/check_pos_cash_shift_rollout.py
```

Before the first opening, assert all new configs are inactive, current POS sale
and expense creation still work, legacy daily write still works, and the new
capabilities are false for everyone except the explicitly configured Angy test
employee. If any upgrade/check fails, restore the staging snapshot and redeploy
the previous backend SHA; do not release the PWA.

- [ ] **Step 8: Production-safe release and activation checklist**

1. Push Odoo branch and create the required production backup before promotion.
2. Upgrade with the same exact command order: `os_api`, then
   `os_customer_zones`, then `gf_pwa_admin`; run the read-only rollout checker.
3. In Odoo, assign `Puede administrar cortes POS por turno` to Angy's employee
   profile; do not hardcode her identity in source.
4. Verify `/pwa-admin/capabilities` with Angy's fresh mobile token and verify a
   day/night POS token receives all cash-shift capabilities as false.
5. Push/release the PWA only after the backend checks are green.
6. Have Angy sign out/in so the new permission reaches her session.
7. Immediately before activation, take a fresh backup and record the current
   open sales/expenses returned by inactive preview.
8. Open the first shift with the real operational date/start/fund, run the
   rollout checker again, and compare the actual included IDs with the preview
   plus any movements created before `activation_at`.
9. Confirm exactly one open shift, no eligible orphan movements, and legacy
   daily write now returns `legacy_cash_closing_read_only` for that branch.

Before activation, rollback is previous backend/PWA SHA plus module upgrades;
the additive unused tables may remain. After activation, do not downgrade or
restore a database blindly because new sales may already be linked. Hide the
PWA module if needed, keep the backend invariant active, preserve all movement
links, and fix forward unless an explicitly reconciled maintenance-window
restore is authorized.

Do not activate the branch before Angy is ready to perform the first opening.

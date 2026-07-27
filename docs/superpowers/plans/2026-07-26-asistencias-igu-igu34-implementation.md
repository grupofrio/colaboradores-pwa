# Iguala Attendance Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure `/asistencias` PWA module where Angélica can administer attendance and absences only for active employees assigned to analytic codes `IGU` or `IGU34`, with immutable audit history and a server-generated Excel workbook.

**Architecture:** Extend Odoo addon `gf_hr_ops` with a token-authenticated domain service, thin HTTP controllers, an immutable audit model, and an XLSX exporter. Extend the PWA with a fail-closed employee-ID gate for navigation only, a direct-Odoo transport that never falls back to n8n, pure view-model helpers, and a responsive administration screen. Odoo remains authoritative for identity, analytic scope, validation, concurrency, writes, and exports.

**Tech Stack:** Odoo 18/Python/PostgreSQL (`hr.attendance`, `x_kold.hr.falta`, `resource.calendar`, `xlsxwriter`), React 18/Vite/React Router, Node test runner, ESLint, Graphify.

---

## Execution Preconditions

This feature spans two repositories. Keep both isolated and never touch the unrelated `ayuda.py` file in the backend root.

- PWA worktree: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/asistencias-igu-igu34`
- PWA branch: `codex/asistencias-igu-igu34`
- Backend repository: `/Users/sebis/Documents/odoo/GrupoFrio`
- Backend worktree to create with `superpowers:using-git-worktrees`: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/asistencias-igu-igu34`
- Backend branch: `codex/asistencias-igu-igu34-backend`
- Approved spec: `docs/superpowers/specs/2026-07-26-asistencias-igu-igu34-angelica-design.md`

Before backend work, provision this exact local disposable Odoo 18/PostgreSQL runtime. It is deliberately isolated under `/private/tmp`; never substitute a production host or database.

```bash
export PWA_ROOT=/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/asistencias-igu-igu34
export BACKEND_ROOT=/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/asistencias-igu-igu34
export GF_ATTENDANCE_TEST_RUNTIME=/private/tmp/gf-odoo18-attendance-runtime
export GF_ODOO_BIN=/private/tmp/gf-odoo18-attendance-runtime/odoo/odoo-bin
export GF_ODOO_CORE_ADDONS=/private/tmp/gf-odoo18-attendance-runtime/odoo/addons
export GF_ODOO_TEST_DB=gf_hr_ops_attendance_test
export GF_ODOO_TEST_PGSOCKET=/private/tmp/gf-odoo18-attendance-runtime/pgsocket
export GF_ODOO_TEST_PGPORT=55432

mkdir -p "$GF_ATTENDANCE_TEST_RUNTIME" "$GF_ODOO_TEST_PGSOCKET"
git clone --depth 1 --branch 18.0 https://github.com/odoo/odoo.git "$GF_ATTENDANCE_TEST_RUNTIME/odoo"
uv venv --python 3.12 "$GF_ATTENDANCE_TEST_RUNTIME/venv"
uv pip install --python "$GF_ATTENDANCE_TEST_RUNTIME/venv/bin/python" \
  -r "$GF_ATTENDANCE_TEST_RUNTIME/odoo/requirements.txt"
uv pip install --python "$GF_ATTENDANCE_TEST_RUNTIME/venv/bin/python" \
  -r "$BACKEND_ROOT/requirements.txt"
initdb -D "$GF_ATTENDANCE_TEST_RUNTIME/pgdata" --auth=trust
pg_ctl -D "$GF_ATTENDANCE_TEST_RUNTIME/pgdata" \
  -l "$GF_ATTENDANCE_TEST_RUNTIME/postgres.log" \
  -o "-k $GF_ODOO_TEST_PGSOCKET -p $GF_ODOO_TEST_PGPORT" start
```

These provisioning commands are one-time and network access for the shallow Odoo clone/package installation requires the normal execution approval. If the directories already exist, validate and reuse them instead of cloning or initializing over them.

The local repository does not include the Enterprise `web_map` addon declared by `os_customer_zones`, and the starting `gf_logistics_ops` branch cannot install on a fresh database because legacy `_auto_init` migration code assumes its route tables already exist. Do not expand this attendance change into an unrelated logistics migration repair. For tests only, shadow `gf_logistics_ops` under `$GF_ATTENDANCE_TEST_RUNTIME/test-addons/gf_logistics_ops` with a minimal manifest depending on `hr` and the standard `analytic` addon; its model initializer must load the repository's real `gf_logistics_ops/models/gf_mobile_session.py` and `os_customer_zones/models/model_hr_employee_analytic.py` sources. This exercises the actual token implementation and exact employee analytic field required by `gf_hr_ops` without loading unrelated logistics models. Keep this shim outside Git and never deploy it. A minimal `web_map` shim may remain in the same temporary path for direct logistics diagnostics, but the attendance suite must not depend on it.

Canonical clean backend test sequence used below:

```bash
dropdb --if-exists -h "$GF_ODOO_TEST_PGSOCKET" -p "$GF_ODOO_TEST_PGPORT" "$GF_ODOO_TEST_DB"
createdb -h "$GF_ODOO_TEST_PGSOCKET" -p "$GF_ODOO_TEST_PGPORT" "$GF_ODOO_TEST_DB"
"$GF_ATTENDANCE_TEST_RUNTIME/venv/bin/python" "$GF_ODOO_BIN" -d "$GF_ODOO_TEST_DB" \
  --db_host="$GF_ODOO_TEST_PGSOCKET" --db_port="$GF_ODOO_TEST_PGPORT" \
  --addons-path="$GF_ATTENDANCE_TEST_RUNTIME/test-addons,$GF_ODOO_CORE_ADDONS,$BACKEND_ROOT" \
  --without-demo=all --test-enable --stop-after-init -i gf_hr_ops \
  --test-tags /gf_hr_ops
```

Expected: Odoo creates only the fixed local test database, exits `0`, and every `gf_hr_ops` test reports success. Recreate that one database before every RED/GREEN run so an earlier failed install cannot taint the result. Do not replace these integration tests with mocks.

## File Map

### Backend repository (`$BACKEND_ROOT`)

- Modify: `gf_hr_ops/__manifest__.py`
- Modify: `gf_hr_ops/controllers/__init__.py`
- Create: `gf_hr_ops/controllers/pwa_attendance.py`
- Modify: `gf_hr_ops/models/__init__.py`
- Create: `gf_hr_ops/models/attendance_audit.py`
- Create: `gf_hr_ops/models/pwa_attendance_service.py`
- Create: `gf_hr_ops/models/pwa_attendance_export.py`
- Create: `gf_hr_ops/data/pwa_attendance_config.xml`
- Modify: `gf_hr_ops/security/ir.model.access.csv`
- Modify: `gf_hr_ops/tests/__init__.py`
- Create: `gf_hr_ops/tests/common_attendance_pwa.py`
- Create: `gf_hr_ops/tests/test_pwa_attendance_access.py`
- Create: `gf_hr_ops/tests/test_pwa_attendance_read.py`
- Create: `gf_hr_ops/tests/test_pwa_attendance_mutations.py`
- Create: `gf_hr_ops/tests/test_pwa_absence_mutations.py`
- Create: `gf_hr_ops/tests/test_pwa_attendance_export.py`
- Create: `gf_hr_ops/tests/test_pwa_attendance_http.py`

### PWA repository (`$PWA_ROOT`)

- Modify: `.env.example`
- Modify: `src/App.jsx`
- Modify: `src/lib/api.js`
- Modify: `src/lib/navModel.js`
- Create: `src/lib/pwaHrRoute.js`
- Modify: `src/modules/registry.js`
- Create: `src/modules/asistencias/access.js`
- Create: `src/modules/asistencias/api.js`
- Create: `src/modules/asistencias/attendanceState.js`
- Create: `src/modules/asistencias/ScreenAsistencias.jsx`
- Create: `src/modules/asistencias/asistencias.css`
- Create: `src/modules/asistencias/components/AttendanceFilters.jsx`
- Create: `src/modules/asistencias/components/AttendanceSummary.jsx`
- Create: `src/modules/asistencias/components/AttendanceRows.jsx`
- Create: `src/modules/asistencias/components/AttendanceModal.jsx`
- Create: `src/modules/asistencias/components/AbsenceModal.jsx`
- Create: `src/modules/asistencias/components/AuditDrawer.jsx`
- Create: `tests/attendanceAccess.test.mjs`
- Create: `tests/attendanceRoute.test.mjs`
- Create: `tests/attendanceApi.test.mjs`
- Create: `tests/attendanceState.test.mjs`
- Create: `tests/attendanceUiContract.test.mjs`
- Modify: `docs/CODE_MANUAL.md`
- Modify: `docs/USER_MANUAL_BY_ROLE.md`

## Task 1: Add the secure backend identity and analytic-scope boundary

**Files:**
- Modify: `$BACKEND_ROOT/gf_hr_ops/__manifest__.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/data/pwa_attendance_config.xml`
- Create: `$BACKEND_ROOT/gf_hr_ops/models/pwa_attendance_service.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/models/__init__.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/common_attendance_pwa.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/test_pwa_attendance_access.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/tests/__init__.py`

- [ ] **Step 1: Write failing access and scope tests**

Create reusable fixtures for analytic accounts `IGU`, `IGU34`, and `OTHER`; active/inactive employees; Angélica as the configured manager; and mobile sessions. Tests must cover:

```python
def test_valid_manager_token_resolves_actor(self): ...
def test_missing_invalid_expired_or_other_employee_token_is_denied(self): ...
def test_scope_contains_only_active_igu_and_igu34_employees(self): ...
def test_exact_analytic_codes_do_not_match_igu_prefixes(self): ...
def test_missing_either_required_analytic_code_fails_closed(self): ...
def test_client_employee_or_analytic_values_cannot_expand_scope(self): ...
```

Run the canonical backend test command. Expected: import/test failures because the service and explicit dependency do not exist.

- [ ] **Step 2: Declare the owner dependency and configurable allowlist**

In `__manifest__.py`, add `gf_logistics_ops` to `depends` and load `data/pwa_attendance_config.xml`. Seed this non-secret setting with the approved production employee ID while keeping it editable per environment:

```xml
<record id="param_pwa_attendance_manager_employee_ids" model="ir.config_parameter">
  <field name="key">gf_hr_ops.pwa_attendance_manager_employee_ids</field>
  <field name="value">717</field>
</record>
```

Use `noupdate="1"` so module upgrades do not overwrite environment-specific changes.

- [ ] **Step 3: Implement the fail-closed domain boundary**

Create an `AbstractModel` service named `gf.hr.pwa.attendance.service`. Keep typed domain errors in the same focused file initially:

```python
class AttendancePwaError(Exception):
    def __init__(self, code, status, message, details=None): ...

class PwaAttendanceService(models.AbstractModel):
    _name = "gf.hr.pwa.attendance.service"

    REQUIRED_ANALYTIC_CODES = ("IGU", "IGU34")
    TZ_NAME = "America/Mexico_City"

    @api.model
    def authenticate_actor(self, token): ...

    @api.model
    def scope_accounts(self): ...

    @api.model
    def scope_employees(self, analytic_code=None, employee_id=None): ...

    @api.model
    def get_capabilities(self, actor): ...
```

Implementation rules:

- call `gf.employee.mobile.session.sudo().authenticate_token(token)`;
- derive the actor only from the returned session;
- parse comma-separated positive IDs from `ir.config_parameter`;
- require the actor ID in that allowlist;
- resolve all exact `account.analytic.account.code in ('IGU', 'IGU34')` matches and require at least one match for each code;
- search only active `hr.employee` rows whose `x_analytic_account_id` is one of those resolved records;
- treat client filters only as intersections of that fixed domain;
- return the approved capabilities contract (`allowed`, timezone, resolved analytic accounts, and the four feature booleans) only after manager authorization.

- [ ] **Step 4: Run tests and inspect dependency upgrade**

Run the canonical backend test command. Expected: all access tests pass and `gf_hr_ops` upgrades cleanly with `gf_logistics_ops` installed explicitly.

- [ ] **Step 5: Commit the backend boundary**

```bash
git add gf_hr_ops/__manifest__.py gf_hr_ops/data/pwa_attendance_config.xml \
  gf_hr_ops/models/__init__.py gf_hr_ops/models/pwa_attendance_service.py \
  gf_hr_ops/tests/__init__.py gf_hr_ops/tests/common_attendance_pwa.py \
  gf_hr_ops/tests/test_pwa_attendance_access.py
git commit -m "feat(hr): secure PWA attendance scope"
```

## Task 2: Build the employee-day read model and summaries

**Files:**
- Modify: `$BACKEND_ROOT/gf_hr_ops/models/pwa_attendance_service.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/test_pwa_attendance_read.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/tests/__init__.py`

- [ ] **Step 1: Write failing read-contract tests**

Cover date parsing, the 93-day cap, local day assignment, schedules, multiple segments, overnight shifts, status precedence, filters, and totals:

```python
def test_rows_are_one_employee_day_with_all_non_overlapping_segments(self): ...
def test_overnight_segment_belongs_to_mexico_check_in_day(self): ...
def test_expected_day_without_record_is_missing_not_auto_absence(self): ...
def test_employee_without_usable_calendar_is_not_scheduled(self): ...
def test_summary_invariant_for_expected_days(self):
    self.assertEqual(summary["present"] + summary["absent"] + summary["missing_expected"], summary["expected"])
def test_unscheduled_presence_and_absence_are_separate_counters(self): ...
def test_absence_open_complete_missing_status_precedence(self): ...
def test_range_filters_only_narrow_scope(self): ...
```

Run the backend tests. Expected: failures because `get_attendance_view` and serializers do not exist.

- [ ] **Step 2: Implement canonical date/time helpers**

Add helpers that:

- accept only strict `YYYY-MM-DD` dates and `date_from <= date_to`;
- cap inclusive ranges at 93 days;
- convert local day boundaries using `zoneinfo.ZoneInfo('America/Mexico_City')`;
- store/query Odoo datetimes in UTC;
- widen UTC search bounds by one day, then assign each segment by its localized `check_in.date()`;
- derive `version` from `write_date` in an unambiguous UTC ISO string.

- [ ] **Step 3: Implement expected-workday and aggregation logic**

Use the employee's `resource_calendar_id` and Odoo calendar interval APIs with leaves enabled. If no usable calendar/interval exists, do not infer attendance or absence. Build a normalized row for every in-scope employee-day, including:

```python
{
    "employee": {"id": ..., "number": ..., "name": ..., "job": ..., "analytic_code": ...},
    "date": "YYYY-MM-DD",
    "expected_workday": True,
    "attendances": [...],
    "worked_hours": 8.5,
    "absence": None,
    "status": "complete",
    "notes": "",
}
```

Serialize employee number using the established employee identifier (`registration_number` when present, otherwise `barcode`, otherwise empty). Map `x_kold.hr.falta.reason` to `absence_reason`. Do not include document bytes.

- [ ] **Step 4: Implement stable statuses and summary counters**

Apply this precedence: absence state, open segment, closed segment(s), `missing_expected`, `not_scheduled`. Count `incomplete` as diagnostic rather than an additive category and calculate hours only from closed segments. Sort rows by local date descending, analytic code, then employee name/ID for deterministic responses.

- [ ] **Step 5: Run tests and commit**

Run the canonical backend test command. Expected: all read and prior tests pass.

```bash
git add gf_hr_ops/models/pwa_attendance_service.py \
  gf_hr_ops/tests/__init__.py gf_hr_ops/tests/test_pwa_attendance_read.py
git commit -m "feat(hr): aggregate Iguala attendance days"
```

## Task 3: Add immutable audit and attendance mutations

**Files:**
- Create: `$BACKEND_ROOT/gf_hr_ops/models/attendance_audit.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/models/__init__.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/models/pwa_attendance_service.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/security/ir.model.access.csv`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/test_pwa_attendance_mutations.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/tests/__init__.py`

- [ ] **Step 1: Write failing audit and attendance mutation tests**

```python
def test_create_attendance_requires_reason_and_scoped_employee(self): ...
def test_create_open_or_overlapping_segment_is_rejected(self): ...
def test_patch_cannot_change_employee_and_requires_matching_version(self): ...
def test_check_out_must_follow_check_in(self): ...
def test_create_update_and_close_write_safe_before_after_audits(self): ...
def test_create_or_move_attendance_onto_absence_day_is_rejected(self): ...
def test_audit_write_and_unlink_are_forbidden(self): ...
def test_audit_failure_rolls_back_attendance_write(self): ...
def test_audit_history_is_scoped_paginated_and_stably_ordered(self): ...
```

Run backend tests. Expected: failures because the audit model and mutations are absent.

- [ ] **Step 2: Create the immutable audit model**

Define `x_kold.hr.attendance.audit` with indexed actor/target fields, constrained target models, action selection, mandatory `change_reason`, `fields.Json` before/after snapshots, UTC `changed_at`, IP, and user agent. Override `write()` and `unlink()` to raise `AccessError`. Grant the existing HR groups read-only ACL; PWA creation happens only through the scoped service under `sudo()`.

Never store attachment bytes, tokens, authorization headers, or unrelated employee fields in snapshots.

- [ ] **Step 3: Implement attendance create/update/close**

Add service methods with exact whitelists:

```python
def create_attendance(self, actor, payload, request_meta=None): ...
def update_attendance(self, actor, attendance_id, payload, request_meta=None): ...
def get_audit_history(self, actor, model, record_id, limit=25, offset=0): ...
```

Rules:

- parse explicit-offset ISO datetimes and normalize to UTC;
- require a non-blank administrative reason;
- re-resolve target scope immediately before every write;
- allow only `check_in`/`check_out` changes and never employee reassignment;
- use `write_date` optimistic concurrency for PATCH;
- reject overlap and a second segment while any prior segment remains open;
- reject creation when a falta exists on the localized `check_in` employee-day;
- when PATCH changes `check_in`, recompute the destination local employee-day and reject a falta on either the current or destination day so attendance and absence can never coexist;
- rely on normal ORM `create`/`write`, preserving native Odoo constraints;
- wrap mutation plus audit creation in one database savepoint so an audit error rolls back the write;
- choose audit action `create`, `update`, or `close` based on the transition.

- [ ] **Step 4: Implement scoped audit reads**

Allow only `hr.attendance` and `x_kold.hr.falta`, confirm the current target employee is still in scope, clamp `limit` to 1..100, clamp `offset >= 0`, and return `{total, limit, offset, rows}` ordered `changed_at desc, id desc`.

- [ ] **Step 5: Run tests and commit**

Run the canonical backend test command. Expected: all tests pass, including rollback on forced audit failure.

```bash
git add gf_hr_ops/models/attendance_audit.py gf_hr_ops/models/__init__.py \
  gf_hr_ops/models/pwa_attendance_service.py gf_hr_ops/security/ir.model.access.csv \
  gf_hr_ops/tests/__init__.py gf_hr_ops/tests/test_pwa_attendance_mutations.py
git commit -m "feat(hr): audit attendance administration"
```

## Task 4: Add absence creation and justification workflows

**Files:**
- Modify: `$BACKEND_ROOT/gf_hr_ops/models/pwa_attendance_service.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/test_pwa_absence_mutations.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/tests/__init__.py`

- [ ] **Step 1: Write failing absence tests**

Cover:

```python
def test_create_absence_maps_allowed_reasons_and_audits(self): ...
def test_duplicate_absence_returns_absence_already_exists(self): ...
def test_attendance_same_employee_day_blocks_absence(self): ...
def test_unscheduled_absence_requires_server_verified_confirmation(self): ...
def test_processed_absence_cannot_be_changed(self): ...
def test_justify_requires_fresh_version_and_reuses_existing_wizard(self): ...
def test_justify_is_attributed_to_actor_linked_odoo_user(self): ...
def test_justify_fails_if_manager_has_no_linked_odoo_user(self): ...
def test_attachment_accepts_pdf_jpeg_png_up_to_five_mib(self): ...
def test_invalid_base64_mime_extension_signature_or_size_is_rejected(self): ...
def test_absence_audit_never_contains_document_bytes(self): ...
def test_audit_failure_rolls_back_absence_or_justification(self): ...
```

Run backend tests. Expected: failures because absence service methods are missing.

- [ ] **Step 2: Implement absence creation**

Add `create_absence(actor, payload, request_meta=None)` with an exact payload whitelist. Recompute the target's expected-workday state server-side. Reject existing attendance with `409 attendance_exists_for_date`; require `confirm_unscheduled is True` for a non-working day; rely on the existing unique employee/date constraint; and record `absence_create` audit in the same savepoint.

- [ ] **Step 3: Validate optional documents defensively**

Decode with `base64.b64decode(value, validate=True)`, cap decoded bytes at `5 * 1024 * 1024`, allow only:

```python
{
    "application/pdf": (".pdf", b"%PDF-"),
    "image/jpeg": ((".jpg", ".jpeg"), b"\xff\xd8\xff"),
    "image/png": (".png", b"\x89PNG\r\n\x1a\n"),
}
```

Require document base64/name/MIME as an all-or-none group. Reject mismatches with `422 invalid_attachment` before writing anything.

- [ ] **Step 4: Reuse the justification wizard**

Add `justify_absence(actor, falta_id, payload, request_meta=None)`. Check scope, pending/editable state, and matching version. Require `actor.user_id`; otherwise fail with `503 attendance_manager_user_not_configured` before writing. Instantiate `gf.hr.falta.justify` with `with_user(actor.user_id).sudo()` and call `action_justify()` so `self.env.user`, `justified_by`, the chatter author, and message name are Angélica rather than Public User/Administrator while privileged model access remains controlled by the service. Assert `falta.justified_by == actor.user_id`. Store the validated optional document on the falta through the existing fields and create an `absence_justify` audit containing metadata only.

- [ ] **Step 5: Run tests and commit**

Run the canonical backend test command. Expected: all absence, audit, read, and existing `test_hr_falta` tests pass.

```bash
git add gf_hr_ops/models/pwa_attendance_service.py \
  gf_hr_ops/tests/__init__.py gf_hr_ops/tests/test_pwa_absence_mutations.py
git commit -m "feat(hr): manage scoped attendance absences"
```

## Task 5: Generate the three-sheet Excel workbook in Odoo

**Files:**
- Create: `$BACKEND_ROOT/gf_hr_ops/models/pwa_attendance_export.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/models/__init__.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/test_pwa_attendance_export.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/tests/__init__.py`

- [ ] **Step 1: Write failing workbook tests**

Verify the returned bytes are an Office Open XML ZIP, sheet names are exact, filters/freezes exist, workbook dates/numbers are native, the summary matches the read service, every attendance segment and absence is represented, and hostile text cannot become a formula.

```python
def test_export_is_real_xlsx_with_resumen_asistencias_faltas(self): ...
def test_export_uses_same_scoped_snapshot_and_filters_as_dashboard(self): ...
def test_export_has_one_attendance_row_per_segment(self): ...
def test_export_uses_native_date_time_and_numeric_cells(self): ...
def test_export_freezes_headers_adds_filters_and_legible_widths(self): ...
def test_formula_like_text_is_neutralized(self): ...
def test_export_excludes_documents_and_biometrics(self): ...
```

Run backend tests. Expected: failures because the exporter does not exist.

- [ ] **Step 2: Implement a focused exporter service**

Create `gf.hr.pwa.attendance.export` as an `AbstractModel`. It must call the same scoped read/snapshot helpers as the dashboard rather than duplicate domains. Use `io.BytesIO` and `xlsxwriter.Workbook(..., {'in_memory': True})`.

Create sheets in this order:

1. `Resumen`: period metadata and one row per employee;
2. `Asistencias`: one row per `hr.attendance` segment;
3. `Faltas`: one row per `x_kold.hr.falta`.

Use native `write_datetime`/`write_number`, frozen headers, autofilters, discrete formats, readable widths, and explicit text labels alongside color for absences/incomplete rows.

- [ ] **Step 3: Neutralize spreadsheet formulas**

Centralize a helper that prefixes a single quote when a user-controlled string starts with optional leading whitespace/control characters followed by `=`, `+`, `-`, or `@`. Apply it to names, job titles, reasons, notes, actor names, and observations. Do not alter actual numeric/date cells.

- [ ] **Step 4: Produce deterministic metadata and filename**

Return workbook bytes plus:

```python
filename = f"asistencias_IGU_IGU34_{date_from}_{date_to}.xlsx"
mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
```

Include generation timestamp, `America/Mexico_City`, both analytic codes, and authenticated actor in `Resumen`.

For `Asistencias`, derive `observaciones` and `responsable de la última modificación` from the latest PWA audit ordered `changed_at desc, id desc`; leave both blank for legacy records without PWA audit instead of guessing from technical `write_uid`. For `Faltas`, use the linked `justified_by` user plus justification date already maintained by the wizard.

- [ ] **Step 5: Run tests and commit**

Run the canonical backend test command. Expected: exporter and all existing tests pass.

```bash
git add gf_hr_ops/models/pwa_attendance_export.py gf_hr_ops/models/__init__.py \
  gf_hr_ops/tests/__init__.py gf_hr_ops/tests/test_pwa_attendance_export.py
git commit -m "feat(hr): export Iguala attendance workbook"
```

## Task 6: Expose thin authenticated HTTP endpoints

**Files:**
- Create: `$BACKEND_ROOT/gf_hr_ops/controllers/pwa_attendance.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/controllers/__init__.py`
- Create: `$BACKEND_ROOT/gf_hr_ops/tests/test_pwa_attendance_http.py`
- Modify: `$BACKEND_ROOT/gf_hr_ops/tests/__init__.py`

- [ ] **Step 1: Write failing HTTP contract tests**

Use `HttpCase` with real `X-GF-Employee-Token` sessions. Cover all routes, allowed methods, status codes, JSON envelopes, binary headers, and a forbidden employee:

```python
def test_capabilities_requires_valid_authorized_employee_token(self): ...
def test_get_attendance_returns_normalized_contract(self): ...
def test_create_patch_absence_justify_and_audit_routes(self): ...
def test_semantic_errors_keep_code_and_http_status(self): ...
def test_export_returns_xlsx_content_type_disposition_and_bytes(self): ...
def test_unrecognized_method_does_not_mutate_or_fall_through(self): ...
```

Run backend tests. Expected: route failures/404s.

- [ ] **Step 2: Implement shared controller plumbing**

Create an `auth='public'`, `csrf=False`, `type='http'` controller because authentication is the mobile token, not an Odoo browser session. Add small helpers for:

- extracting `X-GF-Employee-Token`;
- strict JSON-object parsing;
- request metadata (`remote_addr`, bounded user agent);
- JSON response serialization;
- translating only `AttendancePwaError` into its declared status/code;
- returning unexpected failures as sanitized `500 internal_error` without stack/PII leakage.

Do not accept actor IDs, roles, analytic domains, or sudo flags from payloads.

- [ ] **Step 3: Wire exact routes to the service**

Implement:

```text
GET   /pwa-hr/attendance/capabilities
GET   /pwa-hr/attendance
POST  /pwa-hr/attendance
PATCH /pwa-hr/attendance/<int:attendance_id>
POST  /pwa-hr/faltas
POST  /pwa-hr/faltas/<int:falta_id>/justify
GET   /pwa-hr/audit
GET   /pwa-hr/attendance/export.xlsx
```

Controllers authenticate the token, then delegate. For export, set `Content-Type`, quoted RFC-safe `Content-Disposition`, and `Content-Length`; never return partial content after exporter errors.

- [ ] **Step 4: Verify backend as one unit and refresh Graphify**

Run:

```bash
dropdb --if-exists -h "$GF_ODOO_TEST_PGSOCKET" -p "$GF_ODOO_TEST_PGPORT" "$GF_ODOO_TEST_DB"
createdb -h "$GF_ODOO_TEST_PGSOCKET" -p "$GF_ODOO_TEST_PGPORT" "$GF_ODOO_TEST_DB"
"$GF_ATTENDANCE_TEST_RUNTIME/venv/bin/python" "$GF_ODOO_BIN" -d "$GF_ODOO_TEST_DB" \
  --db_host="$GF_ODOO_TEST_PGSOCKET" --db_port="$GF_ODOO_TEST_PGPORT" \
  --addons-path="$GF_ATTENDANCE_TEST_RUNTIME/test-addons,$GF_ODOO_CORE_ADDONS,$BACKEND_ROOT" \
  --without-demo=all --test-enable --stop-after-init -i gf_hr_ops \
  --test-tags /gf_hr_ops
/Users/sebis/Documents/odoo/GrupoFrio/.graphify-env/bin/graphify update .
git diff --check
```

Expected: tests pass; Graphify refreshes the worktree's ignored local `graphify-out/` successfully; no whitespace errors. Inspect the refreshed graph report to confirm the controller remains thin and no new god node was introduced. Graphify artifacts are intentionally ignored and must not be staged.

- [ ] **Step 5: Commit the HTTP boundary and graph update**

```bash
git add gf_hr_ops/controllers/__init__.py gf_hr_ops/controllers/pwa_attendance.py \
  gf_hr_ops/tests/__init__.py gf_hr_ops/tests/test_pwa_attendance_http.py
git commit -m "feat(hr): expose attendance administration API"
```

## Task 7: Add the PWA access policy, navigation entry, and route guard

**Files:**
- Modify: `$PWA_ROOT/.env.example`
- Create: `$PWA_ROOT/src/modules/asistencias/access.js`
- Modify: `$PWA_ROOT/src/modules/registry.js`
- Modify: `$PWA_ROOT/src/lib/navModel.js`
- Modify: `$PWA_ROOT/src/App.jsx`
- Create: `$PWA_ROOT/tests/attendanceAccess.test.mjs`
- Create: `$PWA_ROOT/tests/attendanceRoute.test.mjs`

- [ ] **Step 1: Write failing pure access and wiring tests**

Test parsing and exact numeric identity, invalid sessions, unknown policy fail-closed, module visibility, entry decisions, and direct-route guard wiring:

```javascript
test('allowlist parser keeps unique positive integer employee IDs', () => {})
test('only employee 717 with a valid session gets local attendance access', () => {})
test('name, role, nested employee, or malformed IDs cannot grant access', () => {})
test('attendance accessPolicy drives home, nav, click, and route guard', () => {})
test('/asistencias is lazy loaded behind AttendanceRoute', () => {})
```

Run:

```bash
node --test --test-name-pattern='attendance access|attendance route' \
  tests/attendanceAccess.test.mjs tests/attendanceRoute.test.mjs
```

Expected: failures because the module and policy do not exist.

- [ ] **Step 2: Implement the pure local gate**

Create:

```javascript
export function parseAttendanceManagerIds(raw = '') { ... }
export function readAttendanceAccess(session, raw = import.meta.env?.VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS || '') {
  if (!isValidAuthenticatedSession(session)) return { level: 'none', reason: 'invalid_session' }
  return parseAttendanceManagerIds(raw).includes(Number(session.employee_id))
    ? { level: 'manager', reason: 'employee_allowlist' }
    : { level: 'none', reason: 'employee_not_allowed' }
}
```

Do not use employee name or roles. Permit dependency injection of the raw env string so Node tests are deterministic.

- [ ] **Step 3: Wire one canonical policy everywhere**

Add registry module `asistencias` at `/asistencias` with `accessPolicy: 'attendance_manager'`, `status: 'live'`, and an existing icon key. Extend both `isModuleVisibleForSession` and `getModuleEntryDecisionForSession` in `navModel.js` for the policy. Add `AttendanceRoute` in `App.jsx` using the same helper and lazy-load `ScreenAsistencias`.

- [ ] **Step 4: Document the public deployment ID setting**

Add to `.env.example`:

```dotenv
# UI-only allowlist; Odoo remains authoritative. Production: employee 717.
VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS=717
```

- [ ] **Step 5: Run tests and commit**

```bash
node --test --test-name-pattern='attendance access|attendance route' \
  tests/attendanceAccess.test.mjs tests/attendanceRoute.test.mjs
npm run lint
git add .env.example src/App.jsx src/lib/navModel.js src/modules/registry.js \
  src/modules/asistencias/access.js tests/attendanceAccess.test.mjs tests/attendanceRoute.test.mjs
git commit -m "feat(pwa): gate Iguala attendance module"
```

Expected: access/route tests and lint pass.

## Task 8: Add direct-Odoo attendance transport and pure view state

**Files:**
- Create: `$PWA_ROOT/src/lib/pwaHrRoute.js`
- Modify: `$PWA_ROOT/src/lib/api.js`
- Create: `$PWA_ROOT/src/modules/asistencias/api.js`
- Create: `$PWA_ROOT/src/modules/asistencias/attendanceState.js`
- Create: `$PWA_ROOT/tests/attendanceApi.test.mjs`
- Create: `$PWA_ROOT/tests/attendanceState.test.mjs`

- [ ] **Step 1: Write failing API routing and state tests**

Cover exact path/method matching, no n8n fallback, token headers, query encoding, structured errors, session expiry on invalid token, binary filename handling, date presets, validation, status labels, client-side search, action eligibility, and stale-record recovery.

```javascript
test('only exact /pwa-hr routes go directly to Odoo', () => {})
test('attendance routes never fall through to n8n', () => {})
test('X-GF-Employee-Token is included and payload cannot add actor identity', () => {})
test('xlsx returns Blob and server filename and revokes its object URL', () => {})
test('day week and custom presets use local YYYY-MM-DD values', () => {})
test('row actions enforce absence/open/closed state rules', () => {})
test('409 stale_record requests a refresh instead of blind retry', () => {})
```

Run:

```bash
node --test --test-name-pattern='attendance api|attendance state' \
  tests/attendanceApi.test.mjs tests/attendanceState.test.mjs
```

Expected: failures because transport/state modules do not exist.

- [ ] **Step 2: Add a bounded direct route recognizer**

In `pwaHrRoute.js`, export exact predicates for the eight approved endpoint shapes and methods. In `api.js`, add one `directAttendance` handler before generic business handlers. It must call the existing `odooHttp` JSON transport and throw `405 method_not_allowed` for a recognized path with the wrong method. Recognized `/pwa-hr/*` paths must never return `NO_DIRECT` and therefore never reach n8n.

Keep all attendance business mapping outside the already-large `src/lib/api.js`; only register transport and reuse existing header/error/session primitives.

- [ ] **Step 3: Add binary response support without duplicating auth**

Extract the common fetch/error part of `odooHttp` into a private helper returning `Response`, then let JSON and blob parsers share it. On `401 invalid_employee_token`, dispatch the existing session-expired flow. For XLSX return `{blob, filename}` using a safe basename parsed from `Content-Disposition`, with the spec filename as fallback.

- [ ] **Step 4: Implement the module API facade and state helpers**

Expose explicit functions:

```javascript
getCapabilities()
getAttendance(filters)
createAttendance(payload)
updateAttendance(id, payload)
createAbsence(payload)
justifyAbsence(id, payload)
getAuditHistory(model, recordId, pagination)
downloadAttendanceWorkbook(filters)
```

Whitelist outgoing fields in each mutation. `attendanceState.js` owns local date presets, strict form validation, labels, search filtering, action eligibility, filter serialization, server error-to-UX mapping, and a `needsReload(error)` helper for `stale_record`/scope changes.

- [ ] **Step 5: Run tests and commit**

```bash
node --test --test-name-pattern='attendance api|attendance state' \
  tests/attendanceApi.test.mjs tests/attendanceState.test.mjs
npm run lint
git add src/lib/api.js src/lib/pwaHrRoute.js src/modules/asistencias/api.js \
  src/modules/asistencias/attendanceState.js tests/attendanceApi.test.mjs \
  tests/attendanceState.test.mjs
git commit -m "feat(pwa): connect attendance administration API"
```

Expected: targeted tests and lint pass.

## Task 9: Build the responsive attendance administration screen

**Files:**
- Create: `$PWA_ROOT/src/modules/asistencias/ScreenAsistencias.jsx`
- Create: `$PWA_ROOT/src/modules/asistencias/asistencias.css`
- Create: `$PWA_ROOT/src/modules/asistencias/components/AttendanceFilters.jsx`
- Create: `$PWA_ROOT/src/modules/asistencias/components/AttendanceSummary.jsx`
- Create: `$PWA_ROOT/src/modules/asistencias/components/AttendanceRows.jsx`
- Create: `$PWA_ROOT/src/modules/asistencias/components/AttendanceModal.jsx`
- Create: `$PWA_ROOT/src/modules/asistencias/components/AbsenceModal.jsx`
- Create: `$PWA_ROOT/src/modules/asistencias/components/AuditDrawer.jsx`
- Create: `$PWA_ROOT/tests/attendanceUiContract.test.mjs`

- [ ] **Step 1: Write failing UI contract tests**

Without adding a second test framework, use pure exported view-model helpers plus focused source-contract checks already established in this repository. Verify:

```javascript
test('screen checks capabilities before loading attendance rows', () => {})
test('summary displays expected present absent incomplete and worked hours', () => {})
test('desktop table and mobile cards expose every segment', () => {})
test('mutation forms require employee date version and administrative reason as applicable', () => {})
test('unscheduled absence requires explicit confirmation before resend', () => {})
test('save controls stay disabled while a request is pending', () => {})
test('audit drawer uses model record ID and stable pagination', () => {})
```

Run:

```bash
node --test --test-name-pattern='attendance ui' tests/attendanceUiContract.test.mjs
```

Expected: failures because the components are absent.

- [ ] **Step 2: Implement capabilities-first screen state**

On mount:

1. call capabilities;
2. if it returns 403, show a dedicated access-denied state and never request rows;
3. if allowed, compare with the local gate for drift telemetry/display and load the current local day;
4. preserve filters after errors or mutations;
5. abort/ignore stale requests when filters change rapidly.

Use explicit `loading`, `refreshing`, `saving`, `exporting`, `error`, and modal state. After a successful mutation, close the modal, show the existing toast pattern, and refresh the current server snapshot.

- [ ] **Step 3: Build filters and summaries**

Provide Day/Week/Range presets, date bounds, `Todas`/`IGU`/`IGU34`, local employee search, state filter, and Excel action. Summary cards show:

- expected days;
- present total (`present + unscheduled_present`) with unscheduled breakdown;
- absence total (`absent + unscheduled_absent`) with unscheduled breakdown;
- incomplete diagnostic;
- worked hours.

Do not imply that `incomplete` adds to expected-day categories.

- [ ] **Step 4: Build desktop rows and mobile cards**

Render every employee-day and every segment. Contextual actions follow server state:

- no attendance/falta: `Registrar asistencia` and `Registrar falta`;
- all prior segments closed: `Agregar tramo`;
- existing segment: `Corregir horario`;
- open segment: `Registrar salida`;
- pending absence: `Justificar falta`;
- audited record: `Ver historial`.

Use semantic buttons/labels, visible focus, and text status in addition to color. Keep touch targets at least 44px. Use the module CSS file rather than expanding inline styles in `App.jsx`.

- [ ] **Step 5: Build mutation modals and audit drawer**

Attendance modal supports first segment, add segment, correction, and close modes. Absence modal supports create/justify, validates PDF/JPG/PNG <= 5 MiB before base64 conversion, and displays the unscheduled confirmation. Always show employee/date and require `change_reason`; require `version` for updates/justify. Audit drawer paginates and renders before/after values without raw JSON noise or binaries.

- [ ] **Step 6: Run targeted tests, lint, and build**

```bash
node --test --test-name-pattern='attendance ui|attendance access|attendance route|attendance api|attendance state' \
  tests/attendanceAccess.test.mjs tests/attendanceRoute.test.mjs \
  tests/attendanceApi.test.mjs tests/attendanceState.test.mjs tests/attendanceUiContract.test.mjs
npm run lint
npm run build
```

Expected: tests, lint, and production build pass.

- [ ] **Step 7: Commit the screen**

```bash
git add src/modules/asistencias/ScreenAsistencias.jsx src/modules/asistencias/asistencias.css \
  src/modules/asistencias/components tests/attendanceUiContract.test.mjs
git commit -m "feat(pwa): administer Iguala attendance"
```

## Task 10: Complete Excel download, error recovery, and documentation

**Files:**
- Modify: `$PWA_ROOT/src/modules/asistencias/ScreenAsistencias.jsx`
- Modify: `$PWA_ROOT/src/modules/asistencias/api.js`
- Modify: `$PWA_ROOT/tests/attendanceApi.test.mjs`
- Modify: `$PWA_ROOT/tests/attendanceUiContract.test.mjs`
- Modify: `$PWA_ROOT/docs/CODE_MANUAL.md`
- Modify: `$PWA_ROOT/docs/USER_MANUAL_BY_ROLE.md`

- [ ] **Step 1: Add failing end-to-end contract assertions**

Test that export uses the active filters, accepts only a non-empty XLSX blob, uses the backend filename, revokes object URLs, preserves filters on failure, prevents double clicks, and maps every documented backend code to an actionable Spanish message.

Run targeted tests. Expected: failures for any missing final wiring/messages.

- [ ] **Step 2: Finish the download lifecycle**

Keep `exporting=true` until the blob is fully received. Create one temporary anchor, click it, remove it, and call `URL.revokeObjectURL` in `finally`. Do not download on an empty/failed response. The backend workbook is the sole export source; do not recreate XLSX in the browser.

- [ ] **Step 3: Finish error recovery behavior**

Implement these outcomes:

- invalid token: use existing session expiry/logout flow;
- access denied: render denied state;
- analytic scope missing: name the missing server code;
- manager Odoo user missing: block justification and report that employee 717 must be linked to a `res.users` account before retrying;
- employee out of scope/stale record: refresh before allowing retry;
- overlap/date range/attachment errors: preserve form and focus the relevant field;
- existing absence/attendance: open or highlight the existing server row;
- export failure: preserve filters and allow retry without a partial file.

- [ ] **Step 4: Document operations and user workflow**

In `CODE_MANUAL.md`, document the eight endpoints, mobile-token authority, backend/PWA allowlists, analytic scope, timezone, versioning, audit, attachment limits, Excel contract, and deployment order. In `USER_MANUAL_BY_ROLE.md`, add an Angélica section covering filters, multiple segments, corrections, absences, justifications, history, Excel, confirmation warnings, and recovery messages.

- [ ] **Step 5: Run tests and commit**

```bash
node --test --test-name-pattern='attendance' \
  tests/attendanceAccess.test.mjs tests/attendanceRoute.test.mjs \
  tests/attendanceApi.test.mjs tests/attendanceState.test.mjs tests/attendanceUiContract.test.mjs
npm run lint
npm run build
git add src/modules/asistencias/ScreenAsistencias.jsx src/modules/asistencias/api.js \
  tests/attendanceApi.test.mjs tests/attendanceUiContract.test.mjs \
  docs/CODE_MANUAL.md docs/USER_MANUAL_BY_ROLE.md
git commit -m "docs(pwa): finalize attendance operations"
```

Expected: all attendance tests, lint, and build pass.

## Task 11: Verify both repositories and perform a backend-first staged rollout

**Files:**
- Modify only if verification exposes a real defect; otherwise no code changes.

- [ ] **Step 1: Run complete backend verification**

From `$BACKEND_ROOT`:

```bash
dropdb --if-exists -h "$GF_ODOO_TEST_PGSOCKET" -p "$GF_ODOO_TEST_PGPORT" "$GF_ODOO_TEST_DB"
createdb -h "$GF_ODOO_TEST_PGSOCKET" -p "$GF_ODOO_TEST_PGPORT" "$GF_ODOO_TEST_DB"
"$GF_ATTENDANCE_TEST_RUNTIME/venv/bin/python" "$GF_ODOO_BIN" -d "$GF_ODOO_TEST_DB" \
  --db_host="$GF_ODOO_TEST_PGSOCKET" --db_port="$GF_ODOO_TEST_PGPORT" \
  --addons-path="$GF_ATTENDANCE_TEST_RUNTIME/test-addons,$GF_ODOO_CORE_ADDONS,$BACKEND_ROOT" \
  --without-demo=all --test-enable --stop-after-init -i gf_hr_ops \
  --test-tags /gf_hr_ops
/Users/sebis/Documents/odoo/GrupoFrio/.graphify-env/bin/graphify update .
git diff --check
git status --short
```

Expected: all `gf_hr_ops` tests pass, the ignored local Graphify index is current, no whitespace errors, and only intended feature files appear in Git status.

- [ ] **Step 2: Run complete PWA verification**

From `$PWA_ROOT`:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected: the full suite (baseline was 622 tests before implementation), lint, and production build pass; only feature files appear.

- [ ] **Step 3: Verify in a staging browser with two identities**

After obtaining separate authorization for a staging deployment, deploy/upgrade backend in staging first and set both allowlists consistently. Verify:

1. Angélica's staging identity sees the module and receives `capabilities.allowed=true`;
2. employee `717` is linked to an active `res.users` account and justifications record that user;
3. another valid employee cannot see the module and receives backend denial on a direct request;
4. only active `IGU`/`IGU34` employees appear;
5. day/week/custom filters and summary invariant are correct;
6. create, add segment, correct, close, absence, unscheduled confirmation, justify, stale conflict, and history work on dedicated staging fixtures;
7. the downloaded workbook opens with `Resumen`, `Asistencias`, and `Faltas` and matches the active filters;
8. mobile cards and desktop table remain usable with keyboard/touch.

Capture evidence without employee documents, tokens, or biometric data.

- [ ] **Step 4: Prepare the production rollout and stop for explicit approval**

Prepare this production sequence as a handoff checklist, but do not execute it in the implementation session. Stop and request separate user approval for deployment and production configuration changes:

1. deploy/upgrade `gf_hr_ops`;
2. verify employee `717` is linked to an active `res.users` account;
3. set `gf_hr_ops.pwa_attendance_manager_employee_ids=717`;
4. perform read-only capability/list/export smoke checks with Angélica's authorized session;
5. set `VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS=717` in the PWA deployment environment;
6. deploy the PWA;
7. verify the module appears only for Angélica and capability/local gates agree.

Do not create, edit, justify, or delete production attendance data as part of deployment smoke tests.

- [ ] **Step 5: Record rollback and handoff**

Document this rollback for the separately authorized deployment: if access or scope is wrong, hide the PWA module by removing the frontend allowlist and deny all backend operations by clearing the backend allowlist, then redeploy the prior PWA/backend artifacts as needed. Because no production attendance records are created by rollout, rollback does not require data reversal.

Record final test commands/results, staging evidence, deployed revisions, and the two effective allowlist values in the delivery note. Use `superpowers:verification-before-completion` before claiming the feature is complete.

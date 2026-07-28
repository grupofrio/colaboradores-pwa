# Flujo determinista de liquidaciones de ruta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar un único flujo de liquidación de ruta: el vendedor valida corte y confirma liquidación, Almacén recibe los movimientos físicos, y Angélica solo pulsa **Validar** para llevar una ruta cerrada de conciliación pendiente a reconciliada.

**Architecture:** Odoo conserva la verdad de negocio (`corte_validated`, `liquidacion_done_at`, `state`, pickings y `gf.dispatch.reconciliation`). El cierre solo transiciona a `closed`; la validación administrativa recalcula y aplica los gates dentro de un savepoint antes de llamar al método canónico `action_mark_done`. La PWA consume esos campos sin deducir etapas desde `localStorage`; la cola administrativa se define por reconciliaciones pendientes, nunca por recepción de efectivo.

**Tech Stack:** Odoo 18/Python (`gf_logistics_ops`, `gf_pwa_admin`), PostgreSQL/Odoo `TransactionCase` y `HttpCase`, React 18/Vite, Node test runner y ESLint.

---

## Guardrails and workspace setup

- Keep the existing dirty files in `/Users/sebis/Documents/odoo/gf-pwa-colaboradores` untouched. Frontend work happens in `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo` on `codex/liquidaciones-flujo-completo`.
- Before backend edits, create a separate GrupoFrio worktree under `/private/tmp/grupofrio-liquidaciones-flujo-completo` from the current `GrupoFrio` branch. Do not modify the existing untracked `/Users/sebis/Documents/odoo/GrupoFrio/ayuda.py`.
- Use a disposable Odoo test database (for example `gf_liquidaciones_flow_test`), never production, for all `odoo-bin --test-enable` commands.
- Preserve existing cash-reception fields and endpoints. This change only removes cash reception from the inventory-reconciliation queue contract.

## File map

| Concern | Files |
| --- | --- |
| Route state machine and physical receipt gate | `gf_logistics_ops/models/gf_route_plan.py`, `gf_logistics_ops/models/gf_dispatch_reconciliation.py` |
| Seller endpoints | `gf_logistics_ops/controllers/gf_api.py` |
| Angélica queue and validation endpoint | `gf_pwa_admin/controllers/pwa_admin_api.py` |
| Odoo regression coverage | `gf_logistics_ops/tests/test_route_return_pickings_gate.py`, `gf_logistics_ops/tests/test_route_manager_v2.py`, `gf_pwa_admin/tests/test_pwa_admin_api.py` |
| Seller PWA state | `src/modules/ruta/routeControlService.js`, `src/modules/ruta/ScreenLiquidacion.jsx`, `src/modules/ruta/routeAutoClose.js`, `src/modules/ruta/routeCloseValidation.js` |
| Admin PWA queue | `src/modules/admin/api.js`, `src/modules/admin/forms/AdminLiquidacionesForm.jsx`, `src/modules/admin/liquidacionesResponse.js` |
| Browserless PWA tests | `tests/routeCierreState.test.mjs` (new), `tests/routeAutoClose.test.mjs`, `tests/routeCloseValidation.test.mjs`, `tests/adminLiquidacionesApi.test.mjs`, `tests/adminLiquidacionesResponse.test.mjs` |

## Implementation steps

### 1. Make close and reconciliation distinct Odoo transitions

**Files:**
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_logistics_ops/models/gf_route_plan.py`
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_logistics_ops/tests/test_route_return_pickings_gate.py`
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_logistics_ops/tests/test_route_manager_v2.py`

- [ ] **Step 1: Write failing route-transition tests.**
  - Add a fixture helper that prepares an in-progress route with a real reconciliation, a validated corte, zero inventory difference, and no returns.
  - Assert `action_close_route()` rejects that route until `liquidacion_done_at` is set and the error says the seller must confirm liquidation.
  - Assert a route with corte + `liquidacion_done_at` closes to `closed` while its reconciliation remains `draft`; it must not become `reconciled` merely because there are no returns.
  - Update current expectations that assume `action_close_route()` ends in `reconciled`/`reconciliation.done`, including `test_20_no_regression_without_returns` and the manager close tests.
  - Run (expect failure until implementation):

    ```bash
    python3 odoo-bin -d gf_liquidaciones_flow_test -u gf_logistics_ops --test-enable --stop-after-init --no-http --test-tags /gf_logistics_ops:TestRouteReturnPickingsGate,/gf_logistics_ops:TestGFLogisticsOpsRouteManagerV2
    ```

- [ ] **Step 2: Enforce the close boundary in `action_close_route`.**
  - After the existing `corte_validated` check, require `liquidacion_done_at` and raise a clear `UserError` if it is absent.
  - Keep the existing reconciliation lookup/link, inventory-difference calculation, and kilometer validation unchanged.
  - Persist only `state="closed"`, closure timestamp, and closer, then mark converted leads won.
  - Remove the call to `_try_finalize_reconciliation` from this path. Do not compensate by setting the reconciliation to done anywhere else in close logic.
  - Keep `_try_finalize_reconciliation` only if it has other callers, but remove/adjust its callers so it cannot bypass Angélica’s explicit validation; do not leave a secondary auto-finalization path.

- [ ] **Step 3: Verify the model transition.**
  - Re-run the focused command from Step 1 and confirm the new behavior passes.
  - Run syntax validation:

    ```bash
    python3 -m py_compile gf_logistics_ops/models/gf_route_plan.py gf_logistics_ops/models/gf_dispatch_reconciliation.py
    ```

- [ ] **Step 4: Commit the isolated model transition.**

  ```bash
  git add gf_logistics_ops/models/gf_route_plan.py gf_logistics_ops/tests/test_route_return_pickings_gate.py gf_logistics_ops/tests/test_route_manager_v2.py
  git commit -m "fix: separate route close from reconciliation validation"
  ```

### 2. Make the physical-receipt gate diagnostic, transactional, and idempotent

**Files:**
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_logistics_ops/models/gf_route_plan.py`
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_logistics_ops/models/gf_dispatch_reconciliation.py`
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_logistics_ops/tests/test_route_return_pickings_gate.py`

- [ ] **Step 1: Add failing gate tests before changing helpers.**
  - Cover a stale `return_receipt_state="pending"` whose linked return picking is now `done` with exact quantities; recomputing must yield `received` and permit later validation.
  - Cover `assigned`/`waiting`, `cancel`, done-underreceived, and done-overreceived pickings. Each assertion must include the picking folio, return kind, product, declared quantity, and received quantity where applicable.
  - Cover a product split over several moves/UoMs in one picking: aggregate values in the product’s canonical UoM before comparing.
  - Cover product and scrap pickings independently: a correct scrap picking cannot offset a mismatch in the product return picking.
  - Cover rollback: force a validation failure after `action_compute_lines()` and receipt-state recomputation, then assert the persisted reconciliation lines and receipt state are unchanged outside the savepoint.

- [ ] **Step 2: Extract one receipt-inspection helper on `gf.route.plan`.**
  - Refactor `_picking_reception_bucket` so the existing state result and a new structured diagnostic derive from exactly the same per-picking, per-product aggregation logic.
  - The diagnostic must distinguish `not_required`, `pending`, `cancelled`, and `mismatch`; it must carry picking name, kind (`devolución`/`merma`), product display name, declared canonical quantity, received canonical quantity, and the relevant UoM.
  - Treat `gf_return_received_with_diff`, cancelation, both under-reception and over-reception as failures. Never net values across the two linked pickings.
  - Make `_recompute_return_receipt_state()` consume that shared helper, preserving current field semantics (`not_required`, `received`, `partially_received`, `pending`, `exception`).

- [ ] **Step 3: Add a reusable prevalidation method without moving stock.**
  - Add a route/reconciliation-level method used by the admin controller that recomputes reconciliation lines and receipt state, checks every physical-picking diagnostic, then invokes the existing canonical receipt gates.
  - It must not create, validate, cancel, or modify stock pickings; it merely reads their completed quantities.
  - It must leave `action_mark_done()` as the sole transition to `reconciliation.state="done"` and `plan.state="reconciled"`.
  - Make errors deterministic and use the agreed messages: missing liquidation, open route, missing corte, and detailed pending/cancel/mismatch receipt messages.

- [ ] **Step 4: Verify helpers and focused logistics suite.**

  ```bash
  python3 odoo-bin -d gf_liquidaciones_flow_test -u gf_logistics_ops --test-enable --stop-after-init --no-http --test-tags /gf_logistics_ops:TestRouteReturnPickingsGate
  python3 -m py_compile gf_logistics_ops/models/gf_route_plan.py gf_logistics_ops/models/gf_dispatch_reconciliation.py
  ```

- [ ] **Step 5: Commit the receipt-gate work.**

  ```bash
  git add gf_logistics_ops/models/gf_route_plan.py gf_logistics_ops/models/gf_dispatch_reconciliation.py gf_logistics_ops/tests/test_route_return_pickings_gate.py
  git commit -m "fix: validate physical return receipts before reconciliation"
  ```

### 3. Redefine the Angélica API as an explicit validation queue

**Files:**
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_pwa_admin/controllers/pwa_admin_api.py`
- Modify: `/private/tmp/grupofrio-liquidaciones-flujo-completo/gf_pwa_admin/tests/test_pwa_admin_api.py`

- [ ] **Step 1: Replace cash-oriented API tests with the new contract.**
  - Keep the required-company and legacy GET/POST compatibility tests.
  - Replace the two `cash_reception_status` queue tests with tests asserting that a plan appears only when it has the same company, `liquidacion_done_at`, `state="closed"`, an existing reconciliation, and that reconciliation is not `done`.
  - Assert a closed plan without a reconciliation is excluded (legacy remediation, not a task for Angélica), a reconciled plan is excluded even with `cash_reception_status="pending"`, and a cash-validated plan still appears if inventory validation remains pending.
  - Add endpoint tests for the stable failure cases (open route, missing liquidation, missing corte, pending/cancelled/mismatched physical picking), exact successful validation, and double-click/idempotent validation.
  - Preserve the existing token/service-key identity regression test, but set the fixture through the valid seller → closed route sequence rather than relying on the old implicit auto-close behavior.

- [ ] **Step 2: Change `/pwa-admin/liquidaciones/pending`.**
  - Build the domain from company, `liquidacion_done_at != False`, `state = "closed"`, `reconciliation_id != False`, and `reconciliation_id.state != "done"`.
  - Retain supported company/warehouse/date/limit parsing, but remove all `reception_status` handling and every `cash_reception_status` condition from this endpoint and response.
  - Keep the historical default date window only if it remains the existing admin list contract; document it in the endpoint comment and test it explicitly. Do not use a cash field to decide inclusion.

- [ ] **Step 3: Make `/pwa-admin/liquidaciones/validate` a safe transition.**
  - Resolve the authenticated employee as today so the mobile-token identity behavior remains intact.
  - Before any recompute/write, load the reconciliation and short-circuit only when `plan.state == "reconciled"` and `rec.state == "done"`; return `ok: true`, `already_validated: true`, and no recalculation or timestamp write.
  - For all other requests, reject anything except `state == "closed"`, a validated corte, a confirmed seller liquidation, and an existing reconciliation. Do not auto-close an `in_progress` plan and do not write `corte_validated` in this endpoint.
  - Run the prevalidation from Step 2 inside `with request.env.cr.savepoint():`; call `rec.action_mark_done()` only after all gates pass. Let a gate exception escape the savepoint so its line/state writes roll back, then serialize it through `_safe_json` as the existing JSON-RPC error envelope.
  - Return success with plan/reconciliation states and `already_validated: false`; do not mutate cash-reception fields or inventory movements.

- [ ] **Step 4: Verify Odoo controller behavior.**

  ```bash
  python3 odoo-bin -d gf_liquidaciones_flow_test -u gf_logistics_ops,gf_pwa_admin --test-enable --stop-after-init --no-http --test-tags /gf_pwa_admin:TestPWAAdminAPI,/gf_logistics_ops:TestRouteReturnPickingsGate
  python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
  ```

- [ ] **Step 5: Commit the API contract.**

  ```bash
  git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
  git commit -m "fix: queue only pending route reconciliations"
  ```

### 4. Remove client-side false positives for seller liquidation

**Files:**
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/src/modules/ruta/routeControlService.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/src/modules/ruta/ScreenLiquidacion.jsx`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/src/modules/ruta/routeAutoClose.js`
- Add: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/tests/routeCierreState.test.mjs`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/tests/routeAutoClose.test.mjs`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/tests/routeCloseValidation.test.mjs`

- [ ] **Step 1: Write frontend state tests first.**
  - Test `getCierreState` with a plan in `closed` and then `reconciled` but no `liquidacion_done_at`: `liquidacionDone` must be false regardless of a stale localStorage cache that says true.
  - Test a plan containing `liquidacion_done_at`: it must become true, including when it is already reconciled (the recovery path for `RPLAN/2026/00759`).
  - Test the closing validator blocks a missing backend liquidation and allows the normal sequence when corte/liquidation are truly present.
  - Test auto-close still calls close only after the confirmation endpoint has succeeded, and treats a backend-closed/reconciled plan as already closed without inventing a business state locally.

- [ ] **Step 2: Make Odoo fields win over local cache.**
  - Refactor `getCierreState` to avoid mutating cached objects. When a plan is present, derive `corteDone`, `liquidacionDone`, and route-closed flags from its Odoo fields, using `Boolean(plan.liquidacion_done_at)` as the only proof of confirmation.
  - Keep `localStorage` only as an offline/display cache when no plan was obtained; it must never override a known backend `false` value.
  - In `ScreenLiquidacion.loadData`, set the confirmed view from `p.liquidacion_done_at`, not from an inferred route state. Thus a closed/reconciled anomalous plan still exposes its normal Confirmar button and calls the existing idempotent Odoo endpoint.
  - Preserve the two-step cash-difference warning and successful auto-close behavior. Do not add a frontend-only workaround for missing inventory or receipt operations.

- [ ] **Step 3: Run focused PWA tests and quality checks.**

  ```bash
  npm test -- --test-name-pattern='cierre|liquidacion|autoClose'
  npm run lint
  ```

- [ ] **Step 4: Commit the seller-state fix.**

  ```bash
  git add src/modules/ruta/routeControlService.js src/modules/ruta/ScreenLiquidacion.jsx src/modules/ruta/routeAutoClose.js tests/routeCierreState.test.mjs tests/routeAutoClose.test.mjs tests/routeCloseValidation.test.mjs
  git commit -m "fix: derive route liquidation state from odoo"
  ```

### 5. Align the Angélica screen with the new backend contract

**Files:**
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/src/modules/admin/api.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/src/modules/admin/forms/AdminLiquidacionesForm.jsx`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/src/modules/admin/liquidacionesResponse.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/tests/adminLiquidacionesApi.test.mjs`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/liquidaciones-flujo-completo/tests/adminLiquidacionesResponse.test.mjs`

- [ ] **Step 1: Add client-contract tests.**
  - Verify the pending wrapper remains an HTTP GET with company/warehouse filters and does not send cash-reception filters.
  - Add an error-envelope fixture containing a detailed physical-receipt message and assert normalization throws that message rather than silently converting it to an empty list.
  - Add a small pure helper if needed for the post-validation response; test `already_validated` reports a non-error success and still refreshes the queue.

- [ ] **Step 2: Update wording, refresh, and error preservation.**
  - Rename user-visible queue labels to **Pendientes por validar** and make the empty state say there are no route reconciliations awaiting validation.
  - Keep a selected plan and its detail visible after a failed validation so Angélica can read the exact picking/product/quantity error. Do not switch to history on failure.
  - On success (including `already_validated`), reload Pending, clear selection, select the record in Validadas/history, and use an accurate success message (`ya estaba validada` when applicable).
  - Do not display cash-reception state as a condition or badge in this screen. Its cash summary stays informational only.

- [ ] **Step 3: Verify the admin PWA.**

  ```bash
  npm test -- --test-name-pattern='admin liquidaciones|liquidation list response'
  npm run lint
  npm run build
  ```

- [ ] **Step 4: Commit the admin-screen alignment.**

  ```bash
  git add src/modules/admin/api.js src/modules/admin/forms/AdminLiquidacionesForm.jsx src/modules/admin/liquidacionesResponse.js tests/adminLiquidacionesApi.test.mjs tests/adminLiquidacionesResponse.test.mjs
  git commit -m "fix: align admin liquidations with validation queue"
  ```

### 6. Prove the full operational flow and prepare rollout

**Files:**
- Modify only if assertions need a final regression fixture: the test files listed above.
- Review: both repository diffs and deployment configuration; do not write production data as part of automated tests.

- [ ] **Step 1: Add/finish the end-to-end Odoo regression scenario.**
  - Build an Esteban-equivalent fixture: 230 units loaded, 230 delivered, zero return/scrap, corte valid, seller liquidation confirmed, valid KM.
  - Assert this precise sequence: close produces `closed` + reconciliation `draft`; Pending returns the plan; Angélica validate produces reconciliation `done` + plan `reconciled`; Pending no longer returns it; history returns it even if cash reception is still pending.
  - Assert retrying validate is safe and does not alter pickings, reconciliation lines, liquidation confirmation fields, or cash fields.

- [ ] **Step 2: Run all relevant tests from clean worktrees.**

  ```bash
  # Backend, using only a disposable test DB
  python3 odoo-bin -d gf_liquidaciones_flow_test -u gf_logistics_ops,gf_pwa_admin --test-enable --stop-after-init --no-http --test-tags /gf_logistics_ops:TestRouteReturnPickingsGate,/gf_logistics_ops:TestGFLogisticsOpsRouteManagerV2,/gf_pwa_admin:TestPWAAdminAPI

  # Frontend
  npm test
  npm run lint
  npm run build
  ```

- [ ] **Step 3: Do a staging smoke test with the five actors/operations.**
  - On a non-production route with no return, execute Corte → seller liquidación → Cerrar ruta → verify Pending → Angélica Validar → verify history.
  - Repeat with one product return and one scrap: receive both physical pickings with exact quantities before clicking Validar.
  - Confirm that a pending/cancelled/mismatched picking blocks only the final validation and its error names the actual picking.
  - Confirm an outstanding cash reception does not make a reconciled plan reappear in Pending.

- [ ] **Step 4: Prepare commits and handoff.**
  - Keep frontend and backend commits separate because they live in different repositories; record the backend commit SHA required before deploying the frontend.
  - Review `git diff --check`, `git status --short`, and test output for both worktrees. Push/create a PR only after the user authorizes the deployment path.

## Acceptance criteria

- A route cannot close without Odoo evidence of the seller’s liquidation confirmation.
- A closed route does not auto-reconcile; Angélica’s explicit validation is the only normal way to move it to reconciled.
- Angélica sees exactly closed, liquidated routes whose existing reconciliation is not done, independently of cash reception.
- The admin validation does not create or receive inventory. It recalculates under a savepoint, blocks incomplete/cancelled/mismatched physical pickings with actionable messages, and rolls back failed recomputation writes.
- Double validation succeeds idempotently without changing stock, cash, or timestamps.
- A reconciled plan missing `liquidacion_done_at` can use the normal seller confirmation endpoint and PWA screen; closed/reconciled no longer fake a confirmation client-side.
- All focused backend tests, full PWA tests, lint, and production build pass.

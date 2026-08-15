# Fase 1 Expense Capture Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the existing PWA general-expense screen to the canonical Fase 0 catalogue, evidence, and server-authoritative creation contract.

**Architecture:** Add one small admin-domain adapter for Fase 0 expense calls instead of extending `src/lib/api.js`. The general-expense form consumes that adapter and removes client-owned accounting values and legacy attachment fallback. The fuel workflow remains isolated; POS/IVA is a separate PR.

**Tech Stack:** React 18, Vite 5, Node built-in test runner, Odoo JSON endpoints.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/modules/admin/expenseAccounting.js` | Strict adapter for catalogue, unbound evidence upload, and general-expense payload construction. |
| `src/modules/admin/forms/AdminGastosForm.jsx` | Server-approved article selector and operational-facts-only general capture. |
| `tests/expenseAccounting.test.mjs` | Contract tests for catalogue, payload, evidence, and envelopes. |
| `tests/expenseCaptureFormContract.test.mjs` | Regression against retired client accounting and attachment paths. |
| `docs/CODE_MANUAL.md` | Current expense endpoint contract. |

### Task 1: Add the Fase 0 expense adapter

**Files:**
- Create: `src/modules/admin/expenseAccounting.js`
- Create: `tests/expenseAccounting.test.mjs`

- [ ] **Step 1: Write failing catalogue and payload tests.** Test that `buildExpenseCatalogPath({ companyId: 34, warehouseId: 89, date: '2026-08-15' })` produces `/pwa-admin/expense-catalog?company_id=34&warehouse_id=89&date=2026-08-15`; test that a valid draft becomes exactly `{ product_id, name, total_amount, quantity, date, attachment_id? }`, with optional reference/description only.

- [ ] **Step 2: Verify RED.** Run `node --test tests/expenseAccounting.test.mjs`. Expected: failure because the adapter does not exist.

- [ ] **Step 3: Implement the minimal adapter.** Implement `buildExpenseCatalogPath`, `getExpenseCatalog`, `buildFase0ExpensePayload`, `uploadExpenseEvidence`, and `createFase0Expense`. Require positive IDs, valid `YYYY-MM-DD` dates, non-empty names, and positive finite amount/quantity. The adapter must call only `GET /pwa-admin/expense-catalog`, `POST /pwa/evidence/upload` with `{ context: 'expense', filename, file_base64, mime_type }`, and `POST /pwa-admin/expense-create`. It must reject malformed or `ok:false` envelopes and never send a direct link, scope, analytics, payment, tax, account, journal, employee, or branch field.

- [ ] **Step 4: Verify GREEN.** Run `node --test tests/expenseAccounting.test.mjs`. Expected: PASS.

- [ ] **Step 5: Add failing-path cases.** Cover absent scope/date, malformed catalogue, evidence missing `attachment_id`, an attempt to supply direct-link data, and a rejected creation envelope.

- [ ] **Step 6: Re-run the focused suite.** Run `node --test tests/expenseAccounting.test.mjs`. Expected: PASS.

- [ ] **Step 7: Commit.** Run `git add src/modules/admin/expenseAccounting.js tests/expenseAccounting.test.mjs` and `git commit -m "feat: add fase 0 expense capture adapter"`.

### Task 2: Move the general expense form to the canonical contract

**Files:**
- Modify: `src/modules/admin/forms/AdminGastosForm.jsx`
- Test: `tests/expenseAccounting.test.mjs`

- [ ] **Step 1: Write a failing required-evidence test.** Assert a catalogue article marked `requires_evidence` blocks submission without a receipt, and an unsuccessful create envelope keeps the entered draft.

- [ ] **Step 2: Verify RED.** Run `node --test tests/expenseAccounting.test.mjs`. Expected: FAIL because the form semantics are absent.

- [ ] **Step 3: Implement only the general-expense migration.** Load the catalogue when `companyId`, `warehouseId`, or date changes and clear the selected article when that scope changes. Render articles and their server-declared requirements. General capture must block on an empty/invalid catalogue and never use legacy fallback. Use the adapter to upload unbound evidence and create a general expense; only clear after an authenticated successful envelope. Remove general-expense UI state and payload fields for `paymentMode`, `analyticDistribution`, `company_id`, `warehouse_id`, `sucursal_code`, `payment_mode`, and the direct `attachExpense` fallback. Keep the existing fuel workflow unchanged.

- [ ] **Step 4: Verify GREEN.** Run `node --test tests/expenseAccounting.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit.** Run `git add src/modules/admin/forms/AdminGastosForm.jsx tests/expenseAccounting.test.mjs` and `git commit -m "feat: use fase 0 expense catalogue in PWA"`.

### Task 3: Lock the frontend to the new boundary

**Files:**
- Create: `tests/expenseCaptureFormContract.test.mjs`
- Modify: `src/modules/admin/forms/AdminGastosForm.jsx`

- [ ] **Step 1: Write a failing source-contract test.** Read the form and assert it imports the canonical adapter, does not import `AnalyticAccountPicker` or `attachExpense`, and does not contain `/pwa-admin/expense-categories`, `/pwa-admin/expense-dimensions`, `linked_model: 'hr.expense'`, `analytic_distribution`, `payment_mode`, `company_id`, `warehouse_id`, or `sucursal_code` in the Fase 0 general-capture path.

- [ ] **Step 2: Verify RED.** Run `node --test tests/expenseCaptureFormContract.test.mjs`. Expected: FAIL until retired paths are removed.

- [ ] **Step 3: Complete narrow cleanup.** Remove only imports/state/controls exclusive to general expenses; preserve fuel and history behavior.

- [ ] **Step 4: Verify GREEN.** Run `node --test tests/expenseAccounting.test.mjs tests/expenseCaptureFormContract.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit.** Run `git add tests/expenseCaptureFormContract.test.mjs src/modules/admin/forms/AdminGastosForm.jsx` and `git commit -m "test: lock PWA expense capture to fase 0 contract"`.

### Task 4: Align the PWA operational manual

**Files:**
- Modify: `docs/CODE_MANUAL.md`
- Test: `tests/expenseCaptureFormContract.test.mjs`

- [ ] **Step 1: Write a failing documentation assertion.** Require the manual to describe `/pwa-admin/expense-catalog`, unbound `/pwa/evidence/upload` with `context=expense`, and server-derived accounting context.

- [ ] **Step 2: Verify RED.** Run `node --test tests/expenseCaptureFormContract.test.mjs`. Expected: FAIL because the manual describes the legacy payload.

- [ ] **Step 3: Update the expense endpoint section only.** Document catalogue, capture, evidence ownership, and the prohibition on selecting dimensions or attaching directly to an existing expense.

- [ ] **Step 4: Verify GREEN.** Run `node --test tests/expenseAccounting.test.mjs tests/expenseCaptureFormContract.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit.** Run `git add docs/CODE_MANUAL.md tests/expenseCaptureFormContract.test.mjs` and `git commit -m "docs: align PWA expense capture with fase 0"`.

### Task 5: Verify and publish one PR

**Files:**
- Modify: only the files listed above.

- [ ] **Step 1: Run verification.** Run `npm test`, `npm run build`, `git diff --check`, and `git status --short`. Expected: tests and build PASS; no unexpected files.

- [ ] **Step 2: Manually compare the outgoing calls with Fase 0.** Confirm general expenses call only the catalogue, unbound evidence upload, and creation endpoints, with no client accounting or direct-link fields.

- [ ] **Step 3: Push this same branch and open a draft PR to `main`.** Run `git push -u origin codex/fase1-expense-capture`. Title: `feat: integrate fase 1 PWA expense capture with fase 0`.

- [ ] **Step 4: Wait for CI, review and staging proof.** Fix failures on this branch only. Do not merge until checks are green, review is complete, and a Finance-approved catalogue/grant fixture has exercised the flow on staging.

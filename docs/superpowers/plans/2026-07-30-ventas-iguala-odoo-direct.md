# Ventas Iguala Odoo Direct Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the Iguala sales-history screen directly to Odoo and allow only Angy (717) and Sugey (718) to see and query it.

**Architecture:** `directAdmin()` recognizes only the exact GET history route and delegates through `odooHttp`, which includes the existing API-key and employee-token headers. The PWA environment variable is a visibility gate only; Odoo's parameter is the final data authorization gate.

**Tech Stack:** React/Vite, Node built-in test runner, Vercel environment variables, Odoo JSON-RPC.

---

## File structure

- Modify: `src/lib/api.js` — exact direct-Odoo bridge for sales history.
- Modify: `tests/ventasIgualaAccess.test.mjs` — the compiled visibility gate covers 717 and 718.
- Create: `tests/ventasIgualaApi.test.mjs` — route-level regression test for Odoo URL, headers and filter allowlist.
- External configuration: Vercel `VITE_IGUALA_SALES_EMPLOYEE_IDS` and Odoo `ir.config_parameter`.

### Task 1: Lock in direct route behavior

**Files:**
- Create: `tests/ventasIgualaApi.test.mjs`
- Modify: `src/lib/api.js` in `directAdmin()`

- [ ] **Step 1: Write the failing route test**

Create a Node test that seeds `gf_session` with a valid session token, Odoo API key and employee token. Call:

```js
await api('GET', '/pwa-admin/iguala-sales-history?date_from=2026-07-29&date_to=2026-07-30&search=S25375&page=2&page_size=50&warehouse_id=89')
```

Assert the single mocked fetch is a GET to:

```text
/odoo-api/pwa-admin/iguala-sales-history?date_from=2026-07-29&date_to=2026-07-30&search=S25375&page=2&page_size=50
```

Assert it never targets `/api-n8n`, includes `Api-Key` and `X-GF-Employee-Token`, and omits `warehouse_id`.

- [ ] **Step 2: Verify the test fails**

Run:

```bash
node --test tests/ventasIgualaApi.test.mjs
```

Expected: FAIL because the current code falls through to `/api-n8n`.

- [ ] **Step 3: Add the minimal `directAdmin()` branch**

Before its generic fallthrough, add:

```js
if (cleanPath === '/pwa-admin/iguala-sales-history' && method === 'GET') {
  const allowed = new Set(['date_from', 'date_to', 'search', 'page', 'page_size'])
  const filters = {}
  for (const [key, value] of query) {
    if (allowed.has(key)) filters[key] = value
  }
  return odooHttp('GET', cleanPath, filters)
}
```

Do not add the ticket POST route: its Odoo controller has not been delivered.

- [ ] **Step 4: Verify green**

Run:

```bash
node --test tests/ventasIgualaApi.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.js tests/ventasIgualaApi.test.mjs
git commit -m "fix: route Iguala sales history directly to Odoo"
```

### Task 2: Include Sugey in the PWA visibility gate

**Files:**
- Modify: `tests/ventasIgualaAccess.test.mjs`

- [ ] **Step 1: Write the failing access assertion**

Set `VITE_IGUALA_SALES_EMPLOYEE_IDS` to `717,718` in the test bootstrap and add an active Sugey session (`employee_id: 718`). Assert the module is visible and its entry decision is `direct`.

- [ ] **Step 2: Verify the current test fails**

Run:

```bash
node --test tests/ventasIgualaAccess.test.mjs
```

Expected: FAIL until the test fixture's Vite allowlist includes 718.

- [ ] **Step 3: Apply the minimal test-fixture update**

Keep production source unchanged: it already reads the Vite variable. Update the test fixture to mirror the intended deployment configuration.

- [ ] **Step 4: Verify green**

Run:

```bash
node --test tests/ventasIgualaAccess.test.mjs
```

Expected: PASS, including Angy and Sugey.

- [ ] **Step 5: Commit**

```bash
git add tests/ventasIgualaAccess.test.mjs
git commit -m "test: cover Sugey Igualas sales access"
```

### Task 3: Configure and verify production authorization

**External configuration:**
- Vercel production variable `VITE_IGUALA_SALES_EMPLOYEE_IDS=717,718`.
- Odoo production parameter `gf_pwa_admin.iguala_sales_employee_ids=717,718`.

- [ ] **Step 1: Read current values**

Use Vercel's environment settings and Odoo JSON-RPC `ir.config_parameter.search_read` to confirm their current values before writing.

- [ ] **Step 2: Set only the intended values**

Set the Vercel variable for Production and Preview, then set the Odoo parameter with `ir.config_parameter.set_param`. Do not modify employee, warehouse, company or analytic-account records.

- [ ] **Step 3: Read back and validate**

Read the Odoo parameter back by RPC; expect exactly `717,718`. Trigger a Vercel production deployment so the compile-time variable is included.

- [ ] **Step 4: Full regression check**

Run:

```bash
npm test
git diff --check
```

Expected: all tests pass and no whitespace errors.

- [ ] **Step 5: Manual production verification**

From the PWA as Angy and Sugey, open Ventas Iguala. In Fetch/XHR confirm the history request targets `/odoo-api/pwa-admin/iguala-sales-history`; confirm Odoo returns the branch-scoped orders or its true empty response.

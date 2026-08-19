# SalesOps Server Token Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all PWA SalesOps calls through a Vercel server function that injects `GF_SALESOPS_TOKEN` without exposing it in the browser or login response.

**Architecture:** A dedicated `api/salesops.js` validates only `gf/salesops` paths, requires an employee token, forwards an explicit header allowlist, and injects the server secret. A separate fixed login relay proxies only `employee-sign-in` and redacts historical SalesOps fields from valid JSON before returning it. Vercel routes both functions ahead of generic Odoo rewrites.

**Tech Stack:** Vite SPA, Vercel Node serverless functions, native `fetch`, Node `node:test`.

---

### Task 1: Test the secure SalesOps proxy contract

**Files:**
- Create: `tests/salesOpsServerProxy.test.mjs`
- Create: `api/salesops.js`

- [ ] **Step 1: Write failing builder/handler tests**

Cover a POST request to `gf/salesops/warehouse/van_load/create_execute` with an employee token, bearer and malicious `X-GF-Token`/`Api-Key`. Assert the upstream URL is `https://grupofrio-gf.odoo.com/gf/salesops/warehouse/van_load/create_execute`, the forwarded headers contain only `Authorization`, employee token, controlled JSON content type and `X-GF-Token: server-only-test-token`; the malicious headers are absent. Assert query/body/status/content type/no-store forwarding. Mock upstream bodies and private headers that reflect `server-only-test-token` (including a non-2xx response) and assert the proxy instead emits a generic 502 without the token. Add cases for missing employee token (401), missing server secret (503), unsafe or non-SalesOps paths (404), and unsupported method (405).

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/salesOpsServerProxy.test.mjs`

Expected: FAIL because `api/salesops.js` does not exist.

- [ ] **Step 3: Implement the dedicated handler**

Create `api/salesops.js` with exported `buildSalesOpsRequest` and `createSalesOpsProxyHandler`. The handler accepts the full immutable `gf/salesops/<endpoint...>` route value. Use a fixed Odoo origin, a safe path-segment regex, a method allowlist, `URLSearchParams`, and explicit header selection. Require an employee token and `GF_SALESOPS_TOKEN`; construct `X-GF-Token` only from the environment. Serialize body only for non-GET/HEAD requests. Buffer the upstream response, never forward upstream headers, and fail closed with a generic 502 if the body or content type would contain the server secret; otherwise forward status/body and a controlled content type with `Cache-Control: no-store`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/salesOpsServerProxy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the proxy contract**

```bash
git add api/salesops.js tests/salesOpsServerProxy.test.mjs
git commit -m "feat: proxy SalesOps token through Vercel"
```

### Task 2: Test and implement the redacting login relay

**Files:**
- Create: `api/employee-sign-in.js`
- Create: `tests/employeeSignInProxy.test.mjs`

- [ ] **Step 1: Write failing relay tests**

Mock the fixed Odoo URL (`https://grupofrio-gf.odoo.com/api/employee-sign-in`) response as both a direct object and `{ jsonrpc, result }` envelope containing `gf_salesops_token`, `salesops_api_token`, and `x_gf_token`. Assert valid response fields survive but those fields do not, on both 2xx and valid non-2xx JSON. Assert client headers are not forwarded, only POST with valid JSON content is accepted, malformed/non-JSON client input is rejected, upstream non-JSON or malformed JSON containing a token marker produces a generic 502 without the marker, and every response is `application/json` with `Cache-Control: no-store`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/employeeSignInProxy.test.mjs`

Expected: FAIL because `api/employee-sign-in.js` does not exist.

- [ ] **Step 3: Implement the fixed login relay**

Create `api/employee-sign-in.js` exporting a factory for tests. Permit POST only and forward a controlled JSON body with no request header forwarding to the fixed Odoo login URL. Require a JSON content type and parse the upstream body. Redact the three SalesOps fields from the direct response and from `result` when present. On malformed/non-JSON request, malformed/non-JSON response or network error return a generic 502; never proxy upstream headers or raw content. Set controlled JSON type and `Cache-Control: no-store` on every response.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/employeeSignInProxy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the relay**

```bash
git add api/employee-sign-in.js tests/employeeSignInProxy.test.mjs
git commit -m "feat: redact SalesOps token from login relay"
```

### Task 3: Route the server functions before generic rewrites

**Files:**
- Modify: `vercel.json`
- Modify: `tests/vercelPwaProxyRouting.test.mjs`

- [ ] **Step 1: Write failing rewrite tests**

Assert `/odoo-api/gf/salesops/:proxyPath*` rewrites to `/api/salesops?path=gf/salesops/:proxyPath`, preserving the immutable prefix required by the handler, and `/api-odoo/employee-sign-in` rewrites to `/api/employee-sign-in`. Assert both entries occur before their generic Odoo rewrites.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/vercelPwaProxyRouting.test.mjs`

Expected: FAIL because the protected rewrites are absent.

- [ ] **Step 3: Add the two ordered rewrites**

Keep existing proxy and SPA behavior unchanged. Place login relay before `/api-odoo/:path*`, and SalesOps proxy before `/odoo-api/:path*`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/vercelPwaProxyRouting.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit routing**

```bash
git add vercel.json tests/vercelPwaProxyRouting.test.mjs
git commit -m "feat: route SalesOps through secure Vercel proxy"
```

### Task 4: Remove client-side SalesOps secret handling

**Files:**
- Modify: `src/lib/api.js`
- Modify: `src/screens/ScreenLogin.jsx`
- Modify: `tests/entregasPtTransferApi.test.mjs`
- Modify: `.env.example`
- Modify: `docs/USER_MANUAL_BY_ROLE.md`
- Modify: `docs/CODE_MANUAL.md`
- Modify: `docs/GAPS_BACKLOG.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write failing client tests**

Update the PT transfer fixture to contain only an employee token. Assert every SalesOps browser request keeps its employee identity but has no `X-GF-Token`. Add a source-level login test asserting `buildSessionFromOdoo` does not project any SalesOps token field.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/entregasPtTransferApi.test.mjs tests/brandLightSupervisor.test.mjs`

Expected: FAIL because the client still constructs/stores `X-GF-Token`.

- [ ] **Step 3: Remove client secret code and update documentation**

Remove token selection functions and SalesOps header injection from `api.js`, including the transfer preflight that rejects an absent browser secret. Remove the login session projection. Replace every current occurrence listed by `rg`—`.env.example`, `CLAUDE.md`, `docs/CODE_MANUAL.md`, `docs/GAPS_BACKLOG.md`, `docs/USER_MANUAL_BY_ROLE.md`, and `tests/entregasPtTransferApi.test.mjs`—with the server-only `GF_SALESOPS_TOKEN` contract or historical wording that does not prescribe the retired client token. Update operational troubleshooting to refer to the Vercel proxy configuration.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/entregasPtTransferApi.test.mjs tests/brandLightSupervisor.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit client cleanup**

```bash
git add src/lib/api.js src/screens/ScreenLogin.jsx tests/entregasPtTransferApi.test.mjs tests/brandLightSupervisor.test.mjs .env.example CLAUDE.md docs/USER_MANUAL_BY_ROLE.md docs/CODE_MANUAL.md docs/GAPS_BACKLOG.md
git commit -m "fix: keep SalesOps token server-side"
```

### Task 5: Verify the release candidate

**Files:**
- Verify: `api/salesops.js`
- Verify: `api/employee-sign-in.js`
- Verify: `vercel.json`
- Verify: `src/lib/api.js`

- [ ] **Step 1: Run all affected tests**

Run: `node --test tests/salesOpsServerProxy.test.mjs tests/employeeSignInProxy.test.mjs tests/odooPwaProxy.test.mjs tests/vercelPwaProxyRouting.test.mjs tests/entregasPtTransferApi.test.mjs tests/brandLightSupervisor.test.mjs`

Expected: PASS.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Record the known baseline exception**

Run: `npm test`

Expected: the pre-existing missing `react-test-renderer` failures remain the only failures; no proxy/login/SalesOps test failure is introduced.

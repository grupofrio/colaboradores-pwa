# Angélica Daily POS SKU Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Angélica Jaimes a one-day-at-a-time POS sales breakdown by SKU, quantity, total amount, and total weight in `Caja del día`, including historical dates.

**Architecture:** Extend the secured Odoo `/pwa-admin/today-sales` endpoint with an optional business date and a server-side product aggregation while preserving its current employee, company, warehouse, state, and channel filters. Add a focused PWA domain module for identity/date/response normalization and a self-contained responsive component that owns historical-date loading without changing the dashboard polling behavior.

**Tech Stack:** Odoo 18 Python HTTP controllers and `HttpCase`; React 18; Vite 5; Node `node:test`; CSS; Git worktrees.

---

## Scope and repository boundaries

This is one feature across two coupled repositories, not two independent
products: historical data and secure aggregation must exist before the PWA can
render it.

- PWA repository:
  `/Users/sebis/Documents/odoo/gf-pwa-colaboradores`
- Odoo repository:
  `/Users/sebis/Documents/odoo/GrupoFrio`

The Odoo implementation must branch from `origin/GrupoFrio`, because that is
the operational branch containing the current employee-token and analytic
scope implementation. `origin/main` is not an ancestor of that branch and is
over one thousand commits apart; do not transplant this endpoint change onto
the backend `main` branch.

The PWA feature must be integrated into `main`, as requested by the user.

Preserve existing unrelated workspace changes:

- modified `.gitignore`;
- untracked `scripts/__pycache__/`;
- untracked `/Users/sebis/Documents/odoo/GrupoFrio/ayuda.py`.

## File map

### Odoo

- Modify:
  `/Users/sebis/Documents/odoo/GrupoFrio/gf_pwa_admin/controllers/pwa_admin_api.py`
  - validate the requested business date;
  - calculate timezone-safe UTC bounds;
  - aggregate eligible sale lines by product;
  - keep the current secure order domain unchanged.
- Modify:
  `/Users/sebis/Documents/odoo/GrupoFrio/gf_pwa_admin/tests/test_pwa_admin_api.py`
  - cover historical dates, timezone boundaries, aggregation, missing product
    metadata, and future-date rejection through the real HTTP route.
- Create:
  `/Users/sebis/Documents/odoo/GrupoFrio/gf_pwa_admin/tests/test_today_sales_breakdown_contract.py`
  - provide a locally runnable source-contract gate when an Odoo test runtime
    is unavailable.
- Modify:
  `/Users/sebis/Documents/odoo/GrupoFrio/gf_pwa_admin/__manifest__.py`
  - bump the patch version after the endpoint contract change.

### PWA

- Create:
  `src/modules/admin/angyPosSalesBreakdown.js`
  - pure identity, date, numeric normalization, and response normalization.
- Create:
  `tests/angyPosSalesBreakdown.test.mjs`
  - unit tests for the pure domain module.
- Modify:
  `src/modules/admin/api.js`
  - add the optional `date` query parameter to `getTodaySales`.
- Modify:
  `src/lib/api.js`
  - forward `date` through the direct Odoo adapter.
- Modify:
  `tests/posAdminAuth.test.mjs`
  - verify the full request path preserves `date` and authentication headers.
- Create:
  `src/modules/admin/components/AngyPosProductBreakdown.jsx`
  - own selected date, loading, retry, empty/error states, and responsive data
    rendering.
- Create:
  `src/modules/admin/components/AngyPosProductBreakdown.css`
  - responsive table/cards styling with no new inline styles.
- Modify:
  `package.json`
- Modify:
  `package-lock.json`
  - add the React 18-compatible renderer used by behavior tests.
- Create:
  `tests/angyPosProductBreakdownUi.test.mjs`
  - exercise component loading, date changes, empty/error/retry states,
    rendered totals, and stale-response protection through Vite SSR and the
    React test renderer.
- Modify:
  `src/modules/admin/components/HubV2.jsx`
  - mount the feature only for Angélica without coupling it to dashboard
    polling.
- Modify:
  `tests/navGuards.test.mjs`
  - verify the personalized mount point and preserve the existing hub layout.

## Task 1: Create isolated worktrees and prove the baseline

**Files:**

- No production files changed.
- Worktree:
  `/private/tmp/gf-pwa-angy-pos-sku`
- Worktree:
  `/private/tmp/grupofrio-angy-pos-sku`

- [ ] **Step 1: Confirm unrelated changes before creating worktrees**

Run:

```bash
git -C /Users/sebis/Documents/odoo/gf-pwa-colaboradores status --short --branch
git -C /Users/sebis/Documents/odoo/GrupoFrio status --short --branch
```

Expected:

- PWA reports only `.gitignore`, the plan/spec work, and
  `scripts/__pycache__/` as local state.
- Odoo reports only `ayuda.py` as unrelated local state.

- [ ] **Step 2: Create the PWA feature worktree from the approved spec commit**

Run:

```bash
git -C /Users/sebis/Documents/odoo/gf-pwa-colaboradores worktree add -b codex/angy-pos-daily-sku /private/tmp/gf-pwa-angy-pos-sku 4caf80c
```

Expected: worktree created on `codex/angy-pos-daily-sku`.

- [ ] **Step 3: Create the Odoo feature worktree from the operational branch**

Run:

```bash
git -C /Users/sebis/Documents/odoo/GrupoFrio worktree add -b codex/angy-pos-daily-sku /private/tmp/grupofrio-angy-pos-sku origin/GrupoFrio
```

Expected: worktree created on the backend branch
`codex/angy-pos-daily-sku`.

- [ ] **Step 4: Run the PWA baseline**

Run:

```bash
npm test
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: all existing Node tests pass.

- [ ] **Step 5: Run backend static baselines**

Run:

```bash
python3 gf_pwa_admin/tests/test_datetime_timezone_contract.py
python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected:

- `datetime timezone contract tests: ok`;
- controller compiles without syntax errors.

## Task 2: Specify the backend historical-date and aggregation behavior

**Files:**

- Modify:
  `/private/tmp/grupofrio-angy-pos-sku/gf_pwa_admin/tests/test_pwa_admin_api.py:1-10`
- Modify:
  `/private/tmp/grupofrio-angy-pos-sku/gf_pwa_admin/tests/test_pwa_admin_api.py:450-578`
- Create:
  `/private/tmp/grupofrio-angy-pos-sku/gf_pwa_admin/tests/test_today_sales_breakdown_contract.py`

- [ ] **Step 1: Add datetime test imports**

Add:

```python
from datetime import datetime, time, timedelta

import pytz
```

Keep the existing `json`, `uuid`, `fields`, and `common` imports.

- [ ] **Step 2: Write the failing historical aggregation HTTP test**

Add this method under `# ── Today Sales ──`:

```python
def test_today_sales_supports_historical_date_and_aggregates_products(self):
    self.api_user.tz = "America/Mexico_City"
    selected_date = fields.Date.context_today(self.api_user) - timedelta(days=2)
    mexico_tz = pytz.timezone("America/Mexico_City")
    local_sale_time = mexico_tz.localize(datetime.combine(selected_date, time(23, 30)))
    utc_sale_time = local_sale_time.astimezone(pytz.UTC).replace(tzinfo=None)

    sale_tax = self.env["account.tax"].sudo().create({
        "name": "GF PWA Historical Tax 16",
        "amount": 16.0,
        "amount_type": "percent",
        "type_tax_use": "sale",
        "price_include": False,
        "company_id": self.company.id,
    })
    product = self.env["product.product"].sudo().create({
        "name": "GF PWA Historical Rolito",
        "default_code": "ROL-55",
        "type": "consu",
        "sale_ok": True,
        "list_price": 120.0,
        "weight": 5.5,
        "taxes_id": [(6, 0, [sale_tax.id])],
    })
    Sale = self.env["sale.order"].sudo().with_company(self.company)

    def create_order(quantity, amount, discount=0.0):
        vals = {
            "partner_id": self.customer.id,
            "company_id": self.company.id,
            "warehouse_id": self.warehouse.id,
            "date_order": utc_sale_time,
            "user_id": self.api_user.id,
            "order_line": [(0, 0, {
                "product_id": product.id,
                "product_uom_qty": quantity,
                "price_unit": amount,
                "discount": discount,
                "tax_id": [(6, 0, [sale_tax.id])],
            })],
        }
        if "x_pwa_employee_id" in Sale._fields:
            vals["x_pwa_employee_id"] = self.employee.id
        order = Sale.create(vals)
        order.action_confirm()
        order.date_order = utc_sale_time
        return order

    first = create_order(2.0, 120.0, discount=10.0)
    second = create_order(1.0, 120.0)

    response = self._http_json(
        f"/pwa-admin/today-sales?company_id={self.company.id}"
        f"&warehouse_id={self.warehouse.id}"
        f"&date={fields.Date.to_string(selected_date)}"
    )

    self.assertTrue(response["ok"], response.get("message"))
    data = response.get("data") or {}
    self.assertEqual(data["date"], fields.Date.to_string(selected_date))
    self.assertIn(first.id, {row["order_id"] for row in data["orders"]})
    self.assertIn(second.id, {row["order_id"] for row in data["orders"]})
    self.assertEqual(len(data["products"]), 1)
    row = data["products"][0]
    self.assertEqual(row["product_id"], product.id)
    self.assertEqual(row["sku"], "ROL-55")
    self.assertEqual(row["product_name"], product.name)
    self.assertEqual(row["quantity"], 3.0)
    self.assertAlmostEqual(row["amount_total"], 389.76)
    self.assertEqual(row["weight_per_unit_kg"], 5.5)
    self.assertAlmostEqual(row["weight_total_kg"], 16.5)
    self.assertTrue(row["weight_configured"])
    self.assertEqual(data["product_totals"], {
        "quantity": 3.0,
        "amount_total": 389.76,
        "weight_total_kg": 16.5,
        "products_without_weight": 0,
    })
```

- [ ] **Step 3: Write the failing next-day boundary test**

Add:

```python
def test_today_sales_historical_date_excludes_next_local_day(self):
    self.api_user.tz = "America/Mexico_City"
    selected_date = fields.Date.context_today(self.api_user) - timedelta(days=3)
    mexico_tz = pytz.timezone("America/Mexico_City")
    next_local = mexico_tz.localize(
        datetime.combine(selected_date + timedelta(days=1), time(0, 1))
    )
    next_utc = next_local.astimezone(pytz.UTC).replace(tzinfo=None)

    Sale = self.env["sale.order"].sudo().with_company(self.company)
    vals = {
        "partner_id": self.customer.id,
        "company_id": self.company.id,
        "warehouse_id": self.warehouse.id,
        "date_order": next_utc,
        "user_id": self.api_user.id,
        "order_line": [(0, 0, {
            "product_id": self.pos_product.id,
            "product_uom_qty": 1.0,
            "price_unit": 10.0,
        })],
    }
    if "x_pwa_employee_id" in Sale._fields:
        vals["x_pwa_employee_id"] = self.employee.id
    order = Sale.create(vals)
    order.action_confirm()
    order.date_order = next_utc

    response = self._http_json(
        f"/pwa-admin/today-sales?company_id={self.company.id}"
        f"&warehouse_id={self.warehouse.id}"
        f"&date={fields.Date.to_string(selected_date)}"
    )

    self.assertTrue(response["ok"], response.get("message"))
    self.assertNotIn(
        order.id,
        {row["order_id"] for row in (response.get("data") or {}).get("orders", [])},
    )
```

- [ ] **Step 4: Write failing validation and missing-metadata tests**

Add:

```python
def test_today_sales_rejects_invalid_and_future_dates(self):
    invalid = self._http_json(
        f"/pwa-admin/today-sales?company_id={self.company.id}"
        f"&warehouse_id={self.warehouse.id}&date=24-07-2026"
    )
    self.assertFalse(invalid["ok"])
    self.assertIn("YYYY-MM-DD", invalid["message"])

    future = fields.Date.context_today(self.api_user) + timedelta(days=1)
    future_response = self._http_json(
        f"/pwa-admin/today-sales?company_id={self.company.id}"
        f"&warehouse_id={self.warehouse.id}"
        f"&date={fields.Date.to_string(future)}"
    )
    self.assertFalse(future_response["ok"])
    self.assertIn("futuras", future_response["message"].lower())

def test_today_sales_reports_products_without_sku_or_weight(self):
    self.api_user.tz = "America/Mexico_City"
    selected_date = fields.Date.context_today(self.api_user) - timedelta(days=1)
    product = self.env["product.product"].sudo().create({
        "name": "GF PWA Product Without Metadata",
        "default_code": False,
        "type": "consu",
        "sale_ok": True,
        "list_price": 25.0,
        "weight": 0.0,
    })
    Sale = self.env["sale.order"].sudo().with_company(self.company)
    vals = {
        "partner_id": self.customer.id,
        "company_id": self.company.id,
        "warehouse_id": self.warehouse.id,
        "date_order": datetime.combine(selected_date, time(18, 0)),
        "user_id": self.api_user.id,
        "order_line": [(0, 0, {
            "product_id": product.id,
            "product_uom_qty": 4.0,
            "price_unit": 25.0,
        })],
    }
    if "x_pwa_employee_id" in Sale._fields:
        vals["x_pwa_employee_id"] = self.employee.id
    order = Sale.create(vals)
    order.action_confirm()
    order.date_order = vals["date_order"]

    response = self._http_json(
        f"/pwa-admin/today-sales?company_id={self.company.id}"
        f"&warehouse_id={self.warehouse.id}"
        f"&date={fields.Date.to_string(selected_date)}"
    )

    self.assertTrue(response["ok"], response.get("message"))
    row = next(
        item for item in response["data"]["products"]
        if item["product_id"] == product.id
    )
    self.assertEqual(row["sku"], "")
    self.assertFalse(row["weight_configured"])
    self.assertEqual(row["weight_total_kg"], 0.0)
    self.assertEqual(response["data"]["product_totals"]["products_without_weight"], 1)
```

- [ ] **Step 5: Write failing authoritative-dataset regression tests**

Strengthen the existing `test_today_sales_filters_by_company` with:

```python
self.assertEqual(
    data["date"],
    fields.Date.to_string(fields.Date.context_today(self.api_user)),
)
self.assertIn("products", data)
self.assertIn("product_totals", data)
```

This proves that omitting `date` remains backward-compatible and means today.

Add:

```python
def test_today_sales_keeps_pos_only_states_channels_and_product_lines(self):
    today = fields.Date.context_today(self.api_user)
    Sale = self.env["sale.order"].sudo().with_company(self.company)

    def create_order(*, state="draft", channel=None, website=None, section=False):
        lines = [(0, 0, {
            "product_id": self.pos_product.id,
            "product_uom_qty": 1.0,
            "price_unit": 10.0,
        })]
        if section:
            lines.append((0, 0, {
                "name": "Informacion interna",
                "display_type": "line_section",
            }))
        vals = {
            "partner_id": self.customer.id,
            "company_id": self.company.id,
            "warehouse_id": self.warehouse.id,
            "date_order": fields.Datetime.now(),
            "user_id": self.api_user.id,
            "order_line": lines,
        }
        if "x_pwa_employee_id" in Sale._fields:
            vals["x_pwa_employee_id"] = self.employee.id
        if channel is not None:
            vals["x_studio_canal_origen"] = channel
        if website is not None:
            vals["website_id"] = website.id
        order = Sale.create(vals)
        if state in ("sale", "cancel"):
            order.action_confirm()
        if state == "cancel":
            order.action_cancel()
        return order

    included = create_order(state="sale", section=True)
    draft = create_order()
    cancelled = create_order(state="cancel")
    koldhome = create_order(state="sale", channel="pwa_koldhome")
    website = self.env["website"].sudo().search([], limit=1)
    self.assertTrue(website, "website fixture requerida por el contrato POS")
    ecommerce = create_order(state="sale", website=website)

    response = self._http_json(
        f"/pwa-admin/today-sales?company_id={self.company.id}"
        f"&warehouse_id={self.warehouse.id}"
        f"&date={fields.Date.to_string(today)}"
    )

    self.assertTrue(response["ok"], response.get("message"))
    data = response.get("data") or {}
    order_ids = {row["order_id"] for row in data["orders"]}
    self.assertIn(included.id, order_ids)
    self.assertNotIn(draft.id, order_ids)
    self.assertNotIn(cancelled.id, order_ids)
    self.assertNotIn(koldhome.id, order_ids)
    self.assertNotIn(ecommerce.id, order_ids)

    product_rows = [
        row for row in data["products"]
        if row["product_id"] == self.pos_product.id
    ]
    self.assertEqual(len(product_rows), 1)
    self.assertEqual(product_rows[0]["quantity"], 1.0)
```

The quantity assertion proves that the section line was ignored. Do not weaken
or replace any existing secure-scope tests; this test is additive.

- [ ] **Step 6: Add a locally runnable failing source-contract gate**

Create
`gf_pwa_admin/tests/test_today_sales_breakdown_contract.py`:

```python
# -*- coding: utf-8 -*-
from pathlib import Path


def _controller_source():
    return (
        Path(__file__).resolve().parents[1]
        .joinpath("controllers", "pwa_admin_api.py")
        .read_text()
    )


def test_today_sales_exposes_historical_product_contract():
    source = _controller_source()
    block = source[
        source.index('    @http.route("/pwa-admin/today-sales"'):
        source.index("    # Requisitions — full CRUD")
    ]

    assert "def _requested_sales_date" in source
    assert 'params.get("date")' in source
    assert "No se permiten fechas futuras" in source
    assert "def _sales_day_utc_bounds" in source
    assert "def _sale_product_breakdown" in source
    assert "selected_date = self._requested_sales_date(params)" in block
    assert "self._sales_day_utc_bounds(selected_date)" in block
    assert "self._sale_product_breakdown(orders)" in block
    assert '"products": products' in block
    assert '"product_totals": product_totals' in block


if __name__ == "__main__":
    test_today_sales_exposes_historical_product_contract()
    print("today sales breakdown contract tests: ok")
```

- [ ] **Step 7: Run the local contract test and confirm RED**

Run:

```bash
python3 gf_pwa_admin/tests/test_today_sales_breakdown_contract.py
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected: FAIL because `params.get("date")` and the aggregation helpers do not
exist yet.

## Task 3: Implement the backend date and product aggregation

**Files:**

- Modify:
  `/private/tmp/grupofrio-angy-pos-sku/gf_pwa_admin/controllers/pwa_admin_api.py:1-10`
- Modify:
  `/private/tmp/grupofrio-angy-pos-sku/gf_pwa_admin/controllers/pwa_admin_api.py:1060-1118`
- Modify:
  `/private/tmp/grupofrio-angy-pos-sku/gf_pwa_admin/__manifest__.py:1-5`

- [ ] **Step 1: Add the backend helper methods**

Add these methods immediately above `_sale_summary`:

```python
def _requested_sales_date(self, params):
    today = fields.Date.context_today(request.env.user)
    raw = (params.get("date") or "").strip()
    if not raw:
        return today
    try:
        selected = datetime.strptime(raw, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError("Fecha invalida. Use YYYY-MM-DD.")
    if selected > today:
        raise ValidationError("No se permiten fechas futuras.")
    return selected

def _sales_day_utc_bounds(self, selected_date):
    tz_name = request.env.user.tz or "America/Mexico_City"
    try:
        local_tz = pytz.timezone(tz_name)
    except Exception:
        local_tz = self._mexico_tz
    local_start = datetime.combine(selected_date, datetime.min.time())
    local_end = datetime.combine(
        selected_date + timedelta(days=1),
        datetime.min.time(),
    )
    utc_start = local_tz.localize(local_start).astimezone(pytz.UTC).replace(tzinfo=None)
    utc_end = local_tz.localize(local_end).astimezone(pytz.UTC).replace(tzinfo=None)
    return fields.Datetime.to_string(utc_start), fields.Datetime.to_string(utc_end)

def _sale_product_breakdown(self, orders):
    buckets = {}
    for line in orders.mapped("order_line"):
        if line.display_type or not line.product_id:
            continue
        product = line.product_id
        row = buckets.setdefault(product.id, {
            "product_id": product.id,
            "sku": product.default_code or "",
            "product_name": product.name or product.display_name,
            "quantity": 0.0,
            "amount_total": 0.0,
            "weight_per_unit_kg": float(product.weight or 0.0),
            "weight_total_kg": 0.0,
            "weight_configured": bool(product.weight and product.weight > 0),
        })
        quantity = float(line.product_uom_qty or 0.0)
        row["quantity"] += quantity
        row["amount_total"] += float(line.price_total or 0.0)
        if row["weight_configured"]:
            row["weight_total_kg"] += quantity * row["weight_per_unit_kg"]

    products = sorted(
        buckets.values(),
        key=lambda row: (
            -row["quantity"],
            (row["product_name"] or "").casefold(),
            row["product_id"],
        ),
    )
    totals = {
        "quantity": sum(row["quantity"] for row in products),
        "amount_total": sum(row["amount_total"] for row in products),
        "weight_total_kg": sum(
            row["weight_total_kg"]
            for row in products
            if row["weight_configured"]
        ),
        "products_without_weight": sum(
            1 for row in products if not row["weight_configured"]
        ),
    }
    return products, totals
```

Use this import:

```python
from datetime import datetime, timedelta
```

- [ ] **Step 2: Replace the fixed-today block inside `api_today_sales`**

Use:

```python
selected_date = self._requested_sales_date(params)
today_str, tomorrow_str = self._sales_day_utc_bounds(selected_date)
```

Delete the inline `today`, `_dt`, `_td`, `_pytz`, timezone, and boundary
calculation. Keep every existing domain term and the call to
`_today_sales_employee_domain(employee, company)` unchanged.

- [ ] **Step 3: Add the aggregation to the compatible response**

After loading `orders`, add:

```python
products, product_totals = self._sale_product_breakdown(orders)
```

Return:

```python
return self._response(True, "OK", {
    "company_id": company.id,
    "date": fields.Date.to_string(selected_date),
    "warehouse_id": warehouse_id or None,
    "count": len(orders),
    "total_amount": total,
    "orders": order_items,
    "items": order_items,
    "products": products,
    "product_totals": product_totals,
})
```

- [ ] **Step 4: Bump the addon patch version**

Change:

```python
"version": "18.0.2.1.7",
```

to:

```python
"version": "18.0.2.1.8",
```

- [ ] **Step 5: Run the local backend gates**

Run:

```bash
python3 gf_pwa_admin/tests/test_today_sales_breakdown_contract.py
python3 gf_pwa_admin/tests/test_datetime_timezone_contract.py
python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected: all three commands pass.

- [ ] **Step 6: Run the real Odoo tests when a test runtime is available**

Run from the Odoo 18 runtime that normally hosts this addon:

```bash
odoo-bin -d gf_pwa_admin_test -u gf_pwa_admin --test-enable --stop-after-init --test-tags /gf_pwa_admin
```

Expected: `TestPWAAdminAPI` passes, including the new `today_sales` tests.

If no Odoo runtime or disposable `gf_pwa_admin_test` database is available,
record that limitation explicitly. Do not run this suite against the production
database.

- [ ] **Step 7: Commit the backend contract and implementation**

Run:

```bash
git add gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py gf_pwa_admin/tests/test_today_sales_breakdown_contract.py gf_pwa_admin/__manifest__.py
git commit -m "feat(pwa-admin): add daily POS product breakdown"
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected: one backend commit containing only the four scoped files.

## Task 4: Build the PWA pure domain model with TDD

**Files:**

- Create:
  `/private/tmp/gf-pwa-angy-pos-sku/tests/angyPosSalesBreakdown.test.mjs`
- Create:
  `/private/tmp/gf-pwa-angy-pos-sku/src/modules/admin/angyPosSalesBreakdown.js`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/angyPosSalesBreakdown.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createInitialBreakdownState,
  createLatestRequestTracker,
  breakdownStateReducer,
  getMexicoDateKey,
  isAngelicaJaimesSession,
  isSelectableSalesDate,
  loadPosProductBreakdown,
  normalizePosProductBreakdown,
} from '../src/modules/admin/angyPosSalesBreakdown.js'

test('identifies Angelica Jaimes with accents and additional surnames', () => {
  assert.equal(isAngelicaJaimesSession({ name: 'Angélica Jaimes Gómez' }), true)
  assert.equal(isAngelicaJaimesSession({ employee: { name: 'ANGELICA JAIMES' } }), true)
  assert.equal(isAngelicaJaimesSession({ name: 'Angélica Pérez' }), false)
  assert.equal(isAngelicaJaimesSession({ name: 'Otro gerente' }), false)
})

test('gets the business date in America/Mexico_City', () => {
  assert.equal(getMexicoDateKey(new Date('2026-07-25T05:30:00.000Z')), '2026-07-24')
  assert.equal(getMexicoDateKey(new Date('2026-07-25T06:30:00.000Z')), '2026-07-25')
})

test('allows today and historical dates but rejects future or invalid values', () => {
  assert.equal(isSelectableSalesDate('2026-07-24', '2026-07-24'), true)
  assert.equal(isSelectableSalesDate('2026-07-01', '2026-07-24'), true)
  assert.equal(isSelectableSalesDate('2026-07-25', '2026-07-24'), false)
  assert.equal(isSelectableSalesDate('24-07-2026', '2026-07-24'), false)
})

test('normalizes products and uses backend totals', () => {
  const result = normalizePosProductBreakdown({
    ok: true,
    data: {
      date: '2026-07-24',
      products: [{
        product_id: 10,
        sku: 'ROL-55',
        product_name: 'Rolito 5.5 kg',
        quantity: '3',
        amount_total: '360',
        weight_per_unit_kg: '5.5',
        weight_total_kg: '16.5',
        weight_configured: true,
      }],
      product_totals: {
        quantity: '3',
        amount_total: '360',
        weight_total_kg: '16.5',
        products_without_weight: '0',
      },
    },
  })

  assert.deepEqual(result, {
    date: '2026-07-24',
    products: [{
      productId: 10,
      sku: 'ROL-55',
      productName: 'Rolito 5.5 kg',
      quantity: 3,
      amountTotal: 360,
      weightPerUnitKg: 5.5,
      weightTotalKg: 16.5,
      weightConfigured: true,
    }],
    totals: {
      quantity: 3,
      amountTotal: 360,
      weightTotalKg: 16.5,
      productsWithoutWeight: 0,
    },
  })
})

test('calculates safe fallback totals and preserves missing weight', () => {
  const result = normalizePosProductBreakdown({
    data: {
      date: '2026-07-23',
      products: [{
        product_id: 11,
        sku: '',
        product_name: 'Producto sin peso',
        quantity: 4,
        amount_total: 100,
        weight_total_kg: 0,
        weight_configured: false,
      }],
    },
  })

  assert.equal(result.products[0].weightConfigured, false)
  assert.deepEqual(result.totals, {
    quantity: 4,
    amountTotal: 100,
    weightTotalKg: 0,
    productsWithoutWeight: 1,
  })
})

test('throws the backend message for an explicit failed envelope', () => {
  assert.throws(
    () => normalizePosProductBreakdown({ ok: false, message: 'Fecha invalida' }),
    /Fecha invalida/,
  )
})

test('drives loading, success, and error transitions through the reducer', () => {
  const initial = createInitialBreakdownState('2026-07-24')
  const loading = breakdownStateReducer(initial, { type: 'loading' })
  assert.equal(loading.loading, true)
  assert.equal(loading.error, '')

  const result = normalizePosProductBreakdown({
    data: {
      date: '2026-07-24',
      products: [{
        product_id: 10,
        product_name: 'Rolito',
        quantity: 2,
        amount_total: 200,
        weight_total_kg: 11,
        weight_configured: true,
      }],
    },
  })
  const success = breakdownStateReducer(loading, { type: 'success', result })
  assert.equal(success.loading, false)
  assert.equal(success.result.products.length, 1)

  const failed = breakdownStateReducer(success, {
    type: 'error',
    message: 'Sin conexion',
  })
  assert.equal(failed.loading, false)
  assert.equal(failed.error, 'Sin conexion')
  assert.equal(failed.result, success.result)
})

test('forwards the selected date and normalizes the loaded response', async () => {
  const calls = []
  const result = await loadPosProductBreakdown({
    warehouseId: 89,
    companyId: 34,
    date: '2026-07-23',
    fetchSales: async (args) => {
      calls.push(args)
      return { ok: true, data: { date: args.date, products: [] } }
    },
  })

  assert.deepEqual(calls, [{
    warehouseId: 89,
    companyId: 34,
    date: '2026-07-23',
  }])
  assert.equal(result.date, '2026-07-23')
})

test('latest-request tracker rejects stale responses after a date change or retry', () => {
  const tracker = createLatestRequestTracker()
  const first = tracker.begin()
  const second = tracker.begin()
  assert.equal(tracker.isCurrent(first), false)
  assert.equal(tracker.isCurrent(second), true)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/angyPosSalesBreakdown.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: FAIL because `angyPosSalesBreakdown.js` does not exist.

- [ ] **Step 3: Implement the pure domain module**

Create `src/modules/admin/angyPosSalesBreakdown.js`:

```javascript
const MEXICO_TIME_ZONE = 'America/Mexico_City'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function finiteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isAngelicaJaimesSession(session = {}) {
  const name = normalizeText([
    session?.name,
    session?.display_name,
    session?.employee?.name,
  ].filter(Boolean).join(' '))
  return name.includes('angelica') && name.includes('jaimes')
}

export function getMexicoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isSelectableSalesDate(value, today = getMexicoDateKey()) {
  return DATE_RE.test(String(value || '')) && String(value) <= String(today)
}

export function createInitialBreakdownState(date = getMexicoDateKey()) {
  return {
    loading: true,
    error: '',
    result: normalizePosProductBreakdown({ data: { date } }),
  }
}

export function breakdownStateReducer(state, action) {
  if (action?.type === 'loading') {
    return { ...state, loading: true, error: '' }
  }
  if (action?.type === 'success') {
    return { loading: false, error: '', result: action.result }
  }
  if (action?.type === 'error') {
    return {
      ...state,
      loading: false,
      error: action.message || 'No se pudo cargar el desglose POS',
    }
  }
  return state
}

export function createLatestRequestTracker() {
  let current = 0
  return {
    begin() {
      current += 1
      return current
    },
    isCurrent(requestId) {
      return requestId === current
    },
  }
}

export async function loadPosProductBreakdown({
  warehouseId,
  companyId,
  date,
  fetchSales,
}) {
  const response = await fetchSales({ warehouseId, companyId, date })
  return normalizePosProductBreakdown(response)
}

export function normalizePosProductBreakdown(response) {
  if (response?.ok === false) {
    throw new Error(response.message || response.error || 'No se pudo cargar el desglose POS')
  }
  const data = response?.data ?? response ?? {}
  const products = (Array.isArray(data.products) ? data.products : []).map((row) => ({
    productId: finiteNumber(row?.product_id),
    sku: String(row?.sku || ''),
    productName: String(row?.product_name || 'Producto'),
    quantity: finiteNumber(row?.quantity),
    amountTotal: finiteNumber(row?.amount_total),
    weightPerUnitKg: finiteNumber(row?.weight_per_unit_kg),
    weightTotalKg: finiteNumber(row?.weight_total_kg),
    weightConfigured: row?.weight_configured === true,
  }))

  const fallback = {
    quantity: products.reduce((sum, row) => sum + row.quantity, 0),
    amountTotal: products.reduce((sum, row) => sum + row.amountTotal, 0),
    weightTotalKg: products.reduce(
      (sum, row) => sum + (row.weightConfigured ? row.weightTotalKg : 0),
      0,
    ),
    productsWithoutWeight: products.filter((row) => !row.weightConfigured).length,
  }
  const incoming = data?.product_totals
  const totals = incoming && typeof incoming === 'object'
    ? {
        quantity: finiteNumber(incoming.quantity),
        amountTotal: finiteNumber(incoming.amount_total),
        weightTotalKg: finiteNumber(incoming.weight_total_kg),
        productsWithoutWeight: finiteNumber(incoming.products_without_weight),
      }
    : fallback

  return {
    date: String(data?.date || ''),
    products,
    totals,
  }
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test tests/angyPosSalesBreakdown.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: 9 tests pass.

- [ ] **Step 5: Commit the pure domain layer**

Run:

```bash
git add src/modules/admin/angyPosSalesBreakdown.js tests/angyPosSalesBreakdown.test.mjs
git commit -m "feat(admin): model Angy daily POS breakdown"
```

Expected: one PWA commit with only the helper and its tests.

## Task 5: Forward the selected date through every PWA adapter

**Files:**

- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/src/modules/admin/api.js:68-76`
- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/src/lib/api.js:1618-1626`
- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/tests/posAdminAuth.test.mjs:704-753`

- [ ] **Step 1: Extend the failing adapter test**

Change the existing test request to:

```javascript
const result = await api(
  'GET',
  '/pwa-admin/today-sales?warehouse_id=89&company_id=34&date=2026-07-23',
)
```

Change its mock URL and assertion to:

```javascript
if (url === '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34&date=2026-07-23') {
  // existing response
}

assert.equal(
  call.url,
  '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34&date=2026-07-23',
)
```

Keep the existing API-key, employee-token, no-generic-model-read, and response
assertions.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/posAdminAuth.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: the today-sales test fails because `directAdmin` drops `date`.

- [ ] **Step 3: Extend the admin client**

Change `getTodaySales` to:

```javascript
/** Ventas POS de un día. Acepta { warehouseId, companyId, date } o un número legacy. */
export function getTodaySales(arg) {
  if (typeof arg === 'number' || typeof arg === 'string') {
    return api('GET', `/pwa-admin/today-sales?warehouse_id=${arg}`)
  }
  const { warehouseId, companyId, date } = arg || {}
  const qs = toQuery({
    warehouse_id: warehouseId,
    company_id: companyId,
    date,
  })
  return api('GET', `/pwa-admin/today-sales${qs}`)
}
```

- [ ] **Step 4: Forward `date` in the direct Odoo adapter**

Change the `/pwa-admin/today-sales` branch in `src/lib/api.js` to:

```javascript
if (cleanPath === '/pwa-admin/today-sales' && method === 'GET') {
  const query = new URLSearchParams(path.split('?')[1] || '')
  const reqWarehouseId = Number(query.get('warehouse_id') || warehouseId || 0)
  const reqCompanyId = Number(query.get('company_id') || companyId || 0)
  return odooHttp('GET', '/pwa-admin/today-sales', {
    warehouse_id: reqWarehouseId || undefined,
    company_id: reqCompanyId || undefined,
    date: query.get('date') || undefined,
  })
}
```

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:

```bash
node --test tests/posAdminAuth.test.mjs tests/angyPosSalesBreakdown.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: all focused tests pass.

- [ ] **Step 6: Commit adapter forwarding**

Run:

```bash
git add src/modules/admin/api.js src/lib/api.js tests/posAdminAuth.test.mjs
git commit -m "feat(admin): request historical POS sales dates"
```

Expected: one PWA commit with the client, adapter, and routing test.

## Task 6: Build the responsive Angélica breakdown component

**Files:**

- Create:
  `/private/tmp/gf-pwa-angy-pos-sku/src/modules/admin/components/AngyPosProductBreakdown.jsx`
- Create:
  `/private/tmp/gf-pwa-angy-pos-sku/src/modules/admin/components/AngyPosProductBreakdown.css`
- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/package.json`
- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/package-lock.json`
- Create:
  `/private/tmp/gf-pwa-angy-pos-sku/tests/angyPosProductBreakdownUi.test.mjs`

- [ ] **Step 1: Add the React 18 test renderer**

Run:

```bash
npm install --save-dev react-test-renderer@18.3.1
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: `package.json` and `package-lock.json` add
`react-test-renderer@18.3.1` without changing React itself.

- [ ] **Step 2: Write the failing UI behavior and contract test**

Create `tests/angyPosProductBreakdownUi.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createServer } from 'vite'

let vite
let Component

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function renderedText(renderer) {
  return renderer.root
    .findAll((node) => node.children.some((child) => typeof child === 'string'))
    .flatMap((node) => node.children.filter((child) => typeof child === 'string'))
    .join(' ')
}

test.before(async () => {
  vite = await createServer({
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom',
  })
  const module = await vite.ssrLoadModule(
    '/src/modules/admin/components/AngyPosProductBreakdown.jsx',
  )
  Component = module.default
})

test.after(async () => {
  await vite?.close()
})

test('renders rows and drives date, empty, error, and retry states', async () => {
  const calls = []
  let errorAttempts = 0
  const loadSales = async ({ date, ...scope }) => {
    calls.push({ date, ...scope })
    if (date === '2026-07-23') {
      return { ok: true, data: { date, products: [] } }
    }
    if (date === '2026-07-22' && errorAttempts++ === 0) {
      throw new Error('Sin conexion')
    }
    return {
      ok: true,
      data: {
        date,
        products: [{
          product_id: 10,
          sku: 'ROL-55',
          product_name: 'Rolito 5.5 kg',
          quantity: 3,
          amount_total: 336,
          weight_per_unit_kg: 5.5,
          weight_total_kg: 16.5,
          weight_configured: true,
        }],
        product_totals: {
          quantity: 3,
          amount_total: 336,
          weight_total_kg: 16.5,
          products_without_weight: 0,
        },
      },
    }
  }

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Component, {
      warehouseId: 89,
      companyId: 34,
      loadSales,
      todayOverride: '2026-07-24',
    }))
    await flush()
  })

  assert.deepEqual(calls[0], {
    date: '2026-07-24',
    warehouseId: 89,
    companyId: 34,
  })
  assert.match(renderedText(renderer), /ROL-55/)
  assert.match(renderedText(renderer), /Rolito 5\.5 kg/)
  assert.match(renderedText(renderer), /336/)
  assert.match(renderedText(renderer), /16\.5 kg/)

  const input = renderer.root.findByType('input')
  await act(async () => {
    input.props.onChange({ target: { value: '2026-07-23' } })
    await flush()
  })
  assert.match(renderedText(renderer), /No hay ventas POS para esta fecha/)
  assert.match(renderedText(renderer), /0 unidades/)
  assert.match(renderedText(renderer), /0 kg/)

  await act(async () => {
    renderer.root.findByType('input').props.onChange({
      target: { value: '2026-07-22' },
    })
    await flush()
  })
  assert.match(renderedText(renderer), /Sin conexion/)
  const retry = renderer.root.findByType('button')
  assert.equal(renderedText(renderer).includes('Reintentar'), true)

  await act(async () => {
    retry.props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /Rolito 5\.5 kg/)
})

test('ignores a stale response after the selected date changes', async () => {
  const pending = []
  const loadSales = ({ date }) => new Promise((resolve) => {
    pending.push({ date, resolve })
  })

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Component, {
      warehouseId: 89,
      companyId: 34,
      loadSales,
      todayOverride: '2026-07-24',
    }))
    await flush()
  })

  await act(async () => {
    renderer.root.findByType('input').props.onChange({
      target: { value: '2026-07-23' },
    })
    await flush()
  })

  await act(async () => {
    pending[1].resolve({
      data: {
        date: '2026-07-23',
        products: [{
          product_id: 2,
          product_name: 'Respuesta nueva',
          quantity: 1,
          amount_total: 20,
          weight_total_kg: 1,
          weight_configured: true,
        }],
      },
    })
    await flush()
  })
  assert.match(renderedText(renderer), /Respuesta nueva/)

  await act(async () => {
    pending[0].resolve({
      data: {
        date: '2026-07-24',
        products: [{
          product_id: 1,
          product_name: 'Respuesta vieja',
          quantity: 1,
          amount_total: 10,
          weight_total_kg: 1,
          weight_configured: true,
        }],
      },
    })
    await flush()
  })
  assert.doesNotMatch(renderedText(renderer), /Respuesta vieja/)
  assert.match(renderedText(renderer), /Respuesta nueva/)
})

test('keeps approved copy and responsive CSS contract', () => {
  const component = readFileSync(
    new URL('../src/modules/admin/components/AngyPosProductBreakdown.jsx', import.meta.url),
    'utf8',
  )
  const css = readFileSync(
    new URL('../src/modules/admin/components/AngyPosProductBreakdown.css', import.meta.url),
    'utf8',
  )

  for (const label of ['SKU', 'Producto', 'Cantidad', 'Monto total', 'Peso']) {
    assert.match(component, new RegExp(label))
  }
  assert.match(component, /Sin SKU/)
  assert.match(component, /Peso no configurado/)
  assert.match(component, /productsWithoutWeight/)
  assert.doesNotMatch(component, /style=\{\{/)
  assert.doesNotMatch(component, /POLL_MS/)
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /\.angy-pos-breakdown__table/)
  assert.match(css, /\.angy-pos-breakdown__cards/)
})
```

- [ ] **Step 3: Run the UI test and confirm RED**

Run:

```bash
node --test tests/angyPosProductBreakdownUi.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: FAIL because the component and CSS do not exist.

- [ ] **Step 4: Implement the component behavior**

Create `AngyPosProductBreakdown.jsx` with:

```jsx
import { useEffect, useReducer, useRef, useState } from 'react'
import { getTodaySales } from '../api'
import {
  breakdownStateReducer,
  createInitialBreakdownState,
  createLatestRequestTracker,
  getMexicoDateKey,
  isSelectableSalesDate,
  loadPosProductBreakdown,
} from '../angyPosSalesBreakdown'
import './AngyPosProductBreakdown.css'

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})
const number = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 3,
})

function ProductTableCells({ row }) {
  return (
    <>
      <td>{row.sku || 'Sin SKU'}</td>
      <td>{row.productName}</td>
      <td>{number.format(row.quantity)}</td>
      <td>{money.format(row.amountTotal)}</td>
      <td>
        {row.weightConfigured
          ? `${number.format(row.weightTotalKg)} kg`
          : 'Peso no configurado'}
      </td>
    </>
  )
}

function ProductCard({ row }) {
  return (
    <article className="angy-pos-breakdown__card">
      <strong className="angy-pos-breakdown__card-title">{row.productName}</strong>
      <span className="angy-pos-breakdown__card-sku">{row.sku || 'Sin SKU'}</span>
      <span>Cantidad</span>
      <strong>{number.format(row.quantity)}</strong>
      <span>Monto total</span>
      <strong>{money.format(row.amountTotal)}</strong>
      <span>Peso</span>
      <strong>
        {row.weightConfigured
          ? `${number.format(row.weightTotalKg)} kg`
          : 'Peso no configurado'}
      </strong>
    </article>
  )
}

export default function AngyPosProductBreakdown({
  warehouseId,
  companyId,
  loadSales = getTodaySales,
  todayOverride,
}) {
  const today = todayOverride || getMexicoDateKey()
  const [selectedDate, setSelectedDate] = useState(today)
  const [retryKey, setRetryKey] = useState(0)
  const [state, dispatch] = useReducer(
    breakdownStateReducer,
    today,
    createInitialBreakdownState,
  )
  const requestTracker = useRef(null)
  if (!requestTracker.current) {
    requestTracker.current = createLatestRequestTracker()
  }

  useEffect(() => {
    const requestId = requestTracker.current.begin()
    dispatch({ type: 'loading' })

    loadPosProductBreakdown({
      warehouseId,
      companyId,
      date: selectedDate,
      fetchSales: loadSales,
    })
      .then((result) => {
        if (!requestTracker.current.isCurrent(requestId)) return
        dispatch({ type: 'success', result })
      })
      .catch((error) => {
        if (!requestTracker.current.isCurrent(requestId)) return
        dispatch({
          type: 'error',
          message: error?.message || 'No se pudo cargar el desglose POS',
        })
      })
  }, [warehouseId, companyId, selectedDate, retryKey, loadSales])

  const onDateChange = (event) => {
    const nextDate = event.target.value
    if (isSelectableSalesDate(nextDate, today)) setSelectedDate(nextDate)
  }

  const { products, totals } = state.result

  return (
    <section className="angy-pos-breakdown" aria-labelledby="angy-pos-breakdown-title">
      <div className="angy-pos-breakdown__header">
        <div>
          <p className="angy-pos-breakdown__eyebrow">CAJA DEL DÍA</p>
          <h2 id="angy-pos-breakdown-title">Ventas POS por producto</h2>
        </div>
        <label className="angy-pos-breakdown__date">
          <span>Fecha</span>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={onDateChange}
          />
        </label>
      </div>

      {state.error ? (
        <div className="angy-pos-breakdown__message" role="alert">
          <p>{state.error}</p>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      ) : state.loading ? (
        <p className="angy-pos-breakdown__message" aria-live="polite">
          Cargando desglose…
        </p>
      ) : products.length === 0 ? (
        <div className="angy-pos-breakdown__message">
          <p>No hay ventas POS para esta fecha.</p>
          <div className="angy-pos-breakdown__empty-totals" aria-label="Totales en cero">
            <span>{number.format(totals.quantity)} unidades</span>
            <span>{money.format(totals.amountTotal)}</span>
            <span>{number.format(totals.weightTotalKg)} kg</span>
          </div>
        </div>
      ) : (
        <>
          <div className="angy-pos-breakdown__table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Monto total</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr key={row.productId}>
                    <ProductTableCells row={row} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2">Totales</td>
                  <td>{number.format(totals.quantity)}</td>
                  <td>{money.format(totals.amountTotal)}</td>
                  <td>{number.format(totals.weightTotalKg)} kg</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="angy-pos-breakdown__cards">
            {products.map((row) => (
              <ProductCard key={row.productId} row={row} />
            ))}
            <article className="angy-pos-breakdown__card angy-pos-breakdown__card--totals">
              <strong>Totales</strong>
              <span>{number.format(totals.quantity)} unidades</span>
              <span>{money.format(totals.amountTotal)}</span>
              <span>{number.format(totals.weightTotalKg)} kg</span>
            </article>
          </div>
        </>
      )}

      {!state.loading && !state.error && totals.productsWithoutWeight > 0 && (
        <p className="angy-pos-breakdown__warning">
          {totals.productsWithoutWeight} producto(s) sin peso configurado no
          se incluyeron en el total de kilos.
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Add responsive CSS**

Create `AngyPosProductBreakdown.css` with:

```css
.angy-pos-breakdown {
  margin-bottom: 28px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
}

.angy-pos-breakdown__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.angy-pos-breakdown__eyebrow,
.angy-pos-breakdown__date span {
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.angy-pos-breakdown h2 {
  margin-top: 4px;
  color: #fff;
  font-size: 20px;
}

.angy-pos-breakdown__date {
  display: grid;
  gap: 6px;
  min-width: 180px;
}

.angy-pos-breakdown__date input {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid rgba(97, 178, 255, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  color-scheme: dark;
}

.angy-pos-breakdown__table {
  overflow-x: auto;
}

.angy-pos-breakdown__table table {
  width: 100%;
  border-collapse: collapse;
}

.angy-pos-breakdown__table th,
.angy-pos-breakdown__table td {
  padding: 11px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.angy-pos-breakdown__table th {
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.angy-pos-breakdown__table td {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
}

.angy-pos-breakdown__table tfoot td {
  border-bottom: 0;
  color: #fff;
  font-weight: 700;
}

.angy-pos-breakdown__cards {
  display: none;
}

.angy-pos-breakdown__message {
  padding: 20px 0;
  color: rgba(255, 255, 255, 0.60);
}

.angy-pos-breakdown__empty-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 10px;
  color: #fff;
  font-weight: 700;
}

.angy-pos-breakdown__message button {
  min-height: 44px;
  margin-top: 10px;
  padding: 0 16px;
  border-radius: 14px;
  background: #2b8fe0;
  color: #fff;
  font-weight: 700;
}

.angy-pos-breakdown__warning {
  margin-top: 12px;
  color: #f59e0b;
  font-size: 11px;
}

@media (max-width: 720px) {
  .angy-pos-breakdown__header {
    align-items: stretch;
    flex-direction: column;
  }

  .angy-pos-breakdown__date {
    min-width: 0;
  }

  .angy-pos-breakdown__table {
    display: none;
  }

  .angy-pos-breakdown__cards {
    display: grid;
    gap: 10px;
  }

  .angy-pos-breakdown__card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 12px;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
  }

  .angy-pos-breakdown__card > span {
    color: rgba(255, 255, 255, 0.60);
    font-size: 11px;
  }

  .angy-pos-breakdown__card-title,
  .angy-pos-breakdown__card-sku {
    grid-column: 1 / -1;
  }

  .angy-pos-breakdown__card-title {
    color: #fff;
  }

  .angy-pos-breakdown__card--totals {
    border-color: rgba(97, 178, 255, 0.18);
  }
}
```

- [ ] **Step 6: Run UI and domain tests**

Run:

```bash
node --test tests/angyPosProductBreakdownUi.test.mjs tests/angyPosSalesBreakdown.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: all focused tests pass.

- [ ] **Step 7: Run lint and build before committing**

Run:

```bash
npm run lint
npm run build
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: both commands pass; JSX produces valid table markup.

- [ ] **Step 8: Commit the component**

Run:

```bash
git add package.json package-lock.json src/modules/admin/components/AngyPosProductBreakdown.jsx src/modules/admin/components/AngyPosProductBreakdown.css tests/angyPosProductBreakdownUi.test.mjs
git commit -m "feat(admin): render Angy POS product breakdown"
```

Expected: one PWA commit containing only component, CSS, and UI contract test.

## Task 7: Mount the feature only for Angélica

**Files:**

- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/src/modules/admin/components/HubV2.jsx:1-130`
- Modify:
  `/private/tmp/gf-pwa-angy-pos-sku/tests/navGuards.test.mjs:175-186`

- [ ] **Step 1: Write the failing hub integration contract**

Extend the existing admin hub test:

```javascript
assert.match(hub, /import AngyPosProductBreakdown from '\.\/AngyPosProductBreakdown'/)
assert.match(hub, /isAngelicaJaimesSession/)
assert.match(
  hub,
  /showAngyBreakdown && \(\s*<AngyPosProductBreakdown[\s\S]*warehouseId=\{warehouseId\}[\s\S]*companyId=\{companyId\}/,
)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/navGuards.test.mjs
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: the admin hub test fails because the personalized component is not
mounted.

- [ ] **Step 3: Add the focused mount in `HubV2`**

Add imports:

```javascript
import { isAngelicaJaimesSession } from '../angyPosSalesBreakdown'
import AngyPosProductBreakdown from './AngyPosProductBreakdown'
```

Read `employeeName` from the existing context:

```javascript
const { warehouseId, companyId, companyLabel, employeeName } = useAdmin()
const showAngyBreakdown = isAngelicaJaimesSession({ name: employeeName })
```

Mount after the KPI strip and before `ActivityFeed`:

```jsx
{showAngyBreakdown && (
  <AngyPosProductBreakdown
    warehouseId={warehouseId}
    companyId={companyId}
  />
)}
```

Do not add the selected date to `HubV2` state. The component must remain
independent of the dashboard's 60-second polling effect.

- [ ] **Step 4: Run focused and full PWA tests**

Run:

```bash
node --test tests/navGuards.test.mjs tests/angyPosProductBreakdownUi.test.mjs tests/angyPosSalesBreakdown.test.mjs tests/posAdminAuth.test.mjs
npm test
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: all focused and full tests pass.

- [ ] **Step 5: Commit the hub integration**

Run:

```bash
git add src/modules/admin/components/HubV2.jsx tests/navGuards.test.mjs
git commit -m "feat(admin): show Angy POS breakdown in daily cash"
```

Expected: one PWA commit containing only hub integration and its contract test.

## Task 8: Complete verification and review

**Files:**

- Review all files changed in both worktrees.
- No new feature scope.

- [ ] **Step 1: Use the verification skill**

Required skill:

```text
@superpowers:verification-before-completion
```

- [ ] **Step 2: Run the full backend checks**

Run:

```bash
python3 gf_pwa_admin/tests/test_today_sales_breakdown_contract.py
python3 gf_pwa_admin/tests/test_datetime_timezone_contract.py
python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git diff --check origin/GrupoFrio...HEAD
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected: every command passes with no whitespace or syntax errors.

- [ ] **Step 3: Run the full PWA checks**

Run:

```bash
npm test
npm run lint
npm run build
node scripts/check_public_e1.mjs
git diff --check origin/main...HEAD
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: every command passes.

- [ ] **Step 4: Inspect the changed-file scope**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected:

- clean worktree;
- only approved spec/plan history plus the scoped PWA files.

Run:

```bash
git status --short
git diff --stat origin/GrupoFrio...HEAD
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected:

- clean worktree;
- only the four scoped Odoo files.

- [ ] **Step 5: Run the approved desktop, mobile, and non-Angélica visual checks**

Required skill:

```text
@vercel:agent-browser-verify
```

Use `apply_patch` to create the temporary, untracked file
`/private/tmp/gf-pwa-angy-pos-sku/angy-breakdown-preview.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Angy POS breakdown preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { SessionContext } from '/src/App.jsx'
      import { AdminProvider } from '/src/modules/admin/AdminContext.jsx'
      import HubV2 from '/src/modules/admin/components/HubV2.jsx'
      import '/src/index.css'

      const params = new URLSearchParams(location.search)
      const name = params.get('name') || 'Angélica Jaimes'
      const session = {
        session_token: 'preview-token',
        gf_employee_token: 'preview-employee-token',
        employee_id: 700,
        name,
        role: 'gerente_sucursal',
        company_id: 34,
        warehouse_id: 89,
        sucursal: 'Iguala',
      }
      localStorage.setItem('gf_session', JSON.stringify(session))

      const jsonResponse = (payload) => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
      })

      globalThis.fetch = async (input) => {
        const url = String(input)
        if (url.includes('/pwa-admin/capabilities')) {
          return jsonResponse({ ok: true, data: {} })
        }
        if (url.includes('/pwa-admin/today-expenses')) {
          return jsonResponse({ ok: true, data: { items: [] } })
        }
        if (url.includes('/pwa-admin/today-sales')) {
          const selected = new URL(url, location.origin).searchParams.get('date')
            || '2026-07-24'
          if (selected === '2026-07-23') {
            return jsonResponse({
              ok: true,
              data: {
                date: selected,
                orders: [],
                items: [],
                products: [],
                product_totals: {
                  quantity: 0,
                  amount_total: 0,
                  weight_total_kg: 0,
                  products_without_weight: 0,
                },
              },
            })
          }
          return jsonResponse({
            ok: true,
            data: {
              date: selected,
              orders: [],
              items: [],
              products: [{
                product_id: 10,
                sku: 'ROL-55',
                product_name: 'Rolito 5.5 kg',
                quantity: 3,
                amount_total: 336,
                weight_per_unit_kg: 5.5,
                weight_total_kg: 16.5,
                weight_configured: true,
              }, {
                product_id: 11,
                sku: '',
                product_name: 'Producto sin peso',
                quantity: 1,
                amount_total: 25,
                weight_per_unit_kg: 0,
                weight_total_kg: 0,
                weight_configured: false,
              }],
              product_totals: {
                quantity: 4,
                amount_total: 361,
                weight_total_kg: 16.5,
                products_without_weight: 1,
              },
            },
          })
        }
        return jsonResponse({ ok: true, data: {} })
      }

      const tree = React.createElement(
        SessionContext.Provider,
        { value: { session, updateSession() {} } },
        React.createElement(
          AdminProvider,
          null,
          React.createElement(HubV2),
        ),
      )
      createRoot(document.getElementById('root')).render(tree)
    </script>
  </body>
</html>
```

Start Vite:

```bash
npm run dev -- --host 127.0.0.1 --port 4176 --strictPort
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Verify with the browser:

1. Open
   `http://127.0.0.1:4176/angy-breakdown-preview.html`
   at `1440x900`.
   - table columns are legible;
   - product and totals rows render;
   - missing weight warning renders;
   - no horizontal page overflow.
2. Change the date to `2026-07-23`.
   - empty-state copy renders;
   - zero unit, amount, and kilogram totals render.
3. Reopen at `390x844`.
   - product cards replace the desktop table;
   - date input and retry-sized controls meet the 44px target;
   - no clipped content.
4. Open
   `http://127.0.0.1:4176/angy-breakdown-preview.html?name=Otro%20Gerente`.
   - `Ventas POS por producto` is absent;
   - the real `HubV2` still shows `Panorama del día` and `ACTIVIDAD HOY`.

Capture screenshots or browser observations in the task notes. Then stop the
server and remove the temporary harness:

```bash
rm -f angy-breakdown-preview.html
git status --short
```

Expected: no preview file remains and the feature worktree is clean.

- [ ] **Step 6: Request code review**

Required skill:

```text
@superpowers:requesting-code-review
```

Review must check:

- secure employee/analytic scope remains unchanged;
- historical date cannot expand company or warehouse scope;
- POS-only exclusions remain unchanged;
- `price_total` is used for per-SKU amount;
- missing weights are not silently counted as known zero-weight products;
- no stale request can overwrite a newly selected date;
- only Angélica receives the new component;
- no user-owned local files entered either commit series.

- [ ] **Step 7: Fix review findings with TDD**

For every valid finding:

1. add or tighten a failing focused test;
2. run it and confirm RED;
3. implement the smallest fix;
4. run focused tests and confirm GREEN;
5. rerun the full verification commands;
6. create a focused fix commit.

## Task 9: Integrate the backend into its operational branch

**Files:**

- Backend Git history only.

- [ ] **Step 1: Fetch the backend remote**

Run:

```bash
git fetch origin GrupoFrio
```

Working directory: `/private/tmp/grupofrio-angy-pos-sku`

Expected: `origin/GrupoFrio` is current.

- [ ] **Step 2: Rebase the verified backend feature if required**

Run:

```bash
git rebase origin/GrupoFrio
```

Expected: clean rebase or explicit conflicts limited to the scoped backend
files. Resolve conflicts without discarding upstream changes, then rerun Task
8 backend verification.

- [ ] **Step 3: Merge into the checked-out backend operational branch**

Run:

```bash
git merge --no-ff codex/angy-pos-daily-sku -m "Merge Angy daily POS SKU breakdown"
```

Working directory for the merge:
`/Users/sebis/Documents/odoo/GrupoFrio`

Expected:

- `GrupoFrio` contains the feature commit through a merge commit;
- untracked `ayuda.py` remains untracked and unchanged.

- [ ] **Step 4: Verify the backend after merge**

Run:

```bash
python3 gf_pwa_admin/tests/test_today_sales_breakdown_contract.py
python3 gf_pwa_admin/tests/test_datetime_timezone_contract.py
python3 -m py_compile gf_pwa_admin/controllers/pwa_admin_api.py gf_pwa_admin/tests/test_pwa_admin_api.py
git status --short --branch
```

Working directory: `/Users/sebis/Documents/odoo/GrupoFrio`

Expected: all checks pass; the only reported untracked file is the pre-existing
`ayuda.py`.

Do not push or deploy unless separately requested.

## Task 10: Integrate the verified PWA feature into `main`

**Files:**

- PWA Git history only.

- [ ] **Step 1: Fetch the latest PWA `main`**

Run:

```bash
git fetch origin main
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: `origin/main` is current.

- [ ] **Step 2: Merge latest `origin/main` into the feature branch**

Run:

```bash
git merge origin/main
```

Expected: clean merge or explicit conflicts. Resolve conflicts without
discarding either the existing admin-hub work or upstream changes.

- [ ] **Step 3: Rerun the complete PWA verification**

Run:

```bash
npm test
npm run lint
npm run build
node scripts/check_public_e1.mjs
git diff --check origin/main...HEAD
```

Working directory: `/private/tmp/gf-pwa-angy-pos-sku`

Expected: every command passes after the upstream merge.

- [ ] **Step 4: Add a dedicated local-main integration worktree**

Run:

```bash
git -C /Users/sebis/Documents/odoo/gf-pwa-colaboradores worktree add /private/tmp/gf-pwa-angy-pos-main main
```

Expected: the local `main` branch is checked out without disturbing the user's
original workspace changes.

- [ ] **Step 5: Bring the local `main` forward without losing its existing commit**

Run:

```bash
git merge origin/main
```

Working directory: `/private/tmp/gf-pwa-angy-pos-main`

Expected: local `main` contains both its pre-existing local commit and the
latest remote history. Do not force-reset `main`.

- [ ] **Step 6: Merge the verified feature into `main`**

Run:

```bash
git merge --no-ff codex/angy-pos-daily-sku -m "Merge Angy daily POS SKU breakdown"
```

Working directory: `/private/tmp/gf-pwa-angy-pos-main`

Expected: merge succeeds and `main` contains the feature.

- [ ] **Step 7: Verify the merged `main`**

Run:

```bash
npm test
npm run lint
npm run build
node scripts/check_public_e1.mjs
git status --short --branch
```

Working directory: `/private/tmp/gf-pwa-angy-pos-main`

Expected: all checks pass and `main` is clean.

Do not push `main` unless separately requested.

- [ ] **Step 8: Report the final integration state**

Report:

- backend feature commit and `GrupoFrio` merge commit;
- PWA feature commits and `main` merge commit;
- exact verification commands and pass counts;
- whether the real Odoo `HttpCase` suite ran or was unavailable;
- confirmation that unrelated local files remained untouched.

# POS Ticket Customer Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the sale customer on the POS ticket screen and on both printed-ticket paths, with `VENTA PUBLICO` as the exact fallback.

**Architecture:** Add a small pure customer-name normalizer beside the ticket modules, then derive one `customerName` value in `ScreenTicket`. Pass that normalized value to the existing ESC/POS builder and interpolate it through the already escaped browser-print template; neither printer needs to understand raw Odoo relation shapes.

**Tech Stack:** React 18, JavaScript ES modules, QZ Tray / ESC-POS, browser print HTML/CSS, Node `node:test`.

---

## File map

- Create `src/modules/admin/ticketCustomer.js`
  - own the sale-detail customer-name normalization contract;
  - export the exact public-sale fallback.
- Create `tests/ticketCustomer.test.mjs`
  - cover Odoo many2one and alternate response shapes;
  - cover whitespace, malformed values, and the exact fallback.
- Modify `src/modules/admin/ticketPrinter.js`
  - accept only normalized `customerName`;
  - print and wrap the customer line below the folio.
- Modify `src/modules/admin/ScreenTicket.jsx`
  - derive the normalized name once;
  - render it on screen;
  - render it in browser-print HTML with escaping;
  - pass it to QZ printing.
- Modify `tests/ticketPrintReadability.test.mjs`
  - cover ESC/POS customer placement and wrapping;
  - protect the browser-print and on-screen rendering contracts.

### Task 1: Normalize the customer name

**Files:**
- Create: `tests/ticketCustomer.test.mjs`
- Create: `src/modules/admin/ticketCustomer.js`

- [ ] **Step 1: Write the failing normalization tests**

Create `tests/ticketCustomer.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PUBLIC_TICKET_CUSTOMER,
  resolveTicketCustomerName,
} from '../src/modules/admin/ticketCustomer.js'

test('resolves the sale customer from supported sale-detail payload shapes', () => {
  const cases = [
    [{ partner_name: '  Cliente directo  ' }, 'Cliente directo'],
    [{ partner_id: [61100, 'Abarrotes Centro'] }, 'Abarrotes Centro'],
    [{ partner_id: { id: 61100, display_name: 'Palapa Norte' } }, 'Palapa Norte'],
    [{ customer_name: 'Cliente alterno' }, 'Cliente alterno'],
    [{ customer: 'Mostrador Especial' }, 'Mostrador Especial'],
  ]

  for (const [order, expected] of cases) {
    assert.equal(resolveTicketCustomerName(order), expected)
  }
})

test('prefers the canonical partner name and falls back to VENTA PUBLICO', () => {
  assert.equal(
    resolveTicketCustomerName({
      partner_name: 'Cliente canónico',
      partner_id: [1, 'Cliente secundario'],
    }),
    'Cliente canónico',
  )

  for (const order of [null, {}, { partner_name: '   ' }, { partner_id: 61100 }]) {
    assert.equal(resolveTicketCustomerName(order), PUBLIC_TICKET_CUSTOMER)
  }
  assert.equal(PUBLIC_TICKET_CUSTOMER, 'VENTA PUBLICO')
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/ticketCustomer.test.mjs
```

Expected: FAIL because `src/modules/admin/ticketCustomer.js` does not exist.

- [ ] **Step 3: Implement the minimal pure normalizer**

Create `src/modules/admin/ticketCustomer.js`:

```javascript
export const PUBLIC_TICKET_CUSTOMER = 'VENTA PUBLICO'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function relationName(value) {
  if (Array.isArray(value)) return text(value[1])
  if (value && typeof value === 'object') {
    return text(
      value.name
      || value.display_name
      || value.partner_name
      || value.customer_name,
    )
  }
  return text(value)
}

export function resolveTicketCustomerName(order) {
  if (!order || typeof order !== 'object') return PUBLIC_TICKET_CUSTOMER
  return text(order.partner_name)
    || relationName(order.partner_id)
    || text(order.customer_name)
    || relationName(order.customer)
    || PUBLIC_TICKET_CUSTOMER
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/ticketCustomer.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the normalizer**

```bash
git add src/modules/admin/ticketCustomer.js tests/ticketCustomer.test.mjs
git commit -m "feat(pos): normalize ticket customer name"
```

### Task 2: Print the customer through ESC/POS

**Files:**
- Modify: `tests/ticketPrintReadability.test.mjs:10-44`
- Modify: `src/modules/admin/ticketPrinter.js:97-128`

- [ ] **Step 1: Add a failing ESC/POS customer assertion**

In the existing ESC/POS test payload, add:

```javascript
customerName: 'Abarrotes Centro',
```

Then assert placement:

```javascript
const folioIndex = commands.indexOf('Folio: S00123\n')
const customerIndex = commands.indexOf('Cliente: Abarrotes Centro\n')
const headerSeparatorIndex = commands.indexOf('='.repeat(48) + '\n')
assert.ok(customerIndex > folioIndex)
assert.ok(customerIndex < headerSeparatorIndex)
```

Add a second focused test for wrapping:

```javascript
test('wraps a long ESC-POS customer name without changing ticket width', () => {
  const commands = buildEscPosTicket({
    folio: 'S00124',
    customerName: 'Distribuidora de Productos Congelados del Centro de Iguala',
  })
  const folioIndex = commands.indexOf('Folio: S00124\n')
  const separatorIndex = commands.indexOf('='.repeat(48) + '\n')
  const customerLines = commands
    .slice(folioIndex + 2, separatorIndex)
    .filter((command) => typeof command === 'string' && command.endsWith('\n'))

  assert.ok(customerLines.length >= 2)
  assert.ok(customerLines.every((line) => line.trimEnd().length <= 48))
  assert.equal(customerLines.join('').replace(/\n/g, ' '), 'Cliente: Distribuidora de Productos Congelados del Centro de Iguala ')
})
```

- [ ] **Step 2: Run the ticket test and verify RED**

Run:

```bash
node --test tests/ticketPrintReadability.test.mjs
```

Expected: FAIL because no customer commands are emitted.

- [ ] **Step 3: Implement the minimal ESC/POS output**

Add the default to `buildEscPosTicket` destructuring:

```javascript
customerName = 'VENTA PUBLICO',
```

Immediately after the folio command, add:

```javascript
for (const row of wrap(`Cliente: ${customerName}`, LINE_WIDTH)) {
  out.push(row + '\n')
}
```

Do not change `LINE_WIDTH`, body-size commands, separators, totals, or cut/reset
commands.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test tests/ticketCustomer.test.mjs tests/ticketPrintReadability.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit ESC/POS printing**

```bash
git add src/modules/admin/ticketPrinter.js tests/ticketPrintReadability.test.mjs
git commit -m "feat(pos): print customer on ESC-POS ticket"
```

### Task 3: Render the customer on screen and in browser printing

**Files:**
- Modify: `tests/ticketPrintReadability.test.mjs:46-82`
- Modify: `src/modules/admin/ScreenTicket.jsx:1-210`
- Modify: `src/modules/admin/ScreenTicket.jsx:320-353`

- [ ] **Step 1: Add failing screen and fallback source contracts**

Extend the browser fallback size list with:

```javascript
[/\.customer \{ font-size: 12px;/, 'customer'],
```

After extracting `printHtml`, add:

```javascript
assert.match(
  printHtml,
  /<div class="customer">Cliente: \$\{esc\(customerName\)\}<\/div>/,
)
assert.match(
  source,
  /<div[^>]*>\s*Cliente: \{customerName\}\s*<\/div>/,
)
assert.match(
  source,
  /customerName,\s*lines,/,
  'QZ ticket payload must receive the normalized customer name',
)
```

- [ ] **Step 2: Run the ticket test and verify RED**

Run:

```bash
node --test tests/ticketPrintReadability.test.mjs
```

Expected: FAIL because the customer CSS and render locations do not exist.

- [ ] **Step 3: Derive and render one normalized name**

Import the helper:

```javascript
import { resolveTicketCustomerName } from './ticketCustomer'
```

After `folio`, derive:

```javascript
const customerName = resolveTicketCustomerName(order)
```

In browser-print CSS add:

```css
.customer { font-size: 12px; color: #333; margin-top: 2px; }
```

Immediately after the browser-print folio add:

```html
<div class="customer">Cliente: ${esc(customerName)}</div>
```

Pass `customerName` in the object sent to `printTicketViaQz`.

Immediately below the on-screen folio add:

```jsx
<div style={{ fontSize: 12, color: '#333', marginTop: 2 }}>
  Cliente: {customerName}
</div>
```

Keep the existing separator spacing and all unrelated on-screen styles intact.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test tests/ticketCustomer.test.mjs tests/ticketPrintReadability.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit screen and fallback rendering**

```bash
git add src/modules/admin/ScreenTicket.jsx tests/ticketPrintReadability.test.mjs
git commit -m "feat(pos): show customer on POS ticket"
```

### Task 4: Verify the integrated change

**Files:**
- Verify only; no planned production edits.

- [ ] **Step 1: Run focused ticket tests**

```bash
node --test tests/ticketCustomer.test.mjs tests/ticketPrintReadability.test.mjs
```

Expected: all tests pass with no warnings.

- [ ] **Step 2: Run the full suite**

```bash
npm test
```

Expected: all tests pass; baseline was 1,271 tests.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: exit code 0 and the repository leak checks pass.

- [ ] **Step 5: Check the final diff**

```bash
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: no whitespace errors and no uncommitted files.

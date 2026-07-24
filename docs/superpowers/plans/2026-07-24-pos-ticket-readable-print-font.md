# Readable POS Ticket Print Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase all printed POS ticket text to a medium, readable size in both QZ/ESC-POS and browser-fallback printing without changing the on-screen ticket.

**Architecture:** Keep the two existing print paths and their physical layout unchanged. The QZ path will switch normal body text to ESC/POS double-height while retaining normal width and the 48-column layout; the browser fallback will increase only the CSS embedded in `buildTicketHtml()` by roughly 20%.

**Tech Stack:** React 18, JavaScript, QZ Tray/ESC-POS, browser print CSS, Node `node:test`.

---

## File map

- Modify `src/modules/admin/ticketPrinter.js`
  - add an ESC/POS 1x-width/2x-height body mode;
  - restore that body mode after the double-size header and total;
  - reset the printer to normal size before cutting;
  - preserve the existing 48-column layout.
- Modify `src/modules/admin/ScreenTicket.jsx`
  - increase only the font sizes inside `buildTicketHtml()`;
  - preserve the 72 mm paper width, 62 mm content width, compensated margins,
    screen JSX, calculations, and fallback flow.
- Create `tests/ticketPrintReadability.test.mjs`
  - behavior test for the ESC/POS command stream;
  - focused contract test for the isolated fallback HTML styles.

## Task 1: Increase QZ/ESC-POS body text with TDD

**Files:**

- Create: `tests/ticketPrintReadability.test.mjs`
- Modify: `src/modules/admin/ticketPrinter.js:20-145`

- [ ] **Step 1: Write the failing ESC/POS readability test**

Create `tests/ticketPrintReadability.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildEscPosTicket } from '../src/modules/admin/ticketPrinter.js'

const ESC_POS_DOUBLE_HEIGHT = '\x1D!\x10'
const ESC_POS_NORMAL = '\x1D!\x00'

test('prints normal ticket text at double height without reducing the 48-column width', () => {
  const commands = buildEscPosTicket({
    sucursal: 'Iguala',
    dateStr: '24/07/2026',
    timeStr: '13:40',
    folio: 'S00123',
    lines: [{
      qty: 2,
      product_name: 'Bolsa de hielo de cinco kilogramos',
      price_unit: 40,
    }],
    fmt: (value) => `$${Number(value).toFixed(2)}`,
    subtotal: 80,
    total: 80,
    paymentLabel: 'Efectivo',
  })

  const firstBodySize = commands.indexOf(ESC_POS_DOUBLE_HEIGHT)
  const branchName = commands.indexOf('Iguala\n')
  assert.ok(firstBodySize >= 0)
  assert.ok(firstBodySize < branchName)

  const totalIndex = commands.findIndex((command) => (
    typeof command === 'string' && command.includes('TOTAL')
  ))
  const bodySizeAfterTotal = commands.indexOf(ESC_POS_DOUBLE_HEIGHT, totalIndex)
  const paymentIndex = commands.findIndex((command) => (
    typeof command === 'string' && command.includes('Metodo de pago:')
  ))
  assert.ok(bodySizeAfterTotal > totalIndex)
  assert.ok(bodySizeAfterTotal < paymentIndex)

  assert.ok(commands.includes('-'.repeat(48) + '\n'))
  assert.equal(commands.at(-2), ESC_POS_NORMAL)
})
```

Keep the `readFileSync` import because Task 2 adds the browser-fallback
contract to this same focused test file.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/ticketPrintReadability.test.mjs
```

Expected: FAIL because the command stream has no `\x1D!\x10` double-height
body mode.

- [ ] **Step 3: Add the minimal ESC/POS body-size implementation**

In `src/modules/admin/ticketPrinter.js`, add:

```javascript
const SIZE_DOUBLE_HEIGHT = GS + '!' + '\x10' // 1x ancho + 2x alto
```

Change the header reset:

```javascript
out.push(
  ALIGN_CENTER,
  SIZE_DOUBLE,
  BOLD_ON,
  'GRUPO FRIO\n',
  BOLD_OFF,
  SIZE_DOUBLE_HEIGHT,
)
```

Change the total reset:

```javascript
out.push(
  BOLD_ON,
  SIZE_DOUBLE,
  lr('TOTAL', fmt(total), LINE_WIDTH / 2) + '\n',
  SIZE_DOUBLE_HEIGHT,
  BOLD_OFF,
)
```

Before the existing `FEED_AND_CUT`, restore the default printer size:

```javascript
out.push(SIZE_NORMAL)
out.push(FEED_AND_CUT)
```

Do not change `LINE_WIDTH`, `lr`, `wrap`, the logo, alignment, content, or
cut command.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test tests/ticketPrintReadability.test.mjs
```

Expected: 1 test passes.

- [ ] **Step 5: Commit the ESC/POS change**

```bash
git add src/modules/admin/ticketPrinter.js tests/ticketPrintReadability.test.mjs
git commit -m "fix(pos): enlarge ESC-POS ticket text"
```

## Task 2: Increase browser-fallback print text with TDD

**Files:**

- Modify: `tests/ticketPrintReadability.test.mjs`
- Modify: `src/modules/admin/ScreenTicket.jsx:129-176`

- [ ] **Step 1: Add the failing fallback typography contract**

Append to `tests/ticketPrintReadability.test.mjs`:

```javascript
test('enlarges every browser-fallback ticket text style without changing paper geometry', () => {
  const source = readFileSync(
    new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url),
    'utf8',
  )
  const printHtml = source.slice(
    source.indexOf('  function buildTicketHtml()'),
    source.indexOf('  async function printTicket()'),
  )

  const expectedSizes = [
    [/\.brand \{ font-size: 18px;/, 'brand'],
    [/\.sub \{ font-size: 12px;/, 'branch'],
    [/\.meta \{[^}]*font-size: 12px;/, 'date and time'],
    [/\.folio \{ font-size: 13px;/, 'folio'],
    [/\.row \{[^}]*font-size: 12px;/, 'product rows'],
    [/\.totals \{[^}]*font-size: 12px;/, 'subtotal'],
    [/\.total \{[^}]*font-size: 18px;/, 'total'],
    [/\.pay \{[^}]*font-size: 12px;/, 'payment method'],
    [/\.box \.t \{ font-size: 10px;/, 'ticket label'],
    [/\.box \.f \{ font-size: 18px;/, 'boxed folio'],
    [/\.foot \{[^}]*font-size: 11px;/, 'footer'],
    [/\.foot\.b \{ font-size: 12px;/, 'thank-you footer'],
  ]

  for (const [pattern, label] of expectedSizes) {
    assert.match(printHtml, pattern, `${label} did not use the approved font size`)
  }

  assert.match(printHtml, /html, body \{ width: 72mm;/)
  assert.match(printHtml, /\.ticket \{ width: 62mm; margin: 0 2mm 0 8mm;/)
  assert.doesNotMatch(
    source.slice(source.indexOf('  return ('), source.length),
    /fontSize: 13, fontWeight: 700, color: '#1a1a1a' \}>Folio:/,
    'the on-screen ticket must remain unchanged',
  )
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/ticketPrintReadability.test.mjs
```

Expected: the ESC/POS test passes and the fallback typography test fails on
the old 8–15 px sizes.

- [ ] **Step 3: Increase only the fallback HTML sizes**

Inside the CSS returned by `buildTicketHtml()` in
`src/modules/admin/ScreenTicket.jsx`, change:

```css
.brand { font-size: 18px; ... }
.sub { font-size: 12px; ... }
.meta { ... font-size: 12px; ... }
.folio { font-size: 13px; ... }
.row { ... font-size: 12px; ... }
.totals { ... font-size: 12px; ... }
.total { ... font-size: 18px; ... }
.pay { ... font-size: 12px; ... }
.box .t { font-size: 10px; ... }
.box .f { font-size: 18px; ... }
.foot { ... font-size: 11px; ... }
.foot.b { font-size: 12px; ... }
```

Do not change any styles outside `buildTicketHtml()` and do not change paper
geometry, content, or print flow.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test tests/ticketPrintReadability.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the fallback change**

```bash
git add src/modules/admin/ScreenTicket.jsx tests/ticketPrintReadability.test.mjs
git commit -m "fix(pos): enlarge fallback ticket print text"
```

## Task 3: Verify the complete change

**Files:**

- Review all files changed from `origin/main`.
- No new product scope.

- [ ] **Step 1: Use the verification skill**

Required skill:

```text
@superpowers:verification-before-completion
```

- [ ] **Step 2: Run focused and full checks**

```bash
node --test tests/ticketPrintReadability.test.mjs
npm test
npm run lint
npm run build
git diff --check origin/main...HEAD
```

Expected: every command passes; focused test reports 2/2.

- [ ] **Step 3: Inspect scope**

```bash
git status --short --branch
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src/modules/admin/ScreenTicket.jsx src/modules/admin/ticketPrinter.js tests/ticketPrintReadability.test.mjs
```

Expected:

- clean branch;
- design/plan documents plus the two existing print files and one new test;
- no changes to on-screen JSX, pricing, API, role gates, physical paper width,
  QZ connection, logo, or cut behavior.

- [ ] **Step 4: Request final code review**

Required skill:

```text
@superpowers:requesting-code-review
```

Review must check:

- QZ body uses 1x width and 2x height;
- 48-column wrapping is unchanged;
- browser fallback sizes increase by roughly 20%;
- paper geometry and on-screen ticket remain unchanged;
- printer resets to normal size before cutting;
- tests validate behavior and the exact fallback contract.

- [ ] **Step 5: Fix valid findings with TDD**

For each valid finding, tighten a focused test, confirm RED, implement the
smallest fix, confirm GREEN, and rerun Task 3.

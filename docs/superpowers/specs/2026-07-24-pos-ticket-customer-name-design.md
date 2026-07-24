# POS Ticket Customer Name Design

**Date:** 2026-07-24  
**Status:** Approved

## Goal

Show the customer associated with a POS sale on the on-screen ticket and on both
printed-ticket paths:

- QZ Tray / ESC-POS;
- browser-print fallback.

The ticket must always show a customer line. When the sale detail does not expose
a usable customer name, the exact fallback is `VENTA PUBLICO`.

## Scope

### In scope

- Resolve a display name from the sale-detail payload.
- Render `Cliente: <nombre>` below the folio on the on-screen ticket.
- Render the same line below the folio in the browser-print HTML.
- Send the normalized customer name to the ESC/POS builder and print the same
  line below the folio.
- Wrap long ESC/POS customer lines with the existing 48-column wrapping logic.
- Add regression coverage for supported payload shapes, fallback behavior, and
  both print paths.

### Out of scope

- Changing the sale creation request or customer selector.
- Changing the Odoo sale-detail endpoint.
- Printing other customer data such as RFC, address, telephone, or email.
- Changing ticket width, margins, typography, totals, logo, or cut behavior.

## Customer-name resolution

A small pure helper will normalize the sale-detail payload. It will return the
first non-empty name from this ordered list:

1. `partner_name`
2. `partner_id[1]` when `partner_id` is an Odoo many2one array
3. a name-like value inside an object-form `partner_id`
4. `customer_name`
5. `customer`
6. `VENTA PUBLICO`

Values are converted to text and trimmed. Numeric identifiers alone are not
treated as names.

Keeping this normalization outside the React component makes the payload
contract explicit and directly testable. The component and printers receive one
normalized `customerName` string.

## Rendering and data flow

`ScreenTicket` loads the sale detail as it does today and derives
`customerName` from the loaded order.

The on-screen ticket renders:

```text
Folio: S00123
Cliente: Abarrotes Centro
```

The browser-print HTML renders the same line in the metadata block, using the
existing HTML escaping helper.

The QZ call receives `customerName`. `buildEscPosTicket` prints
`Cliente: <nombre>` immediately after the folio and before the separator. Each
wrapped line stays in the approved double-height body mode.

No navigation state is used, so reloading the ticket or opening a historical
sale produces the same result.

## Fallbacks and safety

- Missing, blank, malformed, or ID-only customer data prints
  `Cliente: VENTA PUBLICO`.
- Browser HTML escapes the name before interpolation.
- ESC/POS uses the existing plain-text wrapping path.
- No additional customer PII is read or rendered.

## Testing

Automated tests will verify:

- each supported customer payload shape;
- whitespace trimming and the exact public-sale fallback;
- ESC/POS output includes the normalized line in the correct location and keeps
  the 48-column layout;
- browser-print HTML includes an escaped customer line;
- the on-screen ticket includes the customer line;
- existing ticket readability, geometry, and printer reset contracts remain
  unchanged.

The focused tests must be observed failing before production changes, then pass
after the minimal implementation. The full test suite, lint, and production
build will run before completion.

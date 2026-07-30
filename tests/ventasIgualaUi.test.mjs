import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src')
const readSrc = (relativePath) => readFileSync(join(SRC, relativePath), 'utf8')

test('TicketDocument is a read-only repeatable 80 mm ticket with the normalized sale details', () => {
  const ticket = readSrc('modules/ventas-iguala/TicketDocument.jsx')

  assert.match(ticket, /className="gf-ticket-document"/)
  assert.match(ticket, /printId/)
  assert.match(ticket, /America\/Mexico_City/)
  for (const label of ['GRUPO FRIO', 'Folio:', 'Cliente:', 'Subtotal', 'TOTAL', 'Metodo de pago:']) {
    assert.match(ticket, new RegExp(label))
  }
  assert.match(ticket, /payment\.breakdown/)
  assert.match(ticket, /width:\s*80mm/)
  assert.match(ticket, /break-after:\s*page/)
  assert.match(ticket, /\.gf-ticket-document:last-child\s*\{\s*break-after:\s*auto/)
  assert.ok(!/\bfetch\s*\(/.test(ticket), 'presentation document does not fetch')
  assert.ok(!/useNavigate|navigate\s*\(/.test(ticket), 'presentation document does not navigate')
  assert.ok(!/cancelSaleOrder|\bdoCancel\b/.test(ticket), 'presentation document does not cancel sales')
  assert.ok(!/window\.print\s*\(/.test(ticket), 'presentation document does not print by itself')
})

test('batch print styling hides history UI and exposes only its sibling wrapper when printing', () => {
  const ticket = readSrc('modules/ventas-iguala/TicketDocument.jsx')

  assert.match(ticket, /\.gf-batch-ticket-print\s*\{\s*display:\s*none/)
  assert.match(ticket, /@media print\s*\{[\s\S]*\.ventas-iguala-screen\s*\{\s*display:\s*none\s*!important/)
  assert.match(ticket, /@media print\s*\{[\s\S]*\.gf-batch-ticket-print\s*\{\s*display:\s*block\s*!important/)

  // The batch wrapper is deliberately a sibling: nesting it inside the interactive
  // history node would make the print rule hide the tickets too.
  const siblingContract = '<><div className="ventas-iguala-screen"></div><div className="gf-batch-ticket-print"></div></>'
  assert.match(siblingContract, /ventas-iguala-screen[\s\S]*<\/div><div className="gf-batch-ticket-print"/)
})

test('ScreenVentasIguala is a standalone CDMX sales history with selection and batch-print workflow', () => {
  const screen = readSrc('modules/ventas-iguala/ScreenVentasIguala.jsx')

  assert.match(screen, /import TicketDocument from ['"]\.\/TicketDocument['"]/)
  assert.match(screen, /getIgualaSalesHistory/)
  assert.match(screen, /getIgualaSalesTickets/)
  assert.match(screen, /toggleOrderSelection/)
  assert.match(screen, /togglePageSelection/)
  assert.match(screen, /selectedAmount/)
  assert.match(screen, /MAX_SELECTED_TICKETS/)
  assert.match(screen, /America\/Mexico_City/)
  assert.match(screen, /setTimeout\([^,]+,\s*300\)/)
  assert.match(screen, /requestSeq\.current/)
  assert.match(screen, /className="ventas-iguala-screen"/)
  assert.match(screen, /className="gf-batch-ticket-print"/)
  assert.match(screen, /Iguala/)
  assert.match(screen, /Responsable/)
  assert.match(screen, /Líneas/)
  assert.match(screen, /Pago/)
  assert.match(screen, /Reintentar/)
  assert.match(screen, /window\.print\(\)/)
  assert.match(screen, /disabled=\{[^}]*filtersUpdating[^}]*\}/)
  assert.ok(!/AdminShell/.test(screen), 'screen does not mount an admin shell')
  assert.ok(!/<\w*Provider\b/.test(screen), 'screen does not mount its own provider')

  const siblingContract = '<><section className="ventas-iguala-screen"></section><div className="gf-batch-ticket-print"></div></>'
  assert.match(siblingContract, /ventas-iguala-screen[\s\S]*<\/section><div className="gf-batch-ticket-print"/)
})

test('TicketDocument stays isolated from the current POS ticket flow', () => {
  const screen = readSrc('modules/admin/ScreenTicket.jsx')

  assert.match(screen, /printTicketViaQz/)
  assert.match(screen, /submitPosCancellation/)
  assert.ok(!/import TicketDocument/.test(screen), 'Ventas Iguala does not replace the current POS ticket flow')
})

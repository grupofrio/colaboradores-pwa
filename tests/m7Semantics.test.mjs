// KOLD OS · M7 — semántica honesta: cada sección dice lo que mide y niega lo que
// no. Barre AFIRMACIONES en la pantalla y el meta, no palabras sueltas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { M7_INCIDENCES_NOTE } from '../src/modules/rentabilidad-costos/m7/m7Meta.js'
import { M7_API_LATEST_FIXTURE } from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const screen = readFileSync(
  new URL('../src/modules/rentabilidad-costos/ScreenRentabilidadCostosM7.jsx', import.meta.url), 'utf8')
const flat = screen.replace(/\s+/g, ' ')
const F = M7_API_LATEST_FIXTURE

// ── pedido ≠ ingreso · factura ≠ cobro ───────────────────────────────────────
test('la sección de ingresos declara pedido≠ingreso y factura≠cobro', () => {
  assert.match(flat, /Pedido ≠ ingreso; factura ≠ cobro/)
  assert.match(flat, /POR MONEDA — jamás sumados/)
})

test('sale_order confirmado no se presenta como ingreso', () => {
  // confirmed_count existe en el fixture pero NO se pinta como dinero.
  assert.equal(typeof F.metrics.sale_order_metrics[0].confirmed_count, 'number')
  assert.ok(!/Ingreso[^.]{0,40}confirmed_count/i.test(flat))
})

// ── costo estándar ACTUAL ≠ COGS/margen ──────────────────────────────────────
test('la presencia de costo estándar actual se separa de COGS y margen', () => {
  assert.match(flat, /Presencia de costo estándar ACTUAL \(NO es COGS ni margen\)/)
  assert.match(flat, /No representa costo histórico de venta, COGS ni margen/)
})

// ── match histórico: null, jamás 0, sin barra 0% ─────────────────────────────
test('el match histórico se muestra NO EVALUABLE con count null (nunca 0 ni 728)', () => {
  assert.match(flat, /Match de costo histórico/)
  assert.match(flat, /NO EVALUABLE/)
  assert.match(flat, /Un null jamás se pinta como 0/)
  // no debe existir una barra de porcentaje de match ni un "0%".
  assert.ok(!/match[^.]{0,30}0\s*%/i.test(flat), 'no debe pintar 0% de match')
  assert.equal(F.capabilities.historical_sales_cost_match_count, null)
})

// ── SVL: "costo unitario no positivo", NUNCA "capas rotas" ────────────────────
test('SVL se describe como costo unitario no positivo, no como capas rotas', () => {
  assert.match(flat, /costo unitario no positivo/i)
  assert.ok(!/capas rotas/i.test(flat), 'no debe decir "capas rotas"')
  // svl_create_date se declara como fecha técnica, no económica.
  assert.match(flat, /svl_create_date[^]{0,60}NO fecha económica/)
})

// ── gastos: 0 líneas no afirma "no hubo gastos" ──────────────────────────────
test('gasto en cero no se afirma como ausencia de gastos', () => {
  assert.match(flat, /No afirma ausencia de gastos/)
  assert.ok(!/no hubo gastos/i.test(flat), 'prohibido afirmar "no hubo gastos"')
  assert.ok(!/no hay gastos/i.test(flat), 'prohibido afirmar "no hay gastos"')
  assert.equal(F.metrics.expense_analytic_metrics[0].expense_line_count, 0)
})

// ── team_id ≠ canal validado ─────────────────────────────────────────────────
test('team_id se presenta como equipo técnico, no como canal validado', () => {
  assert.match(flat, /team_id es EQUIPO comercial técnico, no un canal comercial validado/)
  // "canal validado" sólo puede aparecer NEGADO.
  const rx = /canal comercial validado/gi
  let m
  while ((m = rx.exec(flat)) !== null) {
    const antes = flat.slice(Math.max(0, m.index - 30), m.index)
    assert.match(antes, /\bno\b/i, `"canal comercial validado" sin negar: …${antes}`)
  }
})

// ── flota/rutas: señales, sin cálculo de costo ───────────────────────────────
test('flota y rutas son señales sin costo observable', () => {
  assert.match(flat, /Flota y rutas \(señales; sin costo observable\)/)
  assert.match(flat, /No se calcula costo por km\/ruta\/kg/)
})

// ── FX/consolidación ─────────────────────────────────────────────────────────
test('la consolidación se declara imposible sin tasas históricas', () => {
  assert.match(flat, /no se suma MXN\+USD ni se convierte con tasa actual/)
  assert.match(flat, /MULTI-MONEDA SIN CONSOLIDAR/)
})

// ── nota de incidencias ──────────────────────────────────────────────────────
test('la nota de incidencias niega registros únicos, pesos y pérdida', () => {
  assert.match(M7_INCIDENCES_NOTE, /Sumatoria de incidencias por regla/)
  assert.match(M7_INCIDENCES_NOTE, /No representa registros únicos, pesos ni pérdida económica/)
})

// ── ejes independientes ──────────────────────────────────────────────────────
test('los 4 ejes se declaran independientes y RED≠incumplimiento', () => {
  assert.match(flat, /classification · verdict · severity · lifecycle no se derivan uno de otro/)
  assert.match(flat, /status=RED NO es incumplimiento/)
})

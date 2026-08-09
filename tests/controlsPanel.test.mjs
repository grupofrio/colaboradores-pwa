// Fase 3 · panel de controles — catálogo, formato y estados honestos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  CONTROL_RULES,
  CONTROL_RULE_KEYS,
  CONTROL_PERIODS,
  controlReasonText,
  formatTotal,
  ruleMeta,
} from '../src/modules/gerente/v2/controles/controlsCatalog.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// ── Catálogo ─────────────────────────────────────────────────────────────────

test('las 15 reglas están, con las claves exactas del backend', () => {
  assert.equal(CONTROL_RULES.length, 15)
  assert.deepEqual(CONTROL_RULE_KEYS, [
    'expense_duplicate', 'expense_splitting', 'expense_no_receipt',
    'expense_backdating', 'expense_looks_deposit', 'expense_no_dimension',
    'pos_cancellations', 'pos_underprice', 'pos_off_hours',
    'cash_recurring_diff', 'cash_reopens', 'cash_manual_adjust',
    'requis_stuck_receipt', 'fuel_no_route',
    'sale_in_cut_and_route',
  ])
})

test('la regla 15 (cruce de canales) está bien declarada', () => {
  const r = ruleMeta('sale_in_cut_and_route')
  assert.ok(r, 'sale_in_cut_and_route debe existir en el catálogo')
  assert.equal(r.category, 'cruce')
  assert.equal(r.severity, 'error')
  assert.equal(r.unit, 'money')
})

test('cada regla tiene categoría, etiqueta, descripción y unidad', () => {
  for (const r of CONTROL_RULES) {
    assert.ok(r.category && r.label && r.desc, r.key)
    assert.ok(['money', 'count', 'rate', null].includes(r.unit ?? null), `${r.key} unidad`)
    assert.ok(['error', 'warning'].includes(r.severity), `${r.key} severity`)
  }
})

test('los 3 períodos son today/week/month', () => {
  assert.deepEqual(CONTROL_PERIODS.map((p) => p.key), ['today', 'week', 'month'])
})

// ── Formato (null ≠ 0) ───────────────────────────────────────────────────────

test('formatTotal pinta «—» para null, no $0.00', () => {
  const money = ruleMeta('expense_duplicate')
  assert.equal(formatTotal(money, null), '—')
  assert.equal(formatTotal(money, undefined), '—')
  // Un cero REAL sí se pinta.
  assert.equal(formatTotal(money, 0), '$0.00')
  assert.equal(formatTotal(money, 1234.5), '$1,234.50')
})

test('formatTotal respeta la unidad de la regla', () => {
  assert.equal(formatTotal(ruleMeta('cash_reopens'), 3), '3') // count
  assert.equal(formatTotal({ unit: 'rate' }, 12.34), '12.3%')
})

test('controlReasonText traduce los motivos del backend', () => {
  assert.match(controlReasonText('requires_full_registry'), /logística|rutas/i)
  assert.ok(controlReasonText('motivo_inexistente'))  // default legible
})

// ── Estados honestos en la vista ─────────────────────────────────────────────

test('la vista distingue available:false / count 0 / count>0', () => {
  const view = src('../src/modules/gerente/v2/controles/ControlsView.jsx')
  // available:false → SIN FUENTE (gris)
  assert.match(view, /SIN FUENTE/)
  // count 0 → SIN HALLAZGOS verde
  assert.match(view, /SIN HALLAZGOS/)
  assert.match(view, /Sin hallazgos ✅/)
  // count>0 → REVISAR
  assert.match(view, /REVISAR/)
  // El total nulo nunca se fuerza a 0 en el conteo de hallazgos.
  assert.match(view, /r\.available !== false \? Number\(r\.count \|\| 0\) : 0/)
})

test('solo se puede drill cuando hay hallazgos (no en available:false ni count 0)', () => {
  const view = src('../src/modules/gerente/v2/controles/ControlsView.jsx')
  assert.match(view, /const clickable = rule\.available !== false && count > 0/)
})

// ── Contador rojo en Hoy (null ≠ 0) ──────────────────────────────────────────

test('el banner de Hoy solo aparece con hallazgos > 0', () => {
  const hoy = src('../src/modules/gerente/v2/hoy/HoyGerenteView.jsx')
  assert.match(hoy, /Number\(controlsCount\) > 0/)
  // El fetch del contador es fail-soft (no tumba Hoy).
  const tab = src('../src/modules/gerente/v2/tabs/HoyGerenteTab.jsx')
  assert.match(tab, /getControls\('today'\)/)
  assert.match(tab, /\.catch\(\(\) => \{\}\)/)
})

// ── Read-only ────────────────────────────────────────────────────────────────

test('el panel de controles es read-only: sin escrituras', () => {
  for (const f of [
    '../src/modules/gerente/v2/tabs/ControlesGerenteTab.jsx',
    '../src/modules/gerente/v2/controles/ControlsView.jsx',
    '../src/modules/gerente/v2/controles/ControlDetailView.jsx',
  ]) {
    assert.doesNotMatch(src(f), /api\('POST'|api\('PUT'|api\('DELETE'/, `${f} no debe escribir`)
  }
})

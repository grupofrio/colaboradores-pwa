/**
 * MGR-FINAL-02 / FE#159 selectivo — legacy hub Gerente deja de usar ORM+sudo
 * para alerts/KPI/forecasts/unlock. Debe ir a `/gf/salesops/gerente/v2/*`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const api = readFileSync(fileURLToPath(new URL('../src/lib/api.js', import.meta.url)), 'utf8')

function sliceDirectGerente() {
  const start = api.indexOf('async function directGerente')
  assert.ok(start > 0, 'directGerente exists')
  const end = api.indexOf('async function directAdmin', start)
  assert.ok(end > start, 'directAdmin follows directGerente')
  return api.slice(start, end)
}

test('MGR-FINAL-02: alerts/KPI/forecasts/unlock van a gerente/v2 (no ORM+sudo)', () => {
  const src = sliceDirectGerente()
  for (const path of ['alerts', 'kpi-summary', 'forecasts-locked', 'forecast-unlock']) {
    assert.match(src, new RegExp(`/pwa-gerente/${path}`), path)
    assert.match(src, new RegExp(`GERENTE_V2_BASE}/${path}`), `${path} → V2`)
  }
  // No client-chosen company_id domain + sudo for these four.
  assert.doesNotMatch(src, /readModelSorted\('gf\.ops\.event_log'/)
  assert.doesNotMatch(src, /readModelSorted\('gf\.saleops\.kpi\.snapshot'/)
  assert.doesNotMatch(src, /readModelSorted\('gf\.saleops\.forecast'/)
  assert.doesNotMatch(src, /action_reset_to_draft/)
  assert.doesNotMatch(src, /createUpdate\(\{[\s\S]*gf\.saleops\.forecast/)
})

test('MGR-FINAL-02: KPI preserva null ≠ 0 (has_data)', () => {
  const src = sliceDirectGerente()
  assert.match(src, /has_data/)
  assert.match(src, /sales_today: null/)
  assert.doesNotMatch(src, /sales_today:\s*0,\s*forecast:\s*0,\s*available:\s*0/)
})

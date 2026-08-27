import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AUTO_RETRY_DELAYS_MS,
  ODOO_UNAVAILABLE_MESSAGE,
  isOdooUnavailableError,
  isOdooUnavailablePayload,
  looksLikeOdooHtml,
  unavailableMetric,
} from '../src/lib/odooAvailability.js'

test('HTML de Odoo.sh y 503 se clasifican como indisponibilidad', () => {
  assert.equal(looksLikeOdooHtml('<html>Odoo.sh | Platform Error — Service Unavailable</html>'), true)
  assert.equal(looksLikeOdooHtml('{"ok":true}'), false)
  assert.equal(isOdooUnavailableError({ status: 503, message: 'Service Unavailable' }), true)
  assert.equal(isOdooUnavailableError({ status: 504 }), true)
  assert.equal(isOdooUnavailableError({ status: 0, code: 'network' }), true)
  assert.equal(isOdooUnavailableError({ code: 'timeout' }), true)
  assert.equal(isOdooUnavailableError({ status: 401, message: 'unauthorized' }), false)
  assert.equal(isOdooUnavailableError({ status: 403, code: 'scope_ambiguous' }), false)
  assert.equal(isOdooUnavailableError(new Error('boom')), false)
  assert.equal(isOdooUnavailablePayload({
    error: '<html><title>Odoo.sh | Platform Error</title></html>',
  }), true)
  assert.equal(isOdooUnavailablePayload({ ok: true, data: { items: [] } }), false)
})

test('métrica indisponible no publica importes en cero', () => {
  const metric = unavailableMetric('odoo_unavailable')
  assert.equal(metric.available, false)
  assert.equal(metric.count, null)
  assert.equal(metric.total, null)
  assert.equal(metric.reason, 'odoo_unavailable')
  assert.equal(ODOO_UNAVAILABLE_MESSAGE, 'Servicio de Odoo temporalmente no disponible.')
  assert.deepEqual([...AUTO_RETRY_DELAYS_MS], [1500, 4000, 8000])
})

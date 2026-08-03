import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isOperationalDate,
  previousOperationalDate,
} from '../src/modules/supervisor-ventas/dayControl/operationalDate.js'

test('valida únicamente fechas civiles YYYY-MM-DD reales', () => {
  assert.equal(isOperationalDate('2026-07-24'), true)
  assert.equal(isOperationalDate('2024-02-29'), true)
  assert.equal(isOperationalDate('0000-01-01'), false)
  for (const value of [
    '2026-02-29',
    '2026-13-01',
    '2026-00-01',
    '2026-01-32',
    '2026-01-01T00:00:00Z',
    '',
    null,
  ]) {
    assert.equal(isOperationalDate(value), false)
  }
})

test('obtiene ayer en cambios de mes, año y bisiesto', () => {
  assert.equal(previousOperationalDate('2026-07-24'), '2026-07-23')
  assert.equal(previousOperationalDate('2026-03-01'), '2026-02-28')
  assert.equal(previousOperationalDate('2024-03-01'), '2024-02-29')
  assert.equal(previousOperationalDate('2026-01-01'), '2025-12-31')
})

test('preserva cuatro dígitos al restar dentro de un año temprano', () => {
  assert.equal(previousOperationalDate('0001-07-24'), '0001-07-23')
})

test('preserva cuatro dígitos al cruzar hacia un año de tres cifras', () => {
  assert.equal(previousOperationalDate('1000-01-01'), '0999-12-31')
})

test('rechaza una fecha inválida en vez de adivinar', () => {
  assert.throws(
    () => previousOperationalDate('2026-02-29'),
    { name: 'TypeError', message: /fecha operativa/i },
  )
})

test('rechaza una fecha operativa anterior que no se puede representar', () => {
  assert.throws(
    () => previousOperationalDate('0001-01-01'),
    { name: 'RangeError', message: /fecha operativa anterior no representable/i },
  )
})

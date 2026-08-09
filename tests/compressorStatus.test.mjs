import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatRelative,
  oilAlertTone,
  parseOdooDatetime,
  stateLabel,
} from '../src/modules/shared/compresores/compressorStatus.js'

test('sin registro NO se pinta como apagado', () => {
  const unknown = stateLabel('unknown')
  const off = stateLabel('off')
  assert.equal(unknown.label, 'Sin registro')
  assert.equal(off.label, 'Apagado')
  assert.notEqual(unknown.label, off.label)
  assert.notEqual(unknown.tone, off.tone)
})

test('un estado desconocido cae en "Sin registro", no en "Apagado"', () => {
  assert.equal(stateLabel(undefined).label, 'Sin registro')
  assert.equal(stateLabel('vapor').label, 'Sin registro')
})

test('estado encendido tiene su propia etiqueta', () => {
  assert.equal(stateLabel('on').label, 'Encendido')
})

test('sin alerta de aceite no hay tono', () => {
  assert.equal(oilAlertTone(null), null)
  assert.equal(oilAlertTone(''), null)
})

test('nivel bajo y lectura vencida tienen tonos distintos', () => {
  assert.equal(oilAlertTone('nivel_bajo').tone, 'error')
  assert.equal(oilAlertTone('lectura_vencida').tone, 'warning')
})

test('una alerta nueva del backend no rompe la UI', () => {
  assert.equal(oilAlertTone('codigo_que_no_conocemos').tone, 'warning')
})

test('parseOdooDatetime trata el naive de Odoo como UTC', () => {
  const parsed = parseOdooDatetime('2026-08-09 12:00:00')
  assert.equal(parsed.toISOString(), '2026-08-09T12:00:00.000Z')
})

test('parseOdooDatetime respeta un offset explicito', () => {
  const parsed = parseOdooDatetime('2026-08-09T12:00:00+00:00')
  assert.equal(parsed.toISOString(), '2026-08-09T12:00:00.000Z')
})

test('parseOdooDatetime devuelve null para basura', () => {
  assert.equal(parseOdooDatetime(''), null)
  assert.equal(parseOdooDatetime('no-es-fecha'), null)
})

test('formatRelative resume minutos y horas', () => {
  const now = Date.now()
  const minutesAgo = new Date(now - 25 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  const hoursAgo = new Date(now - 5 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  assert.equal(formatRelative(minutesAgo), 'hace 25 min')
  assert.equal(formatRelative(hoursAgo), 'hace 5 h')
})

test('formatRelative no inventa cuando no hay fecha', () => {
  assert.equal(formatRelative(null), '—')
})

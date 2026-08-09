import test from 'node:test'
import assert from 'node:assert/strict'

import { ENERGY_PERIODS, validatePeriodForm } from '../src/modules/supervision/energyPeriods.js'

const PHOTO = { name: 'medidor.jpg' }

function form(overrides = {}) {
  return { base: '100', intermedia: '50', punta: '25', photo: PHOTO, ...overrides }
}

test('los tres registros del medidor son obligatorios', () => {
  ENERGY_PERIODS.forEach(({ key, label }) => {
    const result = validatePeriodForm(form({ [key]: '' }))
    assert.equal(result.ok, false)
    assert.equal(result.errors[key], `Captura la lectura ${label}`)
  })
})

test('una captura completa con foto pasa', () => {
  const result = validatePeriodForm(form())
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, {})
})

test('la foto del medidor es obligatoria', () => {
  const result = validatePeriodForm(form({ photo: null }))
  assert.equal(result.ok, false)
  assert.equal(result.errors.photo, 'Foto del medidor obligatoria')
})

test('rechaza lecturas negativas', () => {
  const result = validatePeriodForm(form({ punta: '-1' }))
  assert.equal(result.ok, false)
  assert.match(result.errors.punta, /negativa/)
})

test('cada fin debe ser >= SU inicio, aunque el total suba', () => {
  const start = {
    capture_mode: 'periods',
    kwh_base: 100,
    kwh_intermedia: 50,
    kwh_punta: 25,
  }
  // Total sube (+20) pero PUNTA baja de 25 a 24.
  const result = validatePeriodForm(form({ base: '130', intermedia: '60', punta: '24' }), start)
  assert.equal(result.ok, false)
  assert.equal(result.errors.base, undefined)
  assert.equal(result.errors.intermedia, undefined)
  assert.match(result.errors.punta, /menor que inicio/)
})

test('acepta un fin igual al inicio en un periodo (medidor sin avance)', () => {
  const start = {
    capture_mode: 'periods',
    kwh_base: 100,
    kwh_intermedia: 50,
    kwh_punta: 25,
  }
  const result = validatePeriodForm(form({ base: '110', intermedia: '50', punta: '25' }), start)
  assert.equal(result.ok, true)
})

test('no compara contra una lectura unica legacy: no hay con que comparar', () => {
  const legacyStart = { capture_mode: 'single', kwh_value: 900 }
  const result = validatePeriodForm(form({ base: '1', intermedia: '1', punta: '1' }), legacyStart)
  assert.equal(result.ok, true)
})

test('firstError respeta el orden de la pantalla: base, intermedia, punta, foto', () => {
  const result = validatePeriodForm({ base: '', intermedia: '', punta: '', photo: null })
  assert.equal(result.firstError, 'Captura la lectura Base')
})

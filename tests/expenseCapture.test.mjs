// Bloque 1 — reglas de la captura de gastos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  businessToday,
  dimensionChips,
  looksLikeDeposit,
  minCaptureDate,
  validateExpenseDate,
} from '../src/modules/admin/expenseCapture.js'

// ── Cota de fecha ───────────────────────────────────────────────────────────

test('la fecha del gasto no puede ser futura', () => {
  assert.match(validateExpenseDate('2026-08-08', 7, '2026-08-07'), /futura/)
  assert.equal(validateExpenseDate('2026-08-07', 7, '2026-08-07'), '')
})

test('la fecha no puede pasar de N días hacia atrás', () => {
  // Con N=7 y hoy=2026-08-07, el límite es 2026-07-31 inclusive.
  assert.equal(validateExpenseDate('2026-07-31', 7, '2026-08-07'), '')
  assert.match(validateExpenseDate('2026-07-30', 7, '2026-08-07'), /7 días/)
})

test('minCaptureDate cruza el fin de mes sin romperse', () => {
  assert.equal(minCaptureDate(7, '2026-08-03'), '2026-07-27')
  assert.equal(minCaptureDate(7, '2026-03-05'), '2026-02-26')  // año bisiesto
  assert.equal(minCaptureDate(0, '2026-08-07'), '2026-08-07')
})

test('N inválido cae al default de 7 en vez de dejar pasar cualquier fecha', () => {
  assert.equal(minCaptureDate(undefined, '2026-08-07'), '2026-07-31')
  assert.equal(minCaptureDate('abc', '2026-08-07'), '2026-07-31')
})

test('sin fecha se pide la fecha', () => {
  assert.match(validateExpenseDate('', 7, '2026-08-07'), /Selecciona/)
})

test('businessToday usa la zona de negocio, no UTC', () => {
  // 2026-08-08T04:00Z todavía es 7 de agosto en México (-06).
  assert.equal(businessToday(new Date('2026-08-08T04:00:00Z')), '2026-08-07')
  assert.equal(businessToday(new Date('2026-08-08T07:00:00Z')), '2026-08-08')
})

// ── Guard suave de depósitos ────────────────────────────────────────────────

test('detecta depósitos y retiros escritos como gasto', () => {
  // Caso REAL medido en producción: "DEPOSITO WALMART" por $10,010.
  assert.equal(looksLikeDeposit('DEPOSITO WALMART'), true)
  assert.equal(looksLikeDeposit('depósito banco'), true)
  assert.equal(looksLikeDeposit('Retiro de caja'), true)
  assert.equal(looksLikeDeposit('RETIRO'), true)
})

test('no se dispara con gastos legítimos', () => {
  for (const text of ['COMBUSTIBLE LOCAL', 'PASAJES', 'GARRAFONES DE AGUA', 'Papelería']) {
    assert.equal(looksLikeDeposit(text), false, text)
  }
})

test('coincide por PALABRA, no por substring', () => {
  // Sin esto, cualquier texto que contenga las letras dispararía el aviso y la
  // capturista aprendería a ignorarlo.
  assert.equal(looksLikeDeposit('predepositado'), false)
  assert.equal(looksLikeDeposit('retirointernacional'), false)
  assert.equal(looksLikeDeposit(''), false)
  assert.equal(looksLikeDeposit(null), false)
})

// ── Chips de dimensiones ────────────────────────────────────────────────────

test('arma los tres chips que pidió dirección', () => {
  const chips = dimensionChips({
    plaza: { id: 931, code: 'IGU34', name: 'Iguala Glaciem' },
    un: { id: 864, code: 'CDS', name: 'CEDIS' },
    cc: { id: 471, code: '', name: 'CC-COM-IGU-VENTAS' },
  })

  assert.deepEqual(chips.map(c => c.value), ['IGU34', 'CEDIS', 'CC-COM-IGU-VENTAS'])
  assert.deepEqual(chips.map(c => c.key), ['plaza', 'un', 'cc'])
})

test('sin dimensiones no inventa chips', () => {
  assert.deepEqual(dimensionChips(null), [])
  assert.deepEqual(dimensionChips({}), [])
  // Parcial: solo lo que el servidor devolvió.
  assert.equal(dimensionChips({ plaza: { id: 931, code: 'IGU34' } }).length, 1)
})

// ── Bloque 2 — requisiciones ────────────────────────────────────────────────

test('la captura móvil de requisiciones con texto libre ya no existe', () => {
  // Mandaba `product_name` sin `product_id`: una requisición así no se puede
  // costear, no se puede recibir contra un producto real y no lleva analítica.
  const screen = readFileSync(
    fileURLToPath(new URL('../src/modules/admin/ScreenRequisiciones.jsx', import.meta.url)),
    'utf8',
  )
  assert.doesNotMatch(screen, /product_name/)
  assert.doesNotMatch(screen, /MobileRequisiciones/)
  assert.doesNotMatch(screen, /innerWidth/)
  assert.match(screen, /AdminRequisicionForm/)

  // Y el formulario que queda sí usa el catálogo real.
  const form = readFileSync(
    fileURLToPath(new URL('../src/modules/admin/forms/AdminRequisicionForm.jsx', import.meta.url)),
    'utf8',
  )
  assert.match(form, /ProductPicker/)
  assert.doesNotMatch(form, /product_name:/)
})

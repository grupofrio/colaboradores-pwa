import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Contrato del control de conversión: el umbral y el esperado los decide
// Odoo. Si alguien reintroduce el cálculo en el cliente, esto se cae.

const API = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
const MILLING = readFileSync(new URL('../src/modules/shared/millingAPI.js', import.meta.url), 'utf8')
const SCREEN = readFileSync(new URL('../src/modules/transformaciones/TransformationScreen.jsx', import.meta.url), 'utf8')
const NOTICE = readFileSync(new URL('../src/modules/transformaciones/components/RecountNotice.jsx', import.meta.url), 'utf8')
const HUB = readFileSync(new URL('../src/modules/supervision/ScreenSupervision.jsx', import.meta.url), 'utf8')

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('las 3 rutas de molido van por JSON-RPC a Odoo', () => {
  const block = API.split('const MILLING_ROUTES = new Set([')[1].split('])')[0]
  ;['/api/production/milling/evaluate',
    '/api/production/milling/record-counts',
    '/api/production/milling/daily-summary'].forEach((r) => {
    assert.ok(block.includes(r), `falta la ruta ${r}`)
  })
  assert.match(API, /MILLING_ROUTES\.has\(cleanPath\)[\s\S]{0,80}odooJson\(cleanPath/)
})

test('millingAPI no toca el ORM ni manda employee_id', () => {
  const code = stripComments(MILLING)
  ;['createUpdate', 'readModel', 'sudo', 'employee_id'].forEach((forbidden) => {
    assert.ok(!code.includes(forbidden), `millingAPI no debe usar ${forbidden}`)
  })
})

test('el cliente no decide el umbral ni recalcula el esperado', () => {
  const code = stripComments(SCREEN) + stripComments(NOTICE) + stripComments(MILLING)
  // Nada de umbrales literales ni de derivar el esperado en el navegador.
  assert.ok(!/threshold\s*=\s*\d/.test(code))
  assert.ok(!/requires_recount\s*=/.test(code))
  assert.match(SCREEN, /evaluation\?\.requires_recount/)
})

test('el recuento vacía el campo en vez de pedir confirmación', () => {
  assert.match(SCREEN, /output_qty_units:\s*''/)
  assert.match(SCREEN, /setRecount\(\{\s*firstCount/)
})

test('se registran los DOS conteos, no solo el corregido', () => {
  assert.match(SCREEN, /firstCount:\s*recount\.firstCount/)
  assert.match(SCREEN, /recount:\s*Number\(draft\.output_qty_units\)/)
})

test('una falla del control NO bloquea la captura física', () => {
  // La operación no puede detenerse porque una consulta de control falle:
  // el catch registra el error y sigue, no corta ni relanza.
  const block = SCREEN.split('evaluateMillingVariance({')[1].split('setSaving(true)')[0]
  assert.match(block, /catch/)
  assert.match(block, /logScreenError/)
  assert.ok(!/catch[\s\S]{0,300}throw/.test(block), 'el catch no debe relanzar')
})

test('el aviso ofrece continuar sin cambiar el número', () => {
  assert.match(NOTICE, /Dejar \{firstCount\} y continuar/)
  assert.match(NOTICE, /los dos conteos quedan registrados/)
})

test('el hub muestra el molido del día', () => {
  assert.match(HUB, /<MolidoDelDiaCard/)
})

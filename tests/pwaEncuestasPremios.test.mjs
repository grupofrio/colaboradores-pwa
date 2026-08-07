// Encuestas y Premios — las dos pantallas de TODOS los colaboradores que llevaban
// tiempo mostrando "Error al cargar".
//
// Causa real: `/pwa-surveys` y `/pwa-badges` nunca tuvieron handler y caían al
// fallback de n8n, cuyo workflow W16 está desactivado. Se reponen contra Odoo con
// la credencial real. Y de paso se retira de la pantalla de Encuestas una
// simulación que llevaba dentro: prometía puntos y se marcaba como contestada en
// memoria del navegador, sin que el servidor supiera nada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── Las rutas ya no caen al fallback de n8n ─────────────────────────────────

test('encuestas y premios se resuelven en Odoo, no en n8n', () => {
  const s = src('lib/api.js')
  assert.match(s, /cleanPath === '\/pwa-surveys'/, 'hay handler propio de encuestas')
  assert.match(s, /cleanPath === '\/pwa-badges'/, 'hay handler propio de premios')
  const i = s.indexOf("cleanPath === '/pwa-surveys'")
  const block = s.slice(i, i + 1400)
  assert.match(block, /odooJson\('\/pwa-surveys'/, 'va directo a Odoo')
  assert.match(block, /odooJson\('\/pwa-badges'/)
  assert.doesNotMatch(block, /api-n8n/, 'sin fallback a n8n')
  assert.doesNotMatch(block, /sudo:\s*1/, 'sin lectura privilegiada desde el cliente')
})

test('el shim traduce el envelope de Odoo al que espera la pantalla', () => {
  const s = src('lib/api.js')
  const i = s.indexOf("cleanPath === '/pwa-surveys'")
  const block = s.slice(i, i + 1400)
  // Las pantallas leen `success`, el backend responde `ok`.
  assert.match(block, /success: res\?\.ok !== false/)
  // Forma defensiva: nunca se devuelve undefined donde la pantalla espera lista.
  assert.match(block, /Array\.isArray\(res\?\.data\) \? res\.data : \[\]/)
  assert.match(block, /earned: Array\.isArray\(d\.earned\)/)
  assert.match(block, /total_points: Number\(d\.total_points \|\| 0\)/)
})

// ── La pantalla de Encuestas ya no finge ────────────────────────────────────

test('la encuesta NO se marca como contestada en el navegador', () => {
  const s = src('screens/ScreenSurveys.jsx')
  assert.doesNotMatch(s, /completedIds/, 'sin lista local de "contestadas"')
  assert.match(s, /const displaySurveys = surveys/, 'el estado viene del servidor')
  // Tras responder se RECARGA del servidor en vez de asumir el resultado.
  assert.match(s, /apiGet\("\/pwa-surveys"\)/)
})

test('no se prometen puntos que nadie otorga', () => {
  const s = src('screens/ScreenSurveys.jsx')
  assert.doesNotMatch(s, /points: 80/, 'sin los 80 puntos hardcodeados')
  assert.match(s, /points: null/, 'sin dato ⇒ null, no un número inventado')
  assert.match(s, /survey\.points != null &&/, 'el chip solo se pinta si hay puntos reales')
  assert.doesNotMatch(s, /Puntos ganados/, 'el acuse ya no anuncia puntos')
  assert.doesNotMatch(s, /reflejarán en tu balance/, 'ni promete un balance')
  assert.doesNotMatch(s, /acumular puntos/, 'ni invita a acumularlos')
})

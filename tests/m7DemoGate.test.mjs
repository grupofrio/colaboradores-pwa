// KOLD OS · M7 — gate del fixture demo: fail-closed, producción real JAMÁS.
import test from 'node:test'
import assert from 'node:assert/strict'
import { canLoadM7DemoFixture, isM7DemoAllowed } from '../src/modules/rentabilidad-costos/m7/demoGate.js'

test('DEV local + demo ⇒ permitido', () => {
  assert.equal(canLoadM7DemoFixture({ DEV: true }), true)
})

test('Preview autorizado de Vercel + flag ⇒ permitido', () => {
  assert.equal(canLoadM7DemoFixture(
    { PROD: true, VITE_ENABLE_M7_DEMO: 'true', VITE_VERCEL_ENV: 'preview' }), true)
})

test('producción real + ?demo query (flag) ⇒ NEGADO', () => {
  assert.equal(canLoadM7DemoFixture(
    { PROD: true, VITE_ENABLE_M7_DEMO: 'true', VITE_VERCEL_ENV: 'production' }), false)
})

test('producción con env flag true y SIN señal de preview ⇒ NEGADO (fail-closed)', () => {
  // El bug que Codex marcó: el flag NO debe bastar por sí solo en producción.
  assert.equal(canLoadM7DemoFixture({ PROD: true, VITE_ENABLE_M7_DEMO: 'true' }), false)
})

test('Preview sin flag ⇒ NEGADO', () => {
  assert.equal(canLoadM7DemoFixture({ PROD: true, VITE_VERCEL_ENV: 'preview' }), false)
})

test('usuario NO autorizado ⇒ NEGADO aunque sea DEV', () => {
  assert.equal(canLoadM7DemoFixture({ DEV: true }, { authorized: false }), false)
})

test('env inválido ⇒ NEGADO', () => {
  for (const bad of [null, undefined, 'x', 0]) assert.equal(canLoadM7DemoFixture(bad), false)
})

test('ctx.vercelEnv override gana sobre env (para tests) y niega producción', () => {
  assert.equal(canLoadM7DemoFixture(
    { PROD: true, VITE_ENABLE_M7_DEMO: 'true' }, { vercelEnv: 'production' }), false)
  assert.equal(canLoadM7DemoFixture(
    { PROD: true, VITE_ENABLE_M7_DEMO: 'true' }, { vercelEnv: 'preview' }), true)
})

test('isM7DemoAllowed es la misma política (producción real negada)', () => {
  assert.equal(isM7DemoAllowed({ PROD: true, VITE_ENABLE_M7_DEMO: 'true', VITE_VERCEL_ENV: 'production' }), false)
  assert.equal(isM7DemoAllowed({ DEV: true }), true)
})

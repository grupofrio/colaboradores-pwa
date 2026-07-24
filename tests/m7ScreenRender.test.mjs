// KOLD OS · M7 — render REAL de la pantalla (no funciones puras).
//
// node --test no transpila JSX; el repo no trae jsdom/RTL (añadirlos ampliaría la
// superficie de npm audit que Codex pide reducir). Se transpila la PANTALLA REAL
// con esbuild (dep transitiva de Vite) y se renderiza con react-dom/server bajo
// MemoryRouter. renderToStaticMarkup no corre efectos: por eso la pantalla acepta
// `initialLoad`/`initialSelectedRun` (semilla de estado inicial, default seguros).
import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import * as esbuild from 'esbuild'
import { M7_API_LATEST_FIXTURE } from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const screenPath = fileURLToPath(new URL('../src/modules/rentabilidad-costos/ScreenRentabilidadCostosM7.jsx', import.meta.url))
// Bundle con esbuild (resuelve imports extensionless estilo Vite y el fixture),
// dejando React/Router EXTERNOS para compartir la instancia con react-dom/server.
// `virtual:m7-demo-fixture` queda externo: sólo se importa dinámicamente y nunca se
// ejecuta en SSR (renderToStaticMarkup no corre efectos).
const tmpUrl = new URL(`../src/modules/rentabilidad-costos/__ssr_m7_${process.pid}.mjs`, import.meta.url)
const tmpPath = fileURLToPath(tmpUrl)

const built = await esbuild.build({
  entryPoints: [screenPath], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  platform: 'node', logLevel: 'silent',
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'react/jsx-dev-runtime',
    'react-router-dom', 'virtual:m7-demo-fixture'],
})
writeFileSync(tmpPath, built.outputFiles[0].text)
let Screen
try {
  Screen = (await import(tmpUrl.href)).default
} finally {
  try { rmSync(tmpPath) } catch { /* noop */ }
}

const render = (props) => renderToStaticMarkup(
  createElement(MemoryRouter, { initialEntries: ['/rentabilidad-costos'] },
    createElement(Screen, props)))

const HISTORIC_RUN = {
  run_id: 'bbbb1111bbbb2222bbbb3333bbbb4444bbbb5555bbbb6666bbbb7777bbbb8888',
  scope_key: 'ssss1111ssss2222ssss3333ssss4444ssss5555ssss6666ssss7777ssss8888',
  finished_at: '2026-05-01T00:00:00Z', is_production_shell_run: false,
  measurement_method: 'xml_rpc_read_only', auditor_build_sha: 'deadbeefcafe', finding_count: 9,
}

test('la pantalla real MONTA en estado de carga sin lanzar', () => {
  const html = render({})
  assert.match(html, /Rentabilidad y costos/)
  assert.match(html, /Cargando/)
})

test('con payload latest inyectado: render honesto de L1, sin banner histórico', () => {
  const html = render({ initialLoad: { phase: 'ok', payload: M7_API_LATEST_FIXTURE, demo: true } })
  assert.match(html, /L1 · Ingreso observable/)
  assert.match(html, /MODO DEMO/)
  assert.match(html, /corrida más reciente/)
  assert.ok(!html.includes('m7-historical-notice'), 'sin corrida histórica no debe haber banner histórico')
})

test('con corrida histórica anclada: banner declara vista PARCIAL honestamente', () => {
  const html = render({
    initialLoad: { phase: 'ok', payload: M7_API_LATEST_FIXTURE, demo: true },
    initialSelectedRun: HISTORIC_RUN,
  })
  assert.match(html, /m7-historical-notice/)
  assert.match(html, /Viendo la corrida histórica/)
  assert.match(html, /siguen mostrando la/)
  assert.match(html, /más reciente/)
})

test('estados de error: forbidden se renderiza como pantalla completa', () => {
  const html = render({ initialLoad: { phase: 'forbidden' } })
  assert.match(html, /Sin acceso/)
})

test('la pantalla NO afirma "carga exactamente ese run" (claim retirado)', () => {
  const html = render({ initialLoad: { phase: 'ok', payload: M7_API_LATEST_FIXTURE, demo: true } })
  assert.ok(!/carga EXACTAMENTE ese run/i.test(html))
})

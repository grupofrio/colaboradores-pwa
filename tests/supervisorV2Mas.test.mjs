// Cobertura SSR de la vista PURA MasView (Supervisor V2 · superficie "Más").
// Post-RED (Codex §2/§3): Tareas/Notas/Nota rápida (endpoints legacy inseguros)
// y Bajas (backend no auditado) fueron RETIRADAS de Más V2 ⇒ NO deben aparecer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

const MasView = await loadJsxDefault('src/modules/supervisor-ventas/v2/mas/MasView.jsx')

const render = (props = {}) => renderToStaticMarkup(createElement(MasView, props))

// Contrato: label visible + ruta legacy real. Espejo de los GROUPS de MasView.
const EXPECTED_TILES = [
  { label: 'Pronóstico', route: '/equipo/pronostico' },
  { label: 'Agregar cliente', route: '/equipo/planes/clientes' },
  { label: 'Metas', route: '/equipo/metas' },
  { label: 'Score', route: '/equipo/score-semanal' },
  { label: 'Dashboard', route: '/equipo/dashboard' },
  { label: 'Recuperación', route: '/equipo/recuperacion' },
]

const GROUPS = ['Planeación', 'Desempeño', 'Clientes']
// Excluidas de V2 (§2/§3): no deben enlazarse desde Más.
const EXCLUDED_ROUTES = ['/equipo/tareas', '/equipo/notas', '/equipo/nota-rapida', '/equipo/bajas']

test('MasView: contenedor con testid supervisor-v2-mas', () => {
  const html = render({ onNavigate: () => {} })
  assert.match(html, /data-testid="supervisor-v2-mas"/)
})

test('MasView: renderiza los grupos vigentes (sin Coaching/Administración)', () => {
  const html = render({ onNavigate: () => {} })
  for (const group of GROUPS) {
    assert.ok(html.includes(group), `falta el grupo "${group}"`)
  }
  assert.ok(!html.includes('Coaching'), 'Coaching NO debe aparecer')
  const groupSections = html.match(/data-testid="supervisor-v2-mas-group"/g) || []
  assert.equal(groupSections.length, GROUPS.length)
})

test('MasView: Tareas/Notas/Nota rápida/Bajas NO se enlazan (§2/§3)', () => {
  const html = render({ onNavigate: () => {} })
  for (const route of EXCLUDED_ROUTES) {
    assert.ok(!html.includes(`data-route="${route}"`), `${route} NO debe enlazarse desde V2`)
  }
})

test('MasView: cada tile expone su label y su ruta legacy', () => {
  const html = render({ onNavigate: () => {} })
  for (const { label, route } of EXPECTED_TILES) {
    assert.ok(html.includes(label), `falta el label "${label}"`)
    assert.ok(html.includes(`data-route="${route}"`), `falta la ruta "${route}"`)
  }
})

test('MasView: solo los tiles vigentes, sin placeholders sin fuente', () => {
  const html = render({ onNavigate: () => {} })
  const tiles = html.match(/data-testid="supervisor-v2-mas-tile"/g) || []
  assert.equal(tiles.length, EXPECTED_TILES.length)
  // Toda ruta renderizada empieza en /equipo/ (accesos del rol), nunca vacía.
  const routes = [...html.matchAll(/data-route="([^"]*)"/g)].map((m) => m[1])
  assert.equal(routes.length, EXPECTED_TILES.length)
  for (const r of routes) assert.match(r, /^\/equipo\/.+/)
})

test('MasView: onNavigate puede pasarse como no-op sin romper el render', () => {
  assert.doesNotThrow(() => render({ onNavigate: () => {} }))
})

test('MasView: onNavigate es opcional (sin prop no lanza)', () => {
  assert.doesNotThrow(() => render({}))
})

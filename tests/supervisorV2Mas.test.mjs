// Cobertura SSR de la vista PURA MasView (Supervisor V2 · superficie "Más").
// Post-RED: Tareas/Notas/Nota rápida (§2/§3, endpoints legacy inseguros), Bajas
// (§3, backend no auditado) y Planeación — Pronóstico/Agregar cliente (§1/§3/§4,
// pantallas parcialmente migradas) fueron RETIRADAS de Más V2 ⇒ NO deben aparecer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import { fileURLToPath } from 'node:url'
// Contrato canónico del harness en main: { Component, mod, cleanup } + ruta
// ABSOLUTA. `loadView` adapta las cargas de este archivo a ese contrato.
const loadView = async (rel) => (
  await loadJsxDefault(fileURLToPath(new URL('../' + rel, import.meta.url)))
).Component

const MasView = await loadView('src/modules/supervisor-ventas/v2/mas/MasView.jsx')

const render = (props = {}) => renderToStaticMarkup(createElement(MasView, props))

// Contrato: label visible + ruta legacy real. Espejo de los GROUPS de MasView.
const EXPECTED_TILES = [
  { label: 'Integridad', route: '/equipo/integridad' },
  { label: 'Productos', route: '/equipo/productos' },  // F4.1: enlace a Productos del CEDIS
  { label: 'Metas', route: '/equipo/metas' },
  { label: 'Score', route: '/equipo/score-semanal' },
  { label: 'Dashboard', route: '/equipo/dashboard' },
  { label: 'Recuperación', route: '/equipo/recuperacion' },
]

const GROUPS = ['Desempeño', 'Clientes']
// Excluidas de V2: no deben enlazarse desde Más (deep-links protegidos en App.jsx).
const EXCLUDED_ROUTES = [
  '/equipo/tareas', '/equipo/notas', '/equipo/nota-rapida', '/equipo/bajas',
  '/equipo/pronostico', '/equipo/planes/clientes',
]

test('MasView: contenedor con testid supervisor-v2-mas', () => {
  const html = render({ onNavigate: () => {} })
  assert.match(html, /data-testid="supervisor-v2-mas"/)
})

test('MasView: renderiza solo los grupos vigentes (sin Planeación/Coaching/Administración)', () => {
  const html = render({ onNavigate: () => {} })
  for (const group of GROUPS) {
    assert.ok(html.includes(group), `falta el grupo "${group}"`)
  }
  assert.ok(!html.includes('Coaching'), 'Coaching NO debe aparecer')
  assert.ok(!html.includes('Planeación'), 'Planeación NO debe aparecer (retirada §4)')
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

// ── F4.1: superficie Productos enlazada (reusa ProductsSection, no reconstruye) ──
import { readFileSync } from 'node:fs'
const srcOf = (rel) => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8')

test('F4.1: /equipo/productos ruteada bajo el guard V2 (como Integridad)', () => {
  const app = srcOf('src/App.jsx')
  assert.ok(/ProductosView = lazy\(\(\) => import\('\.\/modules\/supervisor-ventas\/v2\/productos\/ProductosView'\)\)/.test(app), 'ProductosView importado lazy')
  assert.ok(/path="\/equipo\/productos"[^\n]*ModuleRoleRoute moduleId="supervisor_ventas"[^\n]*SupervisorV2Gate[^\n]*ProductosView/.test(app), 'ruta bajo ModuleRoleRoute + SupervisorV2Gate')
})

test('F4.1: ProductosView reusa ProductsSection (enlaza, no reconstruye)', () => {
  const view = srcOf('src/modules/supervisor-ventas/v2/productos/ProductosView.jsx')
  assert.ok(/import \{ ProductsSection \} from '\.\.\/\.\.\/kpis\/PanelKpis'/.test(view), 'reusa ProductsSection de PanelKpis')
  assert.ok(/<ProductsSection key=\{period\} period=\{period\} \/>/.test(view), 'la renderiza con el periodo seleccionado')
  assert.ok(/productos-periodo-/.test(view), 'ofrece selector de periodo')
  // PanelKpis exporta ProductsSection (antes era privada).
  const panel = srcOf('src/modules/supervisor-ventas/kpis/PanelKpis.jsx')
  assert.ok(/export function ProductsSection/.test(panel), 'ProductsSection exportada')
})

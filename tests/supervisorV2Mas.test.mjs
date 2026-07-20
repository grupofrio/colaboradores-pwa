// Cobertura SSR de la vista PURA MasView (Supervisor V2 · superficie "Más").
// Renderiza el .jsx REAL con el harness esbuild (sin jsdom) y verifica:
//   1) el contenedor con su testid;
//   2) los 5 grupos de accesos secundarios (Planeación, Desempeño, Coaching,
//      Clientes, Administración);
//   3) los 10 tiles con su label y su ruta legacy (data-route), sin placeholders;
//   4) onNavigate es opcional / puede pasarse como no-op sin romper el render.
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
  { label: 'Tareas', route: '/equipo/tareas' },
  { label: 'Notas', route: '/equipo/notas' },
  { label: 'Nota rápida', route: '/equipo/nota-rapida' },
  { label: 'Recuperación', route: '/equipo/recuperacion' },
  { label: 'Bajas', route: '/equipo/bajas' },
]

const GROUPS = ['Planeación', 'Desempeño', 'Coaching', 'Clientes', 'Administración']

test('MasView: contenedor con testid supervisor-v2-mas', () => {
  const html = render({ onNavigate: () => {} })
  assert.match(html, /data-testid="supervisor-v2-mas"/)
})

test('MasView: renderiza los 5 grupos de accesos secundarios', () => {
  const html = render({ onNavigate: () => {} })
  for (const group of GROUPS) {
    assert.ok(html.includes(group), `falta el grupo "${group}"`)
  }
  // Exactamente 5 secciones de grupo (ninguna vacía se renderiza).
  const groupSections = html.match(/data-testid="supervisor-v2-mas-group"/g) || []
  assert.equal(groupSections.length, GROUPS.length)
})

test('MasView: cada tile expone su label y su ruta legacy', () => {
  const html = render({ onNavigate: () => {} })
  for (const { label, route } of EXPECTED_TILES) {
    assert.ok(html.includes(label), `falta el label "${label}"`)
    assert.ok(html.includes(`data-route="${route}"`), `falta la ruta "${route}"`)
  }
})

test('MasView: exactamente 10 tiles, sin placeholders sin fuente', () => {
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

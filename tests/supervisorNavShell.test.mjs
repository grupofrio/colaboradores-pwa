// Supervisor V2 · shell de navegación arreglado + módulo "Mis rutas de mañana".
// El bug: el shell pintaba barra INFERIOR fija cuando sw<900 (chocaba con la
// barra inferior de AppNav) ⇒ a zoom normal de escritorio las 6 pestañas se
// tapaban. Fix: rail superior SIEMPRE, sin barra inferior propia. (source-scan;
// la validación visual va por screenshot con Aida.)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')
const SHELL = () => src('modules/supervisor-ventas/v2/SupervisorV2Shell.jsx')
const REGISTRY = () => src('modules/registry.js')

// ── Shell: las 6 pestañas SIEMPRE se pintan, sin barra inferior fija ─────────

test('las 6 superficies siguen declaradas en V2_TABS', () => {
  const s = SHELL()
  for (const key of ['hoy', 'radar', 'rutas', 'clientes', 'pendientes', 'mas']) {
    assert.ok(s.includes(`key: '${key}'`), `falta la pestaña ${key}`)
  }
})

test('el rail NO se gatea por el breakpoint 900 (se ve a ancho normal)', () => {
  const s = SHELL()
  // El <nav role="tablist"> se renderiza SIEMPRE (no dentro de `isDesktop ? ... : null`).
  assert.doesNotMatch(s, /isDesktop \? \(\s*\/\/ Desktop/, 'el rail no debe depender de isDesktop')
  assert.doesNotMatch(s, /const isDesktop = sw >= 900/, 'ya no se decide la nav por isDesktop')
  // El rail se mapea sin condición de ancho, con scroll horizontal si no caben.
  assert.match(s, /overflowX: 'auto'/)
  assert.match(s, /V2_TABS\.map/)
})

test('NO hay barra inferior fija propia (evita la colisión con AppNav)', () => {
  const s = SHELL()
  // Antes: position:'fixed', bottom:0 en el <nav> del shell. No debe volver.
  assert.doesNotMatch(s, /position: 'fixed'[^}]*bottom: 0/s)
  assert.doesNotMatch(s, /bottom: 0[^}]*position: 'fixed'/s)
})

test('touch targets ≥44px y accesibilidad conservada', () => {
  const s = SHELL()
  assert.match(s, /minHeight: 44/)
  assert.match(s, /role="tablist"/)
  assert.match(s, /aria-current=/)
  assert.match(s, /role="tab"/)
})

// ── Registry: "Mis rutas de mañana" entre KPIs (30) y Encuestas (40) ─────────

test('el registry tiene "Mis rutas de mañana" para supervisor_ventas, navPriority 35', () => {
  const r = REGISTRY()
  const block = r.slice(r.indexOf("id:     'supervisor_rutas_manana'"))
  assert.ok(block.length > 0, 'no existe la entrada supervisor_rutas_manana')
  const head = block.slice(0, 400)
  assert.match(head, /route:\s*'\/equipo\/rutas\/planear'/, 'reusa la ruta existente')
  assert.match(head, /roles:\s*\['supervisor_ventas'\]/)
  assert.match(head, /navPriority: 35/)
  assert.match(head, /status: 'live'/)
})

test('queda declarada ENTRE KPIs (30) y Encuestas (40)', () => {
  const r = REGISTRY()
  const iKpis = r.indexOf("id:     'kpis'")
  const iManana = r.indexOf("id:     'supervisor_rutas_manana'")
  const iEnc = r.indexOf("id:     'encuestas'")
  assert.ok(iKpis > 0 && iManana > 0 && iEnc > 0)
  assert.ok(iKpis < iManana && iManana < iEnc, 'orden de declaración KPIs → Mañana → Encuestas')
})

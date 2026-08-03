import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { derivePendingStops, summarizePendingByRoute, hasStopPlan } from '../src/modules/supervisor-ventas/v2/desktop/pendingStops.js'
import { isDesktopWidth } from '../src/modules/supervisor-ventas/v2/desktop/useDesktopBoard.js'
import { DESKTOP_MIN } from '../src/lib/navModel.js'

// Forma REAL medida en producción (radar/1, sucursal 29, recortada).
const RADAR = {
  ok: true,
  contract: 'gf.salesops.supervisor.radar/1',
  units: [
    {
      employee_id: 683, name: 'ALEJANDRO OSORIO BARRERA', plan_id: 6822, route_name: 'Chofer Iguala #5',
      latitude: 18.3565567, longitude: -99.548735, captured_at: '2026-08-02 00:22:54',
      age_seconds: 128, is_moving: true, signal_status: 'recent',
      stops: {
        planned: [
          { stop_id: 1, sequence: 20, name: 'TAQUERIA GUZMAN', latitude: 18.35, longitude: -99.53, done: true },
          { stop_id: 2, sequence: 10, name: 'FONDITAS ISSSTE', latitude: 18.34, longitude: -99.52, done: false },
          { stop_id: 3, sequence: 30, name: 'SIN COORDS', latitude: null, longitude: null, done: false },
        ],
      },
    },
    {
      employee_id: 679, name: 'ESTEBAN ALEMAN SERRADO', plan_id: 6826, route_name: 'ESTEBAN ALEMAN SERRADO',
      latitude: null, longitude: null, captured_at: null, age_seconds: null,
      is_moving: null, signal_status: 'no_signal',
      // Sin `stops` ⇒ plan DESCONOCIDO (no "cero pendientes").
    },
  ],
}

// ── Breakpoint ──────────────────────────────────────────────────────────────

test('el tablero usa el DESKTOP_MIN de la app, no un breakpoint inventado', () => {
  assert.equal(isDesktopWidth(DESKTOP_MIN), true)
  assert.equal(isDesktopWidth(DESKTOP_MIN - 1), false)
  assert.equal(isDesktopWidth(375), false, 'móvil')
  assert.equal(isDesktopWidth(768), false, 'tablet vertical')
})

test('fail-closed hacia móvil ante anchos no numéricos', () => {
  for (const bad of [null, undefined, NaN, '1440', {}]) {
    assert.equal(isDesktopWidth(bad), false, String(bad))
  }
})

// ── Columna 3: se DERIVA, no se vuelve a pedir ──────────────────────────────

test('los clientes por visitar salen del payload de radar ya cargado', () => {
  const { rows, totalPending } = derivePendingStops(RADAR)

  assert.equal(totalPending, 2, 'solo las paradas no visitadas')
  assert.deepEqual(rows.map((r) => r.name), ['FONDITAS ISSSTE', 'SIN COORDS'])
  assert.equal(rows[0].sequence, 10, 'ordenadas por secuencia dentro de la ruta')
  assert.equal(rows[0].routeName, 'Chofer Iguala #5')
})

test('null ≠ 0: una ruta sin plan declarado se nombra, no se cuenta como cero', () => {
  const { unknownRoutes } = derivePendingStops(RADAR)
  assert.deepEqual(unknownRoutes, ['ESTEBAN ALEMAN SERRADO'])

  const resumen = summarizePendingByRoute(RADAR)
  assert.equal(resumen.find((r) => r.planId === 6822).pending, 2)
  assert.equal(resumen.find((r) => r.planId === 6826).pending, null, 'sin plan ⇒ null, nunca 0')
  assert.equal(hasStopPlan(RADAR.units[1]), false)
})

test('no se inventan coordenadas: la parada sin lat/lng se lista pero no es mapeable', () => {
  const { rows } = derivePendingStops(RADAR)
  const sinCoords = rows.find((r) => r.name === 'SIN COORDS')

  assert.equal(sinCoords.mappable, false)
  assert.equal(sinCoords.latitude, null)
  assert.equal(sinCoords.longitude, null)
  assert.equal(rows.find((r) => r.name === 'FONDITAS ISSSTE').mappable, true)
})

test('el filtro por ruta cruza columnas sin pedir nada al backend', () => {
  assert.equal(derivePendingStops(RADAR, 6822).totalPending, 2)
  assert.equal(derivePendingStops(RADAR, 6826).totalPending, 0)
  assert.deepEqual(derivePendingStops(RADAR, 6826).unknownRoutes, ['ESTEBAN ALEMAN SERRADO'])
  assert.equal(derivePendingStops(RADAR, 999999).totalPending, 0, 'ruta inexistente')
})

test('radar ausente o basura no revienta ni finge vacío', () => {
  for (const bad of [null, undefined, {}, { units: null }, { units: 'x' }, 42]) {
    const out = derivePendingStops(bad)
    assert.deepEqual(out.rows, [])
    assert.deepEqual(out.unknownRoutes, [])
  }
})

// ── Reglas duras del contrato radar/1 ───────────────────────────────────────

// Los comentarios explican las reglas y por tanto CITAN las palabras prohibidas.
// Se escanea el código sin comentarios, si no el test se caza a sí mismo.
function withoutComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test('el tablero lleva el banner permanente de retraso y NO promete tiempo real', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/desktop/SupervisorDesktopBoard.jsx', import.meta.url), 'utf8')
  const code = withoutComments(src)

  assert.match(code, /Las posiciones pueden tener retraso\. Consulta la hora de la última señal\./)
  // El banner no puede estar detrás de una condición: vale para todo el tablero.
  assert.ok(!/\{\s*\w+\s*&&\s*\(?\s*<div[^>]*v2-desktop-delay-banner/.test(code), 'banner incondicional')

  for (const prohibido of ['en vivo', 'tiempo real', 'live tracking', 'setInterval', 'requestAnimationFrame']) {
    assert.ok(!code.toLowerCase().includes(prohibido.toLowerCase()), `promete/simula "${prohibido}"`)
  }
})

test('la UI no recalcula ni hardcodea umbrales de frescura', () => {
  const board = readFileSync(new URL('../src/modules/supervisor-ventas/v2/desktop/SupervisorDesktopBoard.jsx', import.meta.url), 'utf8')
  const pending = readFileSync(new URL('../src/modules/supervisor-ventas/v2/desktop/pendingStops.js', import.meta.url), 'utf8')

  for (const src of [board, pending]) {
    assert.ok(!/age_seconds\s*[<>]/.test(src), 'compara edades por su cuenta en vez de leer signal_status')
    assert.ok(!/thresholds\s*=\s*\{/.test(src), 'define umbrales propios')
  }
})

// ── Un solo fetch, y móvil intacto ──────────────────────────────────────────

test('el tablero NO carga datos: los recibe ya resueltos', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/desktop/SupervisorDesktopBoard.jsx', import.meta.url), 'utf8')
  const code = withoutComments(src)

  for (const prohibido of ['useOperationalDay', 'loadOperationalDay', 'getDayControl', 'getRadar', 'fetch(']) {
    assert.ok(!code.includes(prohibido), `el tablero llama a ${prohibido} — debe recibir \`day\` por prop`)
  }
})

test('HoyTab conserva la vista móvil y solo cambia en escritorio', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/tabs/HoyTab.jsx', import.meta.url), 'utf8')

  assert.match(src, /if \(isDesktop\)[\s\S]*?SupervisorDesktopBoard/, 'el tablero solo se monta en escritorio')
  assert.ok(src.includes('<HoyView'), 'la vista móvil sigue ahí')
  // Un solo hook de datos para ambas ramas.
  assert.equal((src.match(/useOperationalDay\(/g) || []).length, 1, 'un solo fetch compartido')
})

test('RutasView mantiene compatibilidad: la selección es opcional', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/rutas/RutasView.jsx', import.meta.url), 'utf8')

  assert.match(src, /selectedPlanId = null/, 'default null ⇒ móvil se ve igual')
  // La selección no se comunica SOLO por color.
  assert.match(src, /boxShadow: selected \?/, 'la fila seleccionada se marca con barra lateral, no solo con fondo')
})

test('la selección de unidades del radar del tablero funciona también con teclado', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/radar/RadarView.jsx', import.meta.url), 'utf8')

  assert.match(src, /onKeyDown=/, 'la fila interactiva debe responder al teclado')
  assert.match(src, /e\.key !== 'Enter' && e\.key !== ' '/, 'Enter y Espacio activan la selección')
  assert.match(src, /e\.preventDefault\(\)/, 'Espacio no debe desplazar la página al seleccionar')
})

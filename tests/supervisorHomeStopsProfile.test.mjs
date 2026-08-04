import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  SUPERVISOR_HOME_ORDER, orderSupervisorHomeModules,
} from '../src/modules/supervisor-ventas/brand/homeOrder.js'
import {
  isNoSale, isVisited, noSaleReason, noSaleReasonDisplay, stopResultLabel,
} from '../src/modules/supervisor-ventas/v2/rutas/stopLabels.js'

// ── 1 · La portada arranca por el trabajo diario ─────────────────────────────

test('el orden pone el trabajo del puesto antes que lo secundario', () => {
  // Orden de DECLARACIÓN del registry: los módulos de rol `*` salen primero.
  const comoVenia = ['kpis', 'encuestas', 'logros', 'supervisor_ventas', 'brief_dia', 'torre_operativa']
    .map((id) => ({ id }))
  const orden = orderSupervisorHomeModules(comoVenia).map((m) => m.id)

  assert.deepEqual(orden, ['supervisor_ventas', 'brief_dia', 'torre_operativa', 'kpis', 'encuestas', 'logros'])
  assert.equal(orden[0], 'supervisor_ventas', 'Equipo primero: su gente y sus rutas')
  assert.ok(orden.indexOf('brief_dia') < orden.indexOf('torre_operativa'),
    'el brief del día va antes que la torre')
})

test('un módulo que no esté en la lista NO se pierde: se va al final', () => {
  const mods = [{ id: 'nuevo_modulo' }, { id: 'kpis' }, { id: 'supervisor_ventas' }, { id: 'otro' }]
  const orden = orderSupervisorHomeModules(mods).map((m) => m.id)

  assert.equal(orden[0], 'supervisor_ventas')
  assert.deepEqual(orden.slice(-2), ['nuevo_modulo', 'otro'], 'conservan su orden relativo')
  assert.equal(orden.length, 4, 'no se pierde ninguno')
})

test('el orden tolera basura sin reventar', () => {
  assert.deepEqual(orderSupervisorHomeModules(null), [])
  assert.equal(orderSupervisorHomeModules([null, { id: 'kpis' }]).length, 2)
  assert.equal(new Set(SUPERVISOR_HOME_ORDER).size, SUPERVISOR_HOME_ORDER.length, 'sin duplicados')
})

test('el orden NO se impone tocando navPriority ni el home de otros roles', () => {
  const home = readFileSync(new URL('../src/modules/supervisor-ventas/brand/SupervisorVentasHome.jsx', import.meta.url), 'utf8')
  const nav = readFileSync(new URL('../src/lib/navModel.js', import.meta.url), 'utf8')

  assert.ok(home.includes('orderSupervisorHomeModules'), 'ordena la portada del puesto')
  // Medido: ordenar el home global por navPriority cambia el orden a 4 roles,
  // dirección entre ellos. Si esta línea desaparece, eso ya pasó.
  assert.match(nav, /Home conserva el orden histórico del registry/,
    'getHomeModulesForSession sigue sin ordenar globalmente')
})

// ── 3 · Paradas en español, con motivo ───────────────────────────────────────

test('los estados crudos se leen en español', () => {
  assert.equal(stopResultLabel({ result_status: 'delivered_full' }), 'venta realizada')
  assert.equal(stopResultLabel({ result_status: 'delivered_partial' }), 'venta parcial')
  assert.equal(stopResultLabel({ result_status: 'no_sale' }), 'no venta')
  assert.equal(stopResultLabel({ result_status: 'con_venta' }), 'venta realizada')
  assert.equal(stopResultLabel({ result_status: 'no_venta' }), 'no venta')
})

test('sin resultado todavía se dice "pendiente de visita"', () => {
  assert.equal(stopResultLabel({ result_status: null }), 'pendiente de visita')
  assert.equal(stopResultLabel({ result_status: '' }), 'pendiente de visita')
  assert.equal(stopResultLabel({ result_status: 'pending' }), 'pendiente de visita')
  assert.equal(stopResultLabel(null), 'pendiente de visita')
})

test('un estado desconocido se muestra CRUDO, no se disfraza', () => {
  // Si el backend agrega un estado, tiene que verse que falta traducirlo.
  assert.equal(stopResultLabel({ result_status: 'estado_nuevo' }), 'estado_nuevo')
})

test('el motivo de no venta solo aparece cuando aplica', () => {
  assert.equal(noSaleReasonDisplay({ result_status: 'delivered_full', not_visited_reason: 'cerrado' }).show,
    false, 'una venta realizada no tiene motivo de no venta que mostrar')
  const conMotivo = noSaleReasonDisplay({ result_status: 'no_sale', not_visited_reason: 'cerrado' })
  assert.equal(conMotivo.show, true)
  assert.equal(conMotivo.text, 'cerrado')
  assert.equal(conMotivo.missing, false)
})

test('"sin motivo capturado" NO es lo mismo que "no aplica"', () => {
  const sinMotivo = noSaleReasonDisplay({ result_status: 'no_sale', not_visited_reason: null })
  assert.equal(sinMotivo.show, true, 'la columna se muestra: la parada SÍ fue no venta')
  assert.equal(sinMotivo.text, 'sin motivo capturado')
  assert.equal(sinMotivo.missing, true, 'y se marca como faltante de captura en campo')
})

test('el motivo acepta el many2one de Odoo [id, nombre]', () => {
  assert.equal(noSaleReason({ not_visited_reason: [7, 'Cliente cerrado'] }), 'Cliente cerrado')
  assert.equal(noSaleReason({ not_visited_reason: 'cerrado' }), 'cerrado')
  assert.equal(noSaleReason({ not_visited_reason: false }), '')
  assert.equal(noSaleReason({ not_visited_reason: [7] }), '', 'un par sin nombre no se inventa')
})

test('isNoSale cubre las dos familias de valores', () => {
  assert.ok(isNoSale({ result_status: 'no_sale' }))
  assert.ok(isNoSale({ result_status: 'no_venta' }))
  assert.ok(!isNoSale({ result_status: 'delivered_full' }))
  assert.ok(!isNoSale(null))
})

test('el criterio de "visitada" no cambió', () => {
  assert.ok(isVisited({ state: 'done' }))
  assert.ok(isVisited({ has_checkin: true }))
  assert.ok(isVisited({ actual_end_time: '2026-01-15 14:20:00' }))
  assert.ok(!isVisited({ state: 'pending' }))
})

// ── 4 · Perfil: el epoch y el mapeo ──────────────────────────────────────────

const PERFIL = () => readFileSync(new URL('../src/screens/ScreenProfile.jsx', import.meta.url), 'utf8')

test('las fechas del perfil se guardan del epoch', () => {
  const src = PERFIL()
  assert.match(src, /function parseFechaValida/, 'hay un parseo que valida antes de formatear')
  // `new Date(null)` daba 1969: el guard tiene que estar en las DOS funciones.
  const antig = src.slice(src.indexOf('function calcAntiguedad'), src.indexOf('function formatDate'))
  assert.match(antig, /parseFechaValida/, 'la antigüedad valida la fecha')
  assert.match(antig, /if \(!start\) return SIN_DATO/, 'y devuelve "sin dato", no 56 años')
  const fmt = src.slice(src.indexOf('function formatDate'), src.indexOf('function isValidPhone'))
  assert.match(fmt, /parseFechaValida/, 'el formato valida la fecha')
  assert.match(fmt, /if \(!d\) return SIN_DATO/)
})

test('el perfil lee el campo de fecha que el endpoint SÍ pide', () => {
  // `date_start` NO existe en hr.employee (verificado contra producción); el
  // endpoint pide `first_contract_date`. Leer la clave inexistente era el origen
  // del "31 de diciembre de 1969".
  assert.match(PERFIL(), /d\.first_contract_date/, 'se lee el campo real')
})

test('los many2one del perfil se leen como [id, nombre]', () => {
  const src = PERFIL()
  assert.match(src, /function many2one/, 'hay un lector de many2one')
  for (const campo of ['department_id', 'work_location_id', 'company_id', 'job_id']) {
    assert.match(src, new RegExp(`${campo}: many2one\\(`), `${campo} no se lee como par`)
  }
  // El mapeo viejo inventaba claves planas que la respuesta nunca trae.
  for (const inventada of ['d.department |', 'd.work_location |']) {
    assert.ok(!src.includes(inventada), `sigue leyendo una clave inexistente: ${inventada}`)
  }
})

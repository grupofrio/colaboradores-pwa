// Supervisor V2 · "Planear mañana" — modelo PURO + cableado de fuente.
// (a) lógica pura de planearModel (readiness, resumen de recursos, formatos);
// (b) aserciones sobre el código real: ruta en el shell V2, entry desde Rutas,
//     wrapper + mapping del endpoint net-new, tema claro, reuso de guards, y que
//     NO haya writes fuera del contrato ni ORM/sudo en cliente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  routeReadiness, summarizeResources, capacityLabel, personRolesLabel, planStateLabel,
  derivePlanAssignment, resourceOptions, resourceReadiness,
} from '../src/modules/supervisor-ventas/v2/planear/planearModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── (a) Modelo puro ──────────────────────────────────────────────────────────

test('routeReadiness: sin plan ⇒ no publicable, dice qué falta', () => {
  const r = routeReadiness({ state: 'sin_plan', plan_id: 0 }, 0)
  assert.equal(r.publishable, false)
  assert.match(r.reasons[0], /prepar/i)
})

test('routeReadiness: borrador con clientes ⇒ publicable', () => {
  const r = routeReadiness({ plan_id: 10, plan_state: 'draft' }, 3)
  assert.equal(r.publishable, true)
  assert.equal(r.customersCount, 3)
})

test('routeReadiness: recursos incompletos bloquean la publicación', () => {
  const r = routeReadiness(
    { plan_id: 10, plan_state: 'draft' },
    3,
    { coverage_state: 'incomplete', missing_driver: true },
  )
  assert.equal(r.publishable, false)
  assert.match(r.reasons[0], /chofer/i)
})

test('routeReadiness: un bloqueo autoritativo del backend impide publicar', () => {
  const r = routeReadiness(
    { plan_id: 10, plan_state: 'draft' },
    3,
    { coverage_state: 'ready', blockers: ['La carga excede la capacidad de la unidad.'] },
  )
  assert.equal(r.publishable, false)
  assert.match(r.reasons[0], /excede la capacidad/i)
})

test('routeReadiness: borrador SIN clientes ⇒ no publicable (0 no es válido)', () => {
  const r = routeReadiness({ plan_id: 10, plan_state: 'draft' }, 0)
  assert.equal(r.publishable, false)
  assert.match(r.reasons[0], /clientes/i)
})

test('routeReadiness: carga sellada ⇒ no editable ni publicable', () => {
  const r = routeReadiness({ plan_id: 10, plan_state: 'draft', load_sealed: true }, 5)
  assert.equal(r.editable, false)
  assert.equal(r.publishable, false)
})

test('routeReadiness: ya publicada ⇒ published true, no publicable', () => {
  const r = routeReadiness({ plan_id: 10, plan_state: 'published' }, 5)
  assert.equal(r.published, true)
  assert.equal(r.publishable, false)
})

test('summarizeResources: cuenta libres/tomados y capacidad sin dato', () => {
  const s = summarizeResources({
    vehicles_available: true,
    vehicles: [
      { id: 1, available: true, capacity_kg: 1500 },
      { id: 2, available: false, capacity_kg: null },
      { id: 3, available: true, capacity_kg: null },
    ],
    people: [
      { id: 10, available: true, is_driver: true, is_seller: false },
      { id: 11, available: false, is_driver: false, is_seller: true, assigned_plan_ids: [99] },
    ],
  })
  assert.equal(s.unitsTotal, 3)
  assert.equal(s.unitsFree, 2)
  assert.equal(s.unitsTaken, 1)
  assert.equal(s.capacityUnknown, 2)
  assert.equal(s.peopleFree, 1)
  assert.equal(s.peopleTaken, 1)
  assert.equal(s.drivers, 1)
  assert.equal(s.sellers, 1)
})

test('summarizeResources: payload vacío ⇒ no promete recursos', () => {
  const s = summarizeResources({})
  assert.equal(s.vehiclesAvailable, false)
  assert.equal(s.rosterAvailable, false)
  assert.equal(s.unitsTotal, 0)
})

test('capacityLabel: 0/null ⇒ "Sin dato", nunca "0 kg"', () => {
  assert.equal(capacityLabel(0), 'Sin dato')
  assert.equal(capacityLabel(null), 'Sin dato')
  assert.match(capacityLabel(1500), /1[,.]?500 kg/)
})

test('personRolesLabel: chofer y vendedor a la vez', () => {
  assert.equal(personRolesLabel({ is_driver: true, is_seller: true }), 'Chofer · Vendedor')
  assert.equal(personRolesLabel({}), 'Equipo')
})

test('planStateLabel: estados en palabra', () => {
  assert.equal(planStateLabel({ plan_id: 0 }), 'Sin preparar')
  assert.equal(planStateLabel({ plan_id: 5, plan_state: 'published' }), 'Publicada')
})

// ── (a2) Modelo de asignación de recursos ────────────────────────────────────

const RESOURCES = {
  vehicles_available: true,
  vehicles: [
    { id: 1, name: 'Camión A', capacity_kg: 1500, available: false, assigned_plan_ids: [50] },
    { id: 2, name: 'Camión B', capacity_kg: null, available: true, assigned_plan_ids: [] },
    { id: 3, name: 'Camión C', capacity_kg: 2000, available: false, assigned_plan_ids: [99] },
  ],
  people: [
    { id: 10, name: 'Ana', is_driver: true, is_seller: false, available: false, assigned_plan_ids: [50] },
    { id: 11, name: 'Beto', is_driver: false, is_seller: true, available: false, assigned_plan_ids: [50] },
    { id: 12, name: 'Caro', is_driver: true, is_seller: true, available: true, assigned_plan_ids: [] },
  ],
}

test('derivePlanAssignment: saca la unidad/chofer/vendedor de ESTE plan', () => {
  const a = derivePlanAssignment(RESOURCES, 50)
  assert.equal(a.vehicle?.id, 1)
  assert.equal(a.driver?.id, 10)
  assert.equal(a.salesperson?.id, 11)
})

test('derivePlanAssignment: plan sin recursos ⇒ todo null', () => {
  const a = derivePlanAssignment(RESOURCES, 12345)
  assert.equal(a.vehicle, null)
  assert.equal(a.driver, null)
  assert.equal(a.salesperson, null)
})

test('resourceOptions: marca ocupado en otra ruta y conserva el actual', () => {
  const opts = resourceOptions(RESOURCES.vehicles, 50, 1)
  const a = opts.find((o) => o.id === 1)
  const c = opts.find((o) => o.id === 3)
  const b = opts.find((o) => o.id === 2)
  assert.equal(a.isCurrent, true)
  assert.equal(a.busyElsewhere, false) // ocupado por ESTE plan ⇒ no es "en otra ruta"
  assert.equal(c.busyElsewhere, true)  // plan 99 ≠ 50
  assert.equal(b.busyElsewhere, false) // libre
})

test('resourceReadiness: presencia — sin unidad bloquea; sin chofer/vendedor advierte', () => {
  assert.equal(resourceReadiness({ vehicle: null, driver: { id: 1 }, salesperson: { id: 2 } }).coverage_state, 'blocked')
  assert.equal(resourceReadiness({ vehicle: { id: 1 }, driver: null, salesperson: { id: 2 } }).coverage_state, 'incomplete')
  assert.equal(resourceReadiness({ vehicle: { id: 1 }, driver: { id: 2 }, salesperson: { id: 3 } }).coverage_state, 'ready')
})

// ── (b) Cableado de fuente ───────────────────────────────────────────────────

test('wiring: /equipo/rutas/planear monta la portada MisRutasManana bajo el guard V2', () => {
  const s = src('App.jsx')
  const re = /path="\/equipo\/rutas\/planear"[^\n]*SupervisorV2Gate active="rutas"[^\n]*v2Only[^\n]*MisRutasManana/
  assert.ok(re.test(s), 'la ruta debe montar MisRutasManana bajo SupervisorV2Gate rutas/v2Only')
  assert.ok(/MisRutasManana = lazy\(/.test(s), 'MisRutasManana importado lazy')
  // el contenedor sigue usando el flujo existente como detalle
  const cont = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.ok(/RutasMananaMatriz/.test(cont) && /PlanearMananaTab/.test(cont), 'matriz como portada + flujo como detalle')
})

test('wiring: Rutas ofrece el acceso a Planear mañana', () => {
  const s = src('modules/supervisor-ventas/v2/tabs/RutasTab.jsx')
  assert.ok(/rutas-planear-manana/.test(s), 'botón con testid')
  assert.ok(/\/equipo\/rutas\/planear/.test(s), 'navega a la ruta')
})

test('wiring: endpoint net-new tiene wrapper y mapping', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function getAvailableResources/.test(api), 'wrapper getAvailableResources')
  assert.ok(/\/pwa-supv\/available-resources/.test(api), 'usa la ruta pwa-supv')
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/available-resources/.test(lib) && /supervisor\/v2\/available-resources/.test(lib),
    'lib/api.js mapea a la ruta v2 del backend')
})

test('guard: la pestaña es tema CLARO y reusa reglas puras (no reinventa guards)', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/BRAND_TOKENS/.test(tab), 'tema claro de marca')
  assert.ok(/canEditRoutePlanCustomers/.test(tab), 'reusa guard de edición')
  const model = src('modules/supervisor-ventas/v2/planear/planearModel.js')
  assert.ok(/canPublishRoutePlan/.test(model), 'readiness delega en canPublishRoutePlan')
})

test('guard: solo usa writes contractuales; sin ORM/sudo en cliente', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  // Los writes de preparación/publicación y el wrapper dedicado son los únicos permitidos.
  assert.ok(/ensureDailyRoutePlan|previewRoutePlanCustomers|publishRoutePlan/.test(tab), 'usa los writes del contrato')
  assert.ok(!/readModelSorted|createUpdate|get_records|sudo:\s*1/.test(tab), 'sin ORM/sudo directo')
  assert.ok(/assignRoutePlanResources/.test(tab), 'usa el wrapper contractual de asignación')
  assert.ok(!/assignVehicle|assignDriver/.test(tab), 'no inventa writes alternos de asignación')
})

test('guard: publicar exige readiness (no botón siempre activo)', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/readiness\?\.publishable|readiness\.publishable/.test(tab), 'publish gateado por readiness')
})

test('guard: publicar espera una cobertura vigente y ninguna asignación en vuelo', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/async function refreshResourceReadiness/.test(tab), 'refresca la validación autoritativa')
  assert.ok(/await refreshResourceReadiness\(routePlanId\)/.test(tab), 'refresca después de cambiar clientes')
  assert.ok(/publishing \|\| assignBusy \|\| rowBusy \|\| !routePlanId/.test(tab), 'el handler rechaza publicar durante una asignación')
  assert.ok(/disabled=\{!readiness\.publishable \|\| Boolean\(assignBusy \|\| rowBusy\)\}/.test(tab), 'el botón queda deshabilitado durante una asignación')
})

test('guard: publicar espera que termine una modificación de clientes', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/assignBusy \|\| rowBusy \|\| !routePlanId/.test(tab), 'el handler rechaza publicar durante una modificación')
  assert.ok(/Boolean\(assignBusy \|\| rowBusy\)/.test(tab), 'el botón queda deshabilitado durante una modificación')
})

test('guard: serializa la validación de recursos y falla cerrado sin readiness', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  const assignHandler = tab.slice(tab.indexOf('async function handleAssign'), tab.indexOf('// ── Render'))
  assert.ok(/const resourceReq = useRef\(0\)/.test(tab), 'identifica la validación vigente')
  assert.ok(/busy=\{Boolean\(busyField\)\}/.test(tab), 'bloquea todos los selectores durante una validación')
  assert.ok(/if \(assignBusy \|\| !routePlanId \|\| !id\) return/.test(assignHandler), 'rechaza una asignación concurrente')
  assert.match(assignHandler, /if \(!data\.readiness\)[\s\S]*coverage_state: 'blocked'/, 'sin readiness autoritativo falla cerrado')
  assert.match(assignHandler, /catch \(e\) \{[\s\S]*coverage_state: 'blocked'/, 'un error de red al asignar falla cerrado')
})

// ── (c) Cableado de la asignación (write real) ───────────────────────────────

test('wiring: write assign-resources tiene wrapper y mapping', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function assignRoutePlanResources/.test(api), 'wrapper assignRoutePlanResources')
  assert.ok(/\/pwa-supv\/route-plan-assign-resources/.test(api), 'usa la ruta pwa-supv del write')
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/route-plan-assign-resources/.test(lib) && /route_plan\/assign-resources/.test(lib),
    'lib/api.js mapea al endpoint v2 del backend')
})

test('wiring: la pestaña usa el picker accionable y el handler de asignación', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/assignRoutePlanResources/.test(tab), 'la pestaña llama al write de asignación')
  assert.ok(/ResourcePicker/.test(tab), 'monta el picker accionable')
  assert.ok(/planear-asignar-unidad/.test(tab) && /planear-asignar-chofer/.test(tab) && /planear-asignar-vendedor/.test(tab),
    'expone los tres selectores')
})

test('guard: el picker deshabilita recursos ocupados en otra ruta (no doblar)', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/disabled=\{o\.busyElsewhere && !o\.isCurrent\}/.test(tab), 'opción ocupada en otra ruta va deshabilitada')
})

test('guard: solo se envían los recursos presentes (ausente = no tocar)', () => {
  const api = src('modules/supervisor-ventas/api.js')
  // El wrapper NO manda un campo si viene null/undefined ⇒ el backend no lo toca.
  assert.ok(/resources\.vehicle_id != null/.test(api), 'vehicle_id condicional')
  assert.ok(/resources\.driver_employee_id != null/.test(api), 'driver condicional')
  assert.ok(/resources\.salesperson_employee_id != null/.test(api), 'salesperson condicional')
})

// ── (d) Segmentos operativos: escopo por sucursal + selector ─────────────────

test('wiring: getPlanningSegments + mapping /pwa-supv/segments → v2/segments', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function getPlanningSegments/.test(api))
  assert.ok(/\/pwa-supv\/segments/.test(api))
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/segments/.test(lib) && /supervisor\/v2\/segments/.test(lib), 'lib mapea al endpoint v2')
})

test('wiring: la pestaña carga segmentos y monta el selector (con estado vacío honesto)', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/getPlanningSegments/.test(tab), 'la pestaña llama al endpoint de segmentos')
  assert.ok(/planear-segmento/.test(tab), 'monta el selector')
  assert.ok(/planear-segmentos-vacio/.test(tab), 'estado honesto: sin segmentos → aviso')
})

test('wiring: la selección de segmento viaja en el criterio del plan', () => {
  const rp = src('modules/supervisor-ventas/routePlanning.js')
  assert.ok(/segment_id: segmentId \? Number\(segmentId\)/.test(rp), 'criteria payload envía segment_id')
  assert.ok(/segment_id: segmentId \? toNumber\(segmentId\)/.test(rp), 'preview payload envía segment_id')
})

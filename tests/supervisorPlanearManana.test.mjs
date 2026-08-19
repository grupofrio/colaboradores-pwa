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
  derivePlanAssignment, resourceOptions, resourceReadiness, interpretOptimizeResponse,
  interpretReviewResponse,
  interpretDemandSnapshotResponse,
  interpretPublishResponse,
  interpretPlanReadinessResponse,
  interpretCapacityReloadPreview,
  canApplyCapacityReloadPreview,
  shouldShowCapacityReloadPanel,
  shouldHaltPrepareForResources,
  prepareResourceHaltMessage,
  resourcesChecklistReady,
  preparationAfterCapacityReload,
  canPublishPreparedRoute,
  echoedUnionKeys, shouldShowCombinedSources, runPrepareSequence, runPublishSequence,
  reviewedPublishRevision, isReopenNotFound, shouldAutoOpenEnsure, preparationAfterReopen,
} from '../src/modules/supervisor-ventas/v2/planear/planearModel.js'
import { canEnsureRoutePlan } from '../src/modules/supervisor-ventas/v2/planear/routesWeekModel.js'

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

test('F1: la readiness NO se lee con un POST vacío a assign-resources (bug de "asignar varias veces")', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  // El POST vacío a assign-resources devolvía VALIDATION_ERROR ("Nada que
  // asignar") y dejaba el semáforo en `blocked` con los tres selectores llenos.
  // F1 lo elimina: sin recursos NO se llama al write para "leer".
  assert.ok(!/refreshResourceReadiness/.test(tab), 'no existe el refresh por POST vacío')
  assert.ok(!/assignRoutePlanResources\(\s*(?:planId|routePlanId)\s*\)/.test(tab), 'no hay assign-resources con payload vacío')
  // Codex P1 (3ª): invalidar deja 'blocked' (verificando), NO null — así no se cae a
  // la derivación local mientras B1 está en vuelo (evita habilitar publish por local).
  assert.ok(/function invalidateResourceReadiness\(\)\s*\{[\s\S]*?coverage_state: 'blocked'[\s\S]*?\n  \}/.test(tab), 'invalidar deja la readiness en blocked (verificando), no null')
  assert.ok(/const coverage = assignReadiness \|\| resourceReadiness\(assignment\)/.test(tab), 'coverage cae a resourceReadiness(assignment) local solo si assignReadiness es null')
  // El guard de publicación bloquea también durante snapshot/preparar/previsualizar.
  assert.ok(/publishing \|\| snapshotBusy \|\| reloadBusy \|\| assignBusy \|\| rowBusy \|\| preparing \|\| previewing \|\| !routePlanId/.test(tab), 'el handler rechaza publicar durante snapshot/preparar/previsualizar')
  assert.ok(/disabled=\{!readiness\.publishable \|\| Boolean\(snapshotBusy \|\| assignBusy \|\| rowBusy \|\| preparing \|\| previewing\)\}/.test(tab), 'el botón queda deshabilitado durante snapshot/preparar/previsualizar')
})

test('F1↔B1 (Codex P1): tras una mutación se refresca la readiness AUTORITATIVA del servidor', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function getRoutePlanReadiness/.test(api), 'wrapper getRoutePlanReadiness')
  assert.ok(/\/pwa-supv\/route-plan-readiness/.test(api), 'ruta pwa-supv del readiness')
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/route-plan-readiness/.test(lib) && /route_plan\/readiness/.test(lib), 'shim readiness → controller B1')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/async function refreshReadinessFromServer/.test(tab), 'existe el refresh autoritativo')
  assert.ok(/getRoutePlanReadiness\(planId\)/.test(tab), 'llama al GET readiness del servidor')
  // Se llama tras add/remove/preview/prepare (no queda solo la derivación local).
  assert.ok((tab.match(/refreshReadinessFromServer\(/g) || []).length >= 4, 'se refresca tras cada mutación')
  // Codex P1 (2ª): un error NO autoritativo BLOQUEA (no habilita por derivación local).
  const fn = tab.slice(tab.indexOf('async function refreshReadinessFromServer'), tab.indexOf('async function handlePrepare'))
  assert.ok(/coverage_state: 'blocked'/.test(fn), 'ante error no autoritativo, estado blocked (publish deshabilitado)')
  // La derivación local SOLO se activa por la señal explícita de capacidad ausente (404).
  assert.ok(/status === 404/.test(fn), 'la compatibilidad local requiere HTTP 404 (endpoint ausente)')
  assert.ok(/if \(status === 404\)[\s\S]*?setAssignReadiness\(null\)/.test(fn), 'solo el 404 degrada a local; el resto bloquea')
})

test('guard: publicar espera que termine una modificación de clientes', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/assignBusy \|\| rowBusy \|\| preparing \|\| previewing \|\| !routePlanId/.test(tab), 'el handler rechaza publicar durante una modificación')
  assert.ok(/Boolean\(assignBusy \|\| rowBusy \|\| preparing \|\| previewing\)/.test(tab), 'el botón queda deshabilitado durante una modificación')
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

// ── Flujo por SEGMENTO (plan tipo "Mercado") — Codex + dirección ─────────────

test('segmento-solo: el shim reenvía segment_id a ensure y a preview', () => {
  const lib = src('lib/api.js')
  // Dos shims (ensure + preview) deben reenviar segment_id al backend.
  const hits = lib.split(/segment_id: Number\(body\?\.segment_id/).length - 1
  assert.ok(hits >= 2, `segment_id reenviado en ambos shims (encontrados: ${hits})`)
})

test('segmento-solo: ya NO se bloquea la propuesta con el aviso viejo', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  // El bloqueo "agrega los clientes a mano por ahora" se retiró.
  assert.doesNotMatch(tab, /agrega los clientes a mano por ahora/, 'el aviso bloqueante viejo se eliminó')
  // handlePreview deja pasar segment-only sin polígono.
  assert.match(tab, /if \(segmentOnlyPlan\) \{/, 'segment-only tiene su rama propia en preview')
})

test('segmento-solo: el botón de sugerir NO exige polígono (sí segmento)', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(tab, /disabled=\{segmentOnlyPlan \? !segmentId : !polygonId\}/,
    'SO se habilita con segmento; SP/P siguen exigiendo polígono')
  assert.match(tab, /Sugerir clientes del segmento/, 'la etiqueta contextualiza el segmento')
})

test('segmento-solo: cabecera y criterios contextualizados; sin selector de zona', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(tab, /planear-plan-contexto/, 'la cabecera muestra el chip del plan Segmento')
  assert.match(tab, /Plan por segmento \(lista curada\)/, 'la tarjeta de criterios habla del segmento')
  // Los selectores de zona/segmento/demanda se ocultan para SO.
  assert.match(tab, /segmentOnlyPlan \? null : !showZoneSelectors/, 'zona oculta para SO')
  assert.match(tab, /!segmentOnlyPlan && \(/, 'selector de segmento/demanda oculto para SO')
})

test('SP/P sin regresión: el flujo por zona sigue exigiendo polígono', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  // La rama else de handlePreview mantiene "Elige una zona".
  assert.match(tab, /Elige una zona para generar la propuesta/, 'zona sigue siendo requisito para SP/P')
  assert.match(tab, /Sugerir clientes de la zona/, 'la etiqueta de zona se mantiene para SP/P')
})

test('segmento-solo: segmentId se inicializa SÍNCRONO desde initialSegmentId (Codex P1 carrera)', () => {
  // La autoapertura (handlePrepare al cargar rutas) corre antes del fetch de
  // segmentos; si segmentId arrancara vacío, el primer ensure de un plan SO iría
  // sin segment_id → polygon_required, y autoOpenedRef bloquea el reintento.
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(tab, /useState\(initialSegmentId \? String\(initialSegmentId\) : ''\)/,
    'segmentId nace del initialSegmentId, no vacío')
})

// ── (F2) Zona honesta + selector de ruta (consume B2) ────────────────────────

test('F2.2: sin default silencioso de polígono; zona heredada que no resuelve es honesta', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(!/normPolys\[0\]/.test(tab), 'eliminado el fallback normPolys[0] (armar con otra zona en silencio)')
  assert.ok(/const zoneUnresolved = /.test(tab), 'deriva zoneUnresolved')
  assert.ok(/showZoneSelectors = !zoneInherited \|\| showZoneEditor \|\| zoneUnresolved/.test(tab), 'la zona sin resolver revela el selector')
  assert.ok(/planear-zona-sin-resolver/.test(tab), 'muestra el estado honesto "no pude resolver la zona"')
})

test('F2.1: entrar desde la matriz sin ruta ofrece elegir ruta (no lista sin contexto)', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/planear-elegir-ruta/.test(tab), 'banner de "elige la ruta" en la vista lista')
  assert.ok(/zoneInherited && !initialRouteId/.test(tab), 'solo cuando vino de la matriz sin route.id')
})

test('F2 P1 (Codex): multiplicidad de rutas mañana NO autoabre una arbitraria', async () => {
  const model = await import('../src/modules/supervisor-ventas/v2/planear/routesWeekModel.js')
  // Con requires_route_selection, rowRouteId es 0 ⇒ el detalle NO autoabre; pide elegir.
  assert.equal(model.rowRouteId({ tomorrow: { requires_route_selection: true }, route: { id: 7 } }), 0)
  assert.equal(model.rowRequiresRouteSelection({ tomorrow: { requires_route_selection: true } }), true)
  // Seguro contra backend PRE-B2: plan_count>1 (sin el flag) también pide selección.
  assert.equal(model.rowRequiresRouteSelection({ tomorrow: { plan_count: 2 } }), true)
  assert.equal(model.rowRouteId({ tomorrow: { plan_count: 2 }, route: { id: 7 } }), 0)
  // Un solo plan: se conserva la ruta accionable.
  assert.equal(model.rowRouteId({ tomorrow: { requires_route_selection: false, plan_count: 1 }, route: { id: 7 } }), 7)
  // La matriz muestra el estado explícito de selección.
  const matriz = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.ok(/rw-elegir-ruta/.test(matriz) && /Elegir ruta/.test(matriz), 'la celda ofrece "Elegir ruta" en multiplicidad')
})

// ── (F5) Optimizar y publicar (contrato B5) ──────────────────────────────────

test('F5: optimize+review+publish — wrappers y shims', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function optimizeRoutePlan/.test(api), 'wrapper optimizeRoutePlan')
  assert.ok(/\/pwa-supv\/route-plan-optimize/.test(api), 'usa la ruta pwa-supv del optimize')
  assert.ok(/export function reviewRoutePlan/.test(api) && /\/pwa-supv\/route-plan-review/.test(api), 'wrapper reviewRoutePlan')
  assert.ok(/export function generateRoutePlanDemandSnapshot/.test(api) && /\/pwa-supv\/route-plan-generate-snapshot/.test(api), 'wrapper snapshot de demanda')
  assert.ok(/export function reopenRoutePlanForRevision/.test(api) && /\/pwa-supv\/route-plan-reopen-for-revision/.test(api), 'wrapper reopen canónico')
  assert.ok(/export function publishRoutePlan\(routePlanId, planRevision, confirmWarnings/.test(api), 'publishRoutePlan acepta planRevision + confirmWarnings')
  assert.ok(/plan_revision: String\(planRevision\)/.test(api), 'publish envía plan_revision cuando la hay')
  assert.ok(/confirm_readiness_warnings: true/.test(api), 'publish envía confirm_readiness_warnings')
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/route-plan-review/.test(lib) && /route_plan\/review/.test(lib), 'shim review → controller dedicado')
  assert.ok(/\/pwa-supv\/route-plan-generate-snapshot/.test(lib) && /route_plan\/generate-snapshot/.test(lib), 'shim snapshot → controller dedicado')
  assert.ok(/\/pwa-supv\/route-plan-reopen-for-revision/.test(lib) && /route_plan\/reopen_for_revision/.test(lib), 'shim reopen → controller dedicado')
  assert.ok(/body\?\.plan_revision \? \{ plan_revision:/.test(lib), 'el shim de publish reenvía plan_revision')
  assert.ok(/body\?\.confirm_readiness_warnings \? \{ confirm_readiness_warnings/.test(lib), 'el shim de publish reenvía confirm_readiness_warnings')
})

test('F5: handlePublish publica vía runPublishSequence SIN reoptimizar', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/Publicar ruta optimizada/.test(tab), 'el botón dice "Publicar ruta optimizada"')
  assert.ok(!/Optimizar y publicar/.test(tab), 'ya no dice Optimizar y publicar')
  const handler = tab.slice(tab.indexOf('async function handlePublish'), tab.indexOf('function toggleDemand'))
  assert.match(handler, /runPublishSequence\(/, 'publicar usa el orquestador real')
  assert.ok(!/runOptimize\(routePlanId\)/.test(handler), 'publicar NO llama al optimizer')
  assert.ok(!/runReview\(routePlanId\)/.test(handler), 'publicar NO vuelve a revisar')
  assert.ok(/revision_mismatch/.test(handler), 'maneja revision_mismatch')
  assert.ok(/Vuelve a Preparar ruta/.test(handler), 'mismatch obliga a preparar de nuevo')
  assert.ok(!/ready = await prepare\(\)/.test(handler), 'no reoptimiza en silencio')
  assert.ok(/readiness_blocked/.test(handler) && /readiness_warnings/.test(handler), 'gatea los códigos de readiness')
  assert.ok(/demand_snapshot_required/.test(handler), 'surfacea la falta de snapshot')
  assert.ok(/setSnapshotResult\(\{ required: true \}\)/.test(handler), 'ofrece generar snapshot cuando el gate lo exige')
  assert.ok(/confirmWarnings/.test(handler), 'los avisos exigen confirmación explícita')
  assert.ok(/planear-review-blocked/.test(tab), 'muestra los bloqueos')
  assert.ok(/planear-review-warning/.test(tab) && /planear-publicar-confirmar/.test(tab), 'muestra avisos + confirmar')
  assert.ok(/planear-optimizacion/.test(tab), 'muestra paradas · km · min tras optimizar')
  assert.ok(/preparing \|\| previewing/.test(handler), 'bloquea publish con readiness en vuelo')
})

// Codex P1 (F5): la degradación amplia dejaba publicar sin revisión. SOLO un
// éxito con plan_revision habilita publicar; todo lo demás bloquea.
test('F5: contrato optimize↔publish — SOLO éxito con revisión habilita publicar', () => {
  // Éxito con revisión ⇒ publica esa secuencia.
  const ok = interpretOptimizeResponse({ ok: true, status: 'ok', data: { plan_revision: 'abc123', stops_count: 12, distance_km: 45.2, duration_min: 130 } })
  assert.equal(ok.blocked, false)
  assert.equal(ok.revision, 'abc123')
  assert.equal(ok.metrics.stops, 12)

  // Éxito MALFORMADO sin revisión ⇒ bloquea (no se ancla la secuencia).
  const noRev = interpretOptimizeResponse({ ok: true, status: 'ok', data: { stops_count: 9 } })
  assert.equal(noRev.blocked, true)
  assert.equal(noRev.revision, null)
  assert.equal(noRev.metrics, null)

  // Cualquier error de negocio ⇒ bloquea (NO degrada a publicar directo).
  for (const code of ['FORBIDDEN', 'LOCKED', 'VALIDATION_ERROR', 'NOT_FOUND', 'CONFLICT', 'CAPABILITY_UNAVAILABLE', 'OPTIMIZER_UNAVAILABLE']) {
    const err = interpretOptimizeResponse({ ok: false, status: 'error', code, message: `falló: ${code}` })
    assert.equal(err.blocked, true, `${code} debe bloquear`)
    assert.equal(err.revision, null, `${code} sin revisión`)
    assert.equal(err.metrics, null, `${code} sin métricas`)
  }
})

test('F5: la optimización muestra carga esperada, utilización y clientes no asignados', () => {
  // La función pura extrae los campos net-new del DTO de B5; null ≠ 0.
  const r = interpretOptimizeResponse({ ok: true, status: 'ok', data: {
    plan_revision: 'r1', demand_kg: 1240, capacity_kg: 1500, utilization_pct: 82.7, unassigned_count: 2,
  } })
  assert.equal(r.metrics.demandKg, 1240)
  assert.equal(r.metrics.capacityKg, 1500)
  assert.equal(r.metrics.utilizationPct, 82.7)
  assert.equal(r.metrics.unassigned, 2)
  // Sin datos de carga: null ≠ 0 (no se inventa un 0 de kilos), unassigned ⇒ 0.
  const bare = interpretOptimizeResponse({ ok: true, status: 'ok', data: { plan_revision: 'r2' } })
  assert.equal(bare.metrics.demandKg, null)
  assert.equal(bare.metrics.capacityKg, null)
  assert.equal(bare.metrics.utilizationPct, null)
  assert.equal(bare.metrics.unassigned, 0)
  // La tarjeta los presenta condicionalmente.
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/planear-optimizacion-carga/.test(tab), 'muestra la línea de carga/capacidad')
  assert.ok(/optimizeResult\.demandKg != null/.test(tab), 'la carga solo se muestra si el backend la mandó')
  assert.ok(/planear-optimizacion-noasignadas/.test(tab), 'advierte clientes que no cupieron')
  assert.ok(/optimizeResult\.unassigned > 0/.test(tab), 'la advertencia solo aparece si hay no asignados')
})

// ── F5+ · optimize→review→publish (absorbe el review de Sebas) ────────────────
test('F5+: interpretReviewResponse mapea el veredicto ready/warning/blocked', () => {
  const ready = interpretReviewResponse({ ok: true, status: 'ok', data: { readiness_state: 'ready', plan_revision: 'r9' } })
  assert.equal(ready.failed, false)
  assert.equal(ready.state, 'ready')
  assert.equal(ready.revision, 'r9')

  const warn = interpretReviewResponse({ ok: true, status: 'ok', data: { readiness_state: 'warning', warnings: ['Sin chofer.'], plan_revision: 'r9' } })
  assert.equal(warn.state, 'warning')
  assert.deepEqual(warn.warnings, ['Sin chofer.'])

  const blk = interpretReviewResponse({ ok: true, status: 'ok', data: { readiness_state: 'blocked', blockers: ['2 stops sin coordenadas.'] } })
  assert.equal(blk.state, 'blocked')
  assert.deepEqual(blk.blockers, ['2 stops sin coordenadas.'])

  // Endpoint caído (backend viejo) ⇒ failed (no confundir con readiness blocked);
  // el flujo deja que el gate server-side del publish decida.
  const down = interpretReviewResponse({ ok: false, status: 'error', code: 'NOT_FOUND', message: 'x' })
  assert.equal(down.failed, true)
})

test('REVIEW-MALFORMADO: HTTP 200 sin readiness_state no es publicable', () => {
  for (const data of [{}, { plan_revision: 'rev-9' }]) {
    const review = interpretReviewResponse({ ok: true, status: 'ok', data })
    assert.equal(review.failed, false)
    assert.equal(review.state, '')
    assert.equal(canPublishPreparedRoute({
      customersCount: 4,
      snapshotOk: true,
      optimizeBlocked: false,
      planRevision: review.revision || 'rev-9',
      unassigned: 0,
      missingGeo: 0,
      reviewFailed: review.failed,
      reviewState: review.state,
    }).ok, false)
  }
})

test('F5 hotfix: review fallido o vacío no llama publish', async () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  const prepare = tab.slice(tab.indexOf('async function handlePrepareRoute'), tab.indexOf('async function handlePublish'))
  assert.match(prepare, /runPrepareSequence\(/)
  assert.match(prepare, /if \(!prepared\.complete\)/, 'un fallo de review corta Preparar ruta')
  const handler = tab.slice(tab.indexOf('async function handlePublish'), tab.indexOf('function toggleDemand'))
  assert.match(handler, /runPublishSequence\(/)
  assert.doesNotMatch(handler, /runOptimize\(routePlanId\)/)
  let publishCalls = 0
  const failed = await runPublishSequence({
    customersCount: 3,
    snapshotOk: true,
    optimizeResult: { revision: 'opt-1' },
    reviewResult: { failed: true, state: '', revision: null },
    publish: async () => { publishCalls += 1 },
  })
  assert.equal(failed.publishCalled, false)
  assert.equal(publishCalls, 0)
})

test('F5+: interpretPublishResponse — códigos accionables NO son éxito', () => {
  const ok = interpretPublishResponse({ ok: true, status: 'ok', data: { route_plan_id: 5, state: 'published' } })
  assert.equal(ok.ok, true)
  for (const [code, key] of [['readiness_blocked', 'blockers'], ['readiness_warnings', 'warnings']]) {
    const r = interpretPublishResponse({ ok: false, status: 'error', code, data: { [key]: ['x'] } })
    assert.equal(r.ok, false)
    assert.equal(r.code, code)
    assert.deepEqual(r[key], ['x'])
  }
  const snap = interpretPublishResponse({ ok: false, status: 'error', code: 'demand_snapshot_required' })
  assert.equal(snap.ok, false)
  assert.equal(snap.code, 'demand_snapshot_required')
  const mism = interpretPublishResponse({ ok: false, status: 'error', code: 'revision_mismatch' })
  assert.equal(mism.code, 'revision_mismatch')
})

test('B7: snapshot solo es éxito con un id confirmado y fuerza reoptimización', () => {
  const ok = interpretDemandSnapshotResponse({ ok: true, status: 'ok', data: { demand_snapshot_id: 18, line_count: 7 } })
  assert.equal(ok.ok, true)
  assert.equal(ok.snapshotId, 18)
  assert.equal(ok.lineCount, 7)
  const malformed = interpretDemandSnapshotResponse({ ok: true, status: 'ok', data: {} })
  assert.equal(malformed.ok, false)
  assert.equal(malformed.code, 'snapshot_response_invalid')
  const blocked = interpretDemandSnapshotResponse({ ok: false, status: 'error', code: 'FORBIDDEN', message: 'x' })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.code, 'forbidden')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/planear-generar-snapshot/.test(tab), 'el flujo ofrece la acción explícita')
  assert.ok(/setOptimizeResult\(null\)/.test(tab) && /setReviewResult\(null\)/.test(tab), 'un snapshot no reutiliza una secuencia previa')
})

test('B8: la recarga se resuelve server-side y no crea inventario desde la PWA', () => {
  const api = src('modules/supervisor-ventas/api.js')
  const lib = src('lib/api.js')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/previewRoutePlanCapacityReload/.test(api) && /applyRoutePlanCapacityReload/.test(api), 'wrappers B8')
  assert.ok(/route-plan-capacity-reload-preview/.test(lib) && /route-plan-apply-capacity-reload/.test(lib), 'shims B8')
  assert.ok(/Esta ruta necesita una recarga/.test(tab) && /Ruta con recarga en CEDIS/.test(tab), 'superficie operativa de recarga')
  assert.ok(/Ver propuesta de recarga/.test(tab) && /Aplicar recarga/.test(tab), 'preview y apply son pasos separados')
  assert.ok(/handleCapacityReloadPreview/.test(tab) && /handleCapacityReloadApply/.test(tab), 'handlers separados')
  assert.ok(/requires_reoptimization|Optimiza y revisa antes de publicar/.test(tab), 'exige reoptimizar tras aplicar')
  assert.ok(!/create.*picking|reserve.*inventory/i.test(api), 'cliente no crea stock ni pickings')
})

test('capacity-reload A/B: gate por overcapacity autoritativa propagada', () => {
  const hidden = routeReadiness(
    { plan_id: 10, plan_state: 'draft' },
    5,
    { coverage_state: 'ready', overcapacity: false, demand_kg: 2000, capacity_kg: 3000 },
  )
  assert.equal(hidden.overcapacity, false)
  assert.equal(shouldShowCapacityReloadPanel({
    published: hidden.published, overcapacity: hidden.overcapacity, reloadApplied: false,
  }), false)

  const shown = routeReadiness(
    { plan_id: 10, plan_state: 'draft' },
    5,
    {
      coverage_state: 'blocked',
      overcapacity: true,
      demand_kg: 3517.8,
      capacity_kg: 3000,
      blockers: ['Sobrecapacidad: demanda 3517.8 kg > capacidad 3000.0 kg.'],
    },
  )
  assert.equal(shown.overcapacity, true)
  assert.equal(shown.demandKg, 3517.8)
  assert.equal(shown.capacityKg, 3000)
  assert.equal(shouldShowCapacityReloadPanel({
    published: shown.published, overcapacity: shown.overcapacity, reloadApplied: false,
  }), true)
  assert.equal(shouldShowCapacityReloadPanel({
    published: shown.published, overcapacity: shown.overcapacity, reloadApplied: true,
  }), false)
})

test('capacity-reload C/D: preview PASS muestra viajes y no aplica; trip>cap bloquea', () => {
  const pass = interpretCapacityReloadPreview({
    ok: true,
    data: {
      reload: {
        route_plan_id: 6927,
        resolution: 'reload',
        depot_id: 89,
        reload_after_stop_id: 205455,
        first_trip_kg: 2977.9,
        second_trip_kg: 539.9,
        reload_kg: 539.9,
        trip_count: 2,
      },
    },
  }, 3000)
  assert.equal(pass.ok, true)
  assert.equal(pass.reload.trip_count, 2)
  assert.equal(pass.reload.first_trip_kg, 2977.9)
  assert.equal(pass.reload.second_trip_kg, 539.9)
  assert.equal(pass.withinCapacity, true)
  assert.equal(canApplyCapacityReloadPreview(pass), true)

  const over = interpretCapacityReloadPreview({
    ok: true,
    data: {
      reload: {
        first_trip_kg: 3200,
        second_trip_kg: 400,
        reload_kg: 400,
        trip_count: 2,
        reload_after_stop_id: 1,
        depot_id: 89,
      },
    },
  }, 3000)
  assert.equal(over.ok, true)
  assert.equal(over.withinCapacity, false)
  assert.equal(canApplyCapacityReloadPreview(over), false)

  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(tab, /planear-ver-propuesta-recarga/)
  assert.match(tab, /planear-aplicar-recarga/)
  assert.match(tab, /planear-recarga-apply-bloqueada/)
  // Preview handler must not call apply.
  const previewFn = tab.slice(tab.indexOf('async function handleCapacityReloadPreview'), tab.indexOf('async function handleCapacityReloadApply'))
  assert.ok(/previewRoutePlanCapacityReload/.test(previewFn))
  assert.ok(!/applyRoutePlanCapacityReload/.test(previewFn))
})

test('capacity-reload E/F: apply confirmado una vez e invalida preparación', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  const applyFn = tab.slice(tab.indexOf('async function handleCapacityReloadApply'), tab.indexOf('async function handleGenerateDemandSnapshot'))
  assert.ok(/reloadConfirm/.test(applyFn), 'exige confirmación explícita')
  assert.ok(/applyRoutePlanCapacityReload/.test(applyFn))
  assert.equal((applyFn.match(/applyRoutePlanCapacityReload/g) || []).length, 1)
  assert.ok(!/previewRoutePlanCapacityReload/.test(applyFn), 'apply no re-hace preview')
  const cleared = preparationAfterCapacityReload()
  assert.equal(cleared.snapshotResult, null)
  assert.equal(cleared.optimizeResult, null)
  assert.equal(cleared.reviewResult, null)
  assert.ok(/preparationAfterCapacityReload/.test(tab))
  assert.ok(/setSnapshotResult\(cleared\.snapshotResult\)/.test(tab))
})

test('capacity-reload G/H: unassigned bloquea publish; reload+review PASS habilita', () => {
  const before = canPublishPreparedRoute({
    customersCount: 64,
    snapshotOk: true,
    optimizeBlocked: false,
    planRevision: 'rev-old',
    unassigned: 2,
    missingGeo: 0,
    reviewFailed: false,
    reviewState: 'ready',
  })
  assert.equal(before.ok, false)

  const afterReload = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    {
      coverage_state: 'blocked',
      overcapacity: true,
      demand_kg: 3517.8,
      capacity_kg: 3000,
      blockers: ['Sobrecapacidad: demanda 3517.8 kg > capacidad 3000.0 kg.'],
    },
    { reloadApplied: true },
  )
  assert.equal(afterReload.publishable, true, 'recarga aplicada no deja el gate UI atrapado en sobrecapacidad')
  assert.equal(afterReload.overcapacity, true, 'sigue mostrando la señal autoritativa')

  const publishable = canPublishPreparedRoute({
    customersCount: 64,
    snapshotOk: true,
    optimizeBlocked: false,
    planRevision: 'rev-new',
    unassigned: 0,
    missingGeo: 0,
    reviewFailed: false,
    reviewState: 'ready',
  })
  assert.equal(publishable.ok, true)
  assert.equal(Boolean(afterReload.publishable && publishable.ok), true)
})

test('capacity-reload I: ruta normal ≤ capacidad sin cambios de flujo', () => {
  const r = routeReadiness(
    { plan_id: 11, plan_state: 'draft' },
    8,
    { coverage_state: 'ready', overcapacity: false, demand_kg: 1800, capacity_kg: 3000, blockers: [] },
  )
  assert.equal(r.overcapacity, false)
  assert.equal(r.publishable, true)
  assert.equal(shouldShowCapacityReloadPanel({
    published: false, overcapacity: r.overcapacity, reloadApplied: false,
  }), false)
  const ready = canPublishPreparedRoute({
    customersCount: 8,
    snapshotOk: true,
    optimizeBlocked: false,
    planRevision: 'rev-1',
    unassigned: 0,
    missingGeo: 0,
    reviewFailed: false,
    reviewState: 'ready',
  })
  assert.equal(ready.ok, true)
})

const postReloadCoverage = {
  coverage_state: 'blocked',
  overcapacity: true,
  demand_kg: 3517.8,
  capacity_kg: 3000,
  missing_vehicle: false,
  missing_driver: false,
  missing_salesperson: false,
  blockers: ['Sobrecapacidad: demanda 3517.8 kg > capacidad 3000.0 kg.'],
}

test('post-reload resources 1: reloadApplied + solo sobrecapacidad ⇒ Recursos ✓ y Preparar no se detiene', async () => {
  const r = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    postReloadCoverage,
    { reloadApplied: true },
  )
  assert.equal(r.resourceBlocked, false)
  assert.equal(resourcesChecklistReady(r), true)
  assert.equal(shouldHaltPrepareForResources(r), false)
  assert.equal(prepareResourceHaltMessage(r), null)
  let snapshotCalls = 0
  const prepared = await runPrepareSequence({
    generateSnapshot: async () => { snapshotCalls += 1; return { ok: true, snapshotId: 1, lineCount: 64 } },
    runOptimize: async () => ({ revision: 'opt-1', blocked: false, metrics: { revision: 'opt-1', unassigned: 0 } }),
    runReview: async () => ({ revision: 'rev-1', state: 'ready', failed: false, missingGeo: 0 }),
  })
  assert.equal(shouldHaltPrepareForResources(r), false, 'el guard no corta antes de snapshot')
  assert.equal(snapshotCalls, 1)
  assert.equal(prepared.complete, true)
})

test('post-reload resources 2: mismo DTO sin reloadApplied ⇒ blocked', () => {
  const r = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    postReloadCoverage,
    { reloadApplied: false },
  )
  assert.equal(r.resourceBlocked, true)
  assert.equal(resourcesChecklistReady(r), false)
  assert.equal(shouldHaltPrepareForResources(r), true)
})

test('post-reload resources 3: reloadApplied + missing_driver ⇒ blocked', () => {
  const r = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    { ...postReloadCoverage, missing_driver: true },
    { reloadApplied: true },
  )
  assert.equal(r.resourceBlocked, true)
  assert.equal(shouldHaltPrepareForResources(r), true)
})

test('post-reload resources 4: reloadApplied + coverage_state=incomplete ⇒ blocked', () => {
  const r = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    { ...postReloadCoverage, coverage_state: 'incomplete', overcapacity: false, blockers: [] },
    { reloadApplied: true },
  )
  assert.equal(r.resourceBlocked, true)
  assert.equal(shouldHaltPrepareForResources(r), true)
})

test('post-reload resources 5: reloadApplied + blocker extra de chofer ⇒ blocked', () => {
  const r = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    {
      ...postReloadCoverage,
      blockers: [
        'Sobrecapacidad: demanda 3517.8 kg > capacidad 3000.0 kg.',
        'Falta chofer asignado.',
      ],
    },
    { reloadApplied: true },
  )
  assert.equal(r.resourceBlocked, true)
  assert.equal(shouldHaltPrepareForResources(r), true)
})

test('post-reload resources 6: ruta normal completa sin recarga ⇒ sin regresión', () => {
  const r = routeReadiness(
    { plan_id: 11, plan_state: 'draft' },
    8,
    { coverage_state: 'ready', overcapacity: false, demand_kg: 1800, capacity_kg: 3000, blockers: [] },
  )
  assert.equal(r.resourceBlocked, false)
  assert.equal(resourcesChecklistReady(r), true)
  assert.equal(shouldHaltPrepareForResources(r), false)
})

test('post-reload resources 7: Preparar usa readiness.resourceBlocked y llega a snapshot', async () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  const prepareFn = tab.slice(tab.indexOf('async function handlePrepareRoute'), tab.indexOf('async function handlePublish') >= 0 ? tab.indexOf('async function handlePublish') : tab.length)
  assert.match(prepareFn, /shouldHaltPrepareForResources\(readiness\)/)
  assert.doesNotMatch(prepareFn, /coverage\?\.missing_vehicle/)
  assert.doesNotMatch(prepareFn, /coverage_state === 'blocked'/)
  assert.doesNotMatch(prepareFn, /Asigna unidad, chofer y vendedor/)
  assert.match(prepareFn, /runPrepareSequence/)
  assert.match(prepareFn, /generateRoutePlanDemandSnapshot/)
  assert.match(tab, /resourcesChecklistReady\(readiness\)/)
  assert.doesNotMatch(tab, /coverage\?\.coverage_state === 'ready' \? '✓' : '○' \} Recursos/)

  const r = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    postReloadCoverage,
    { reloadApplied: true },
  )
  assert.equal(shouldHaltPrepareForResources(r), false)
  const calls = { snapshot: 0 }
  const prepared = await runPrepareSequence({
    generateSnapshot: async () => { calls.snapshot += 1; return { ok: true, snapshotId: 22, lineCount: 64 } },
    runOptimize: async () => ({ revision: 'opt-r', blocked: false, metrics: { revision: 'opt-r', unassigned: 0 } }),
    runReview: async () => ({ revision: 'rev-r', state: 'ready', failed: false }),
  })
  assert.equal(calls.snapshot, 1, 'click Preparar post-reload llega a generate snapshot')
  assert.equal(prepared.complete, true)
})

test('snapshot-readiness A–G: Preparar refresca overcapacity y muestra panel sin apply', async () => {
  const initial = routeReadiness(
    { plan_id: 6926, plan_state: 'draft' },
    37,
    { coverage_state: 'ready', overcapacity: false, demand_kg: null, capacity_kg: 1600, blockers: [] },
  )
  assert.equal(initial.overcapacity, false)
  assert.equal(shouldShowCapacityReloadPanel({
    published: false, overcapacity: initial.overcapacity, reloadApplied: false,
  }), false)

  const order = []
  let coverage = { coverage_state: 'ready', overcapacity: false, demand_kg: null, capacity_kg: 1600, blockers: [] }
  const applyCalls = []
  const prepared = await runPrepareSequence({
    generateSnapshot: async () => {
      order.push('snapshot')
      return { ok: true, snapshotId: 670, lineCount: 37 }
    },
    afterSnapshot: async () => {
      order.push('refresh')
      const parsed = interpretPlanReadinessResponse({
        ok: true,
        data: {
          readiness: {
            coverage_state: 'blocked',
            overcapacity: true,
            demand_kg: 1712.7,
            capacity_kg: 1600,
            missing_vehicle: false,
            missing_driver: false,
            missing_salesperson: false,
            blockers: ['Sobrecapacidad: demanda 1712.7 kg > capacidad 1600.0 kg.'],
          },
        },
      })
      assert.equal(parsed.ok, true)
      coverage = parsed.readiness
    },
    runOptimize: async () => {
      order.push('optimize')
      return { revision: 'opt-6926', blocked: false, metrics: { revision: 'opt-6926', unassigned: 2 } }
    },
    runReview: async () => {
      order.push('review')
      applyCalls.push('review')
      return { revision: 'rev-6926', state: 'ready', failed: false }
    },
  })
  assert.deepEqual(order, ['snapshot', 'refresh', 'optimize'])
  assert.equal(prepared.complete, false)
  assert.equal(coverage.overcapacity, true)
  assert.equal(coverage.demand_kg, 1712.7)
  assert.equal(coverage.capacity_kg, 1600)

  const after = routeReadiness(
    { plan_id: 6926, plan_state: 'draft' },
    37,
    coverage,
    { reloadApplied: false },
  )
  assert.equal(after.overcapacity, true)
  assert.equal(shouldShowCapacityReloadPanel({
    published: after.published, overcapacity: after.overcapacity, reloadApplied: false,
  }), true)
  assert.equal(coverage.missing_vehicle, false)
  assert.equal(coverage.missing_driver, false)
  assert.equal(coverage.missing_salesperson, false)
  assert.equal(applyCalls.length, 0, 'no aplica reload ni review si hay unassigned')

  const normal = routeReadiness(
    { plan_id: 11, plan_state: 'draft' },
    8,
    { coverage_state: 'ready', overcapacity: false, demand_kg: 1500, capacity_kg: 1600, blockers: [] },
  )
  assert.equal(shouldShowCapacityReloadPanel({
    published: false, overcapacity: normal.overcapacity, reloadApplied: false,
  }), false)

  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  const prepareFn = tab.slice(tab.indexOf('async function handlePrepareRoute'), tab.indexOf('async function handlePublish'))
  assert.match(prepareFn, /afterSnapshot/)
  assert.match(prepareFn, /refreshReadinessFromServer\(routePlanId\)/)
  assert.match(prepareFn, /propuesta de recarga/)
  assert.doesNotMatch(prepareFn, /applyRoutePlanCapacityReload/)
})

test('snapshot-readiness H: Mercado post-reload no reabre panel ni bloquea recursos', () => {
  const mercado = routeReadiness(
    { plan_id: 6927, plan_state: 'draft' },
    64,
    postReloadCoverage,
    { reloadApplied: true },
  )
  assert.equal(mercado.overcapacity, true)
  assert.equal(shouldShowCapacityReloadPanel({
    published: false, overcapacity: mercado.overcapacity, reloadApplied: true,
  }), false)
  assert.equal(shouldHaltPrepareForResources(mercado), false)
  assert.equal(resourcesChecklistReady(mercado), true)
})

test('publicación: snapshot + revision + unassigned 0 + geo 0', () => {
  const ready = canPublishPreparedRoute({
    customersCount: 10,
    snapshotOk: true,
    optimizeBlocked: false,
    planRevision: 'rev-1',
    unassigned: 0,
    missingGeo: 0,
    reviewFailed: false,
    reviewState: 'ready',
  })
  assert.equal(ready.ok, true)
  assert.equal(canPublishPreparedRoute({ customersCount: 0, snapshotOk: true, optimizeBlocked: false, planRevision: 'r' }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: false, optimizeBlocked: false, planRevision: 'r' }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: true, planRevision: null }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: false, planRevision: 'r', unassigned: 2 }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: false, planRevision: 'r', missingGeo: 1 }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: false, planRevision: 'r', reviewState: 'blocked' }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: false, planRevision: 'r', reviewState: '' }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: false, planRevision: 'r' }).ok, false)
  assert.equal(canPublishPreparedRoute({ customersCount: 3, snapshotOk: true, optimizeBlocked: false, planRevision: 'r', reviewState: 'ready' }).ok, true)
})

test('P0: no publicar sin review exitoso ni fallback a optimize', async () => {
  const calls = { snapshot: 0, optimize: 0, review: 0, publish: 0 }
  const optimizeResult = { revision: 'opt-1', unassigned: 0 }
  let reviewResult = null
  const prepared = await runPrepareSequence({
    generateSnapshot: async () => { calls.snapshot += 1; return { ok: true, snapshotId: 9, lineCount: 3 } },
    runOptimize: async () => { calls.optimize += 1; return { revision: 'opt-1', blocked: false, metrics: optimizeResult } },
    runReview: async () => { calls.review += 1; throw new Error('review down') },
  })
  assert.equal(calls.snapshot, 1)
  assert.equal(calls.optimize, 1)
  assert.equal(calls.review, 1)
  assert.equal(prepared.complete, false)
  const gate = canPublishPreparedRoute({
    customersCount: 3,
    snapshotOk: true,
    optimizeBlocked: false,
    planRevision: reviewedPublishRevision(reviewResult) || optimizeResult.revision,
    reviewState: reviewResult?.state || '',
  })
  assert.equal(gate.ok, false, 'fallback a optimizeResult no habilita publish')
  const pub = await runPublishSequence({
    customersCount: 3,
    snapshotOk: true,
    optimizeResult,
    reviewResult: null,
    publish: async () => { calls.publish += 1 },
  })
  assert.equal(pub.publishCalled, false)
  assert.equal(calls.publish, 0)
  assert.equal(reviewedPublishRevision(null), null)
  assert.equal(reviewedPublishRevision({ revision: 'rev-9' }), 'rev-9')
})

test('P0: prepare+publish usa exactamente la revisión de review', async () => {
  const calls = { snapshot: 0, optimize: 0, review: 0, publish: 0 }
  let sentRevision = null
  const prepared = await runPrepareSequence({
    generateSnapshot: async () => { calls.snapshot += 1; return { ok: true, snapshotId: 1, lineCount: 4 } },
    runOptimize: async () => { calls.optimize += 1; return { revision: 'opt-1', blocked: false, metrics: { revision: 'opt-1', unassigned: 0 } } },
    runReview: async () => {
      calls.review += 1
      return { revision: 'rev-9', state: 'ready', failed: false, missingGeo: 0 }
    },
  })
  assert.equal(calls.snapshot, 1)
  assert.equal(calls.optimize, 1)
  assert.equal(calls.review, 1)
  assert.equal(prepared.complete, true)
  const pub = await runPublishSequence({
    customersCount: 4,
    snapshotOk: true,
    optimizeResult: prepared.optimize.metrics || prepared.optimize,
    reviewResult: prepared.review,
    publish: async (revision) => { calls.publish += 1; sentRevision = revision },
  })
  assert.equal(calls.optimize, 1)
  assert.equal(calls.review, 1)
  assert.equal(calls.publish, 1)
  assert.equal(sentRevision, 'rev-9')
  assert.equal(pub.revision, 'rev-9')
  assert.equal(pub.publishCalled, true)
})

test('PUBLISH: review throw/null/empty no publica; mismatch no reoptimiza', async () => {
  const calls = { snapshot: 0, optimize: 0, review: 0, publish: 0 }
  await runPrepareSequence({
    generateSnapshot: async () => { calls.snapshot += 1; return { ok: true, snapshotId: 1, lineCount: 2 } },
    runOptimize: async () => { calls.optimize += 1; return { revision: 'opt-1', blocked: false, metrics: { revision: 'opt-1', unassigned: 0 } } },
    runReview: async () => { calls.review += 1; throw new Error('review down') },
  })
  assert.equal(calls.snapshot, 1)
  assert.equal(calls.optimize, 1)
  assert.equal(calls.review, 1)

  const thrown = await runPublishSequence({
    customersCount: 2,
    snapshotOk: true,
    optimizeResult: { revision: 'opt-1' },
    reviewResult: { failed: true, state: '', revision: null },
    publish: async () => { calls.publish += 1 },
  })
  assert.equal(thrown.publishCalled, false)

  const empty = await runPublishSequence({
    customersCount: 2,
    snapshotOk: true,
    optimizeResult: { revision: 'opt-1' },
    reviewResult: { revision: 'rev-9', state: '', failed: false },
    publish: async () => { calls.publish += 1 },
  })
  assert.equal(empty.publishCalled, false)

  const missing = await runPublishSequence({
    customersCount: 2,
    snapshotOk: true,
    optimizeResult: { revision: 'opt-1' },
    reviewResult: null,
    publish: async () => { calls.publish += 1 },
  })
  assert.equal(missing.publishCalled, false)
  assert.equal(calls.publish, 0)
  assert.equal(calls.optimize, 1)
  assert.equal(calls.review, 1)

  const mismatch = await runPublishSequence({
    customersCount: 2,
    snapshotOk: true,
    optimizeResult: { revision: 'opt-1' },
    reviewResult: { revision: 'rev-9', state: 'ready', failed: false },
    publish: async () => {
      calls.publish += 1
      return { ok: false, status: 'error', code: 'revision_mismatch' }
    },
  })
  assert.equal(mismatch.publishCalled, true)
  assert.equal(mismatch.published, false)
  assert.equal(mismatch.pub.code, 'revision_mismatch')
  assert.equal(calls.publish, 1)
  assert.equal(calls.optimize, 1, 'mismatch no dispara optimize extra')
  assert.equal(calls.review, 1, 'mismatch no dispara review extra')
})

test('N6: reopen 404/not_found oculta CTA; reopen exitoso invalida preparación', () => {
  assert.equal(isReopenNotFound({ phase: 'not_found' }), true)
  assert.equal(isReopenNotFound({ status: 'error', phase: 'not_found', code: 'http_error' }), true)
  assert.equal(isReopenNotFound({ status: 'error', code: 'http_error' }), false)
  assert.equal(isReopenNotFound({ status: 404 }), true)
  assert.equal(isReopenNotFound({ status: 404, phase: 'not_found', code: 'http_error' }), true)
  const prepared = {
    snapshotResult: { ok: true, snapshotId: 1 },
    optimizeResult: { revision: 'opt-1' },
    reviewResult: { revision: 'rev-9', state: 'ready' },
  }
  const after = { ...prepared, ...preparationAfterReopen() }
  assert.equal(after.snapshotResult, null)
  assert.equal(after.optimizeResult, null)
  assert.equal(after.reviewResult, null)
  assert.equal(canPublishPreparedRoute({
    customersCount: 4, snapshotOk: false, optimizeBlocked: true, planRevision: null,
  }).ok, false)
})

test('P0-04: copy de unión no inventa clientes combinados', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.doesNotMatch(tab, /Clientes combinados/)
  assert.match(tab, /Planes seleccionados/)
  assert.equal(shouldShowCombinedSources(null), false)
  assert.equal(shouldShowCombinedSources(['SP:1']), false)
  assert.equal(shouldShowCombinedSources(['SP:1', 'SO:2']), true)
  assert.deepEqual(echoedUnionKeys({ ok: true, data: { source_keys: ['P:7', 'SP:3'] } }), ['P:7', 'SP:3'])
  assert.equal(echoedUnionKeys({ ok: true, data: {} }), null)
})

test('P0-03: auto-open no dispara ensure sin zona resuelta', () => {
  assert.equal(canEnsureRoutePlan({
    polygonId: 0, subpolygonId: 0, segmentId: 0,
  }), false)
  assert.equal(shouldAutoOpenEnsure({ alreadyOpened: false, hasRoute: true, zoneReady: false }), false)
  assert.equal(shouldAutoOpenEnsure({ alreadyOpened: false, hasRoute: true, zoneReady: true }), true)
  assert.equal(shouldAutoOpenEnsure({ alreadyOpened: true, hasRoute: true, zoneReady: true }), false)
})

test('wiring: lead aparece en la secuencia como Prospecto', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(tab, /Prospecto ·/)
  assert.match(tab, /st\.lead_id/)
})

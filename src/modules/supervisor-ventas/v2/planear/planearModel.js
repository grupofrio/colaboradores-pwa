// ─── Modelo PURO de "Planear mañana" (sin React, sin red) ────────────────────
// Toda la lógica de forma/derivación vive aquí para poder probarla sin runtime.
// La pestaña (PlanearMananaTab) solo orquesta red + estado y delega el render.
//
// CONTRATO DE ESCRITURA: ensure → preview → add/remove → assign-resources →
// publish. La asignación se valida en backend y su readiness es autoritativa.
//
// null ≠ 0: la ausencia de un dato se dice "Sin dato" / —, nunca un 0 inventado.

import {
  canEditRoutePlanCustomers,
  canPublishRoutePlan,
  getRoutePlanningState,
} from '../../routePlanning.js'

// Estados del plan de ruta en palabra (el color solo no basta bajo el sol).
export const PLAN_STATE_LABEL = Object.freeze({
  sin_plan: 'Sin preparar',
  plan_draft: 'Borrador',
  forecast_confirmed: 'Borrador',
  published: 'Publicada',
  load_ready: 'Carga lista',
  load_executed: 'Carga sellada',
  blocked: 'Bloqueada',
})

export function planStateLabel(row = {}) {
  return PLAN_STATE_LABEL[getRoutePlanningState(row)] || 'Sin preparar'
}

// ── Readiness de UNA ruta para publicarse ────────────────────────────────────
// Devuelve el veredicto de publicación con RAZONES en palabra, para que la
// supervisora sepa qué falta, no solo que "no se puede".
function resourceBlockerReason(coverage = {}) {
  const blockers = Array.isArray(coverage.blockers) ? coverage.blockers.filter(Boolean) : []
  if (blockers.length > 0) return String(blockers[0])
  if (coverage.missing_vehicle) return 'Falta asignar una unidad a la ruta.'
  if (coverage.missing_driver) return 'Falta asignar un chofer a la ruta.'
  if (coverage.missing_salesperson) return 'Falta asignar un vendedor a la ruta.'
  return 'Completa la asignación de recursos antes de publicar.'
}

/** Bloqueo de sobrecapacidad total (demanda > unidad). Tras apply de recarga
 *  el backend sigue marcando overcapacity en assign readiness, pero review/
 *  publish lo resuelven vía capacity_resolution=reload. */
export function isCapacityOverloadBlocker(text) {
  const t = String(text || '').toLowerCase()
  return t.includes('sobrecapacidad') || t.includes('overcapacity')
}

function coverageBlocksPublishing(coverage, { reloadApplied = false } = {}) {
  if (!coverage) return false
  // Recarga no perdona recursos faltantes: la excepción es SOLO sobrecapacidad.
  if (coverage.missing_vehicle || coverage.missing_driver || coverage.missing_salesperson) return true
  const state = String(coverage.coverage_state || '').toLowerCase()
  const blockers = Array.isArray(coverage.blockers) ? coverage.blockers.filter(Boolean) : []
  const relevant = reloadApplied
    ? blockers.filter((b) => !isCapacityOverloadBlocker(b))
    : blockers
  if (relevant.length > 0) return true
  if (state === 'incomplete') return true
  if (state === 'blocked') {
    // Solo sobrecapacidad + recarga ya aplicada ⇒ no bloquear el gate de UI;
    // review/publish del backend siguen siendo fail-closed.
    if (reloadApplied && blockers.every(isCapacityOverloadBlocker)) return false
    if (reloadApplied && blockers.length === 0 && Boolean(coverage.overcapacity)) return false
    return true
  }
  return false
}

/** Única decisión de recursos para checklist y Preparar: readiness.resourceBlocked. */
export function shouldHaltPrepareForResources(readiness) {
  return Boolean(readiness?.resourceBlocked)
}

export function prepareResourceHaltMessage(readiness) {
  if (!shouldHaltPrepareForResources(readiness)) return null
  return readiness?.reasons?.[0] || 'Completa la asignación de recursos antes de preparar la ruta.'
}

export function resourcesChecklistReady(readiness) {
  return Boolean(readiness && !readiness.resourceBlocked)
}

export function routeReadiness(route = {}, customersCount = 0, coverage = null, opts = {}) {
  const reloadApplied = Boolean(opts.reloadApplied)
  const editable = canEditRoutePlanCustomers(route)
  const planPublishable = canPublishRoutePlan({
    state: route.state,
    plan_state: route.plan_state,
    customersCount,
    load_sealed: route.load_sealed,
    load_picking_id: route.load_picking_id,
  })
  const resourceBlocked = coverageBlocksPublishing(coverage, { reloadApplied })
  const publishable = planPublishable && !resourceBlocked
  const reasons = []
  const st = getRoutePlanningState(route)
  if (st === 'sin_plan' || !route.plan_id) {
    reasons.push('Aún no preparas el plan del día.')
  } else if (st === 'published') {
    reasons.push('Ya está publicada.')
  } else if (!editable) {
    reasons.push('La carga ya está lista o sellada: no admite cambios.')
  } else if (Number(customersCount || 0) <= 0) {
    reasons.push('No tiene clientes; genera la propuesta primero.')
  } else if (resourceBlocked) {
    reasons.push(resourceBlockerReason(coverage))
  }
  const overcapacity = Boolean(coverage?.overcapacity)
  const demandRaw = coverage?.demand_kg
  const capacityRaw = coverage?.capacity_kg
  const demandKg = demandRaw == null || demandRaw === '' ? null : Number(demandRaw)
  const capacityKg = capacityRaw == null || capacityRaw === '' ? null : Number(capacityRaw)
  return {
    state: st,
    stateLabel: planStateLabel(route),
    editable,
    publishable,
    published: st === 'published',
    customersCount: Number(customersCount || 0),
    resourceBlocked,
    reasons,
    // Señales autoritativas del DTO de assign/readiness (no inventadas aquí).
    overcapacity,
    demandKg: Number.isFinite(demandKg) ? demandKg : null,
    capacityKg: Number.isFinite(capacityKg) ? capacityKg : null,
    reloadApplied,
  }
}

/** Panel "necesita recarga": sobrecapacidad autoritativa y aún sin apply. */
export function shouldShowCapacityReloadPanel({
  published = false,
  overcapacity = false,
  reloadApplied = false,
} = {}) {
  return Boolean(!published && overcapacity && !reloadApplied)
}

/** Interpreta capacity-reload-preview. NO escribe. withinCapacity usa kg del
 *  backend vs capacidad autoritativa; si falta capacidad, no se afirma seguro. */
export function interpretCapacityReloadPreview(resp = {}, capacityKg = null) {
  const isErr = resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error'
  const d = isErr ? {} : (resp?.data || resp || {})
  const reload = d.reload || d.data?.reload || null
  if (isErr || !reload) {
    return {
      ok: false,
      reload: null,
      message: resp?.message || resp?.data?.message || 'No hay una recarga viable para este plan.',
      code: String(resp?.code || resp?.data?.code || '').toLowerCase() || 'reload_preview_failed',
      withinCapacity: false,
      applyAllowed: false,
    }
  }
  const firstKg = Number(reload.first_trip_kg)
  const secondKg = Number(reload.second_trip_kg)
  const reloadKg = Number(reload.reload_kg)
  const cap = capacityKg == null || capacityKg === '' ? null : Number(capacityKg)
  const hasTrips = Number.isFinite(firstKg) && Number.isFinite(secondKg)
  let withinCapacity = false
  if (hasTrips && Number.isFinite(cap) && cap > 0) {
    withinCapacity = firstKg <= cap + 1e-6 && secondKg <= cap + 1e-6
  }
  return {
    ok: true,
    reload: {
      route_plan_id: reload.route_plan_id ?? null,
      resolution: reload.resolution || 'reload',
      depot_id: reload.depot_id ?? null,
      reload_after_stop_id: reload.reload_after_stop_id ?? null,
      first_trip_kg: Number.isFinite(firstKg) ? firstKg : null,
      second_trip_kg: Number.isFinite(secondKg) ? secondKg : null,
      reload_kg: Number.isFinite(reloadKg) ? reloadKg : (Number.isFinite(secondKg) ? secondKg : null),
      trip_count: Number(reload.trip_count || 2) || 2,
      physical_load: reload.physical_load || 'not_created',
    },
    message: resp?.message || 'Recarga propuesta',
    code: '',
    withinCapacity,
    applyAllowed: Boolean(withinCapacity),
  }
}

export function canApplyCapacityReloadPreview(preview) {
  return Boolean(preview?.ok && preview?.applyAllowed && preview?.reload)
}

/** Tras apply exitoso: invalidar preparación previa (fail-closed). */
export function preparationAfterCapacityReload() {
  return { snapshotResult: null, optimizeResult: null, reviewResult: null, reloadPreview: null }
}

/** Gate de publicación de la PWA: snapshot + optimizer + veredicto positivo de review. */
export const PUBLISHABLE_REVIEW_STATES = Object.freeze(['ready', 'warning'])

export function canPublishPreparedRoute({
  customersCount = 0,
  snapshotOk = false,
  optimizeBlocked = true,
  planRevision = null,
  unassigned = 0,
  missingGeo = 0,
  reviewFailed = false,
  reviewState = '',
} = {}) {
  if (Number(customersCount || 0) <= 0) return { ok: false, reason: 'No tiene clientes.' }
  if (!snapshotOk) return { ok: false, reason: 'Falta preparar la demanda.' }
  if (optimizeBlocked) return { ok: false, reason: 'Falta una optimización vigente.' }
  if (!planRevision) return { ok: false, reason: 'Falta la revisión vigente.' }
  if (Number(unassigned || 0) > 0) return { ok: false, reason: 'Hay clientes sin asignar.' }
  if (Number(missingGeo || 0) > 0) return { ok: false, reason: 'Hay clientes sin ubicación.' }
  if (reviewFailed) return { ok: false, reason: 'La revisión bloquea la publicación.' }
  const state = String(reviewState || '').toLowerCase()
  if (!PUBLISHABLE_REVIEW_STATES.includes(state)) {
    return { ok: false, reason: 'La ruta no tiene un veredicto de revisión publicable.' }
  }
  return { ok: true, reason: null }
}

// ── Resumen de recursos del día (read-only) ──────────────────────────────────
// A partir del payload de /available-resources. Cuenta libres vs tomados y marca
// cuántas unidades no tienen capacidad registrada (para no prometer "cabe").
export function summarizeResources(resources = {}) {
  const vehicles = Array.isArray(resources.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources.people) ? resources.people : []
  const vehiclesAvailable = resources.vehicles_available === true
  const rosterAvailable = people.length > 0

  const unitsFree = vehicles.filter((v) => v && v.available).length
  const unitsTaken = vehicles.length - unitsFree
  const capacityUnknown = vehicles.filter((v) => v && v.capacity_kg == null).length

  const peopleFree = people.filter((p) => p && p.available).length
  const peopleTaken = people.length - peopleFree
  const drivers = people.filter((p) => p && p.is_driver).length
  const sellers = people.filter((p) => p && p.is_seller).length

  return {
    vehiclesAvailable,
    rosterAvailable,
    unitsTotal: vehicles.length,
    unitsFree,
    unitsTaken,
    capacityUnknown,
    peopleTotal: people.length,
    peopleFree,
    peopleTaken,
    drivers,
    sellers,
  }
}

// Personas ya tomadas por un plan de ESA fecha (para avisar de dobles turnos).
export function assignedPeople(resources = {}) {
  const people = Array.isArray(resources.people) ? resources.people : []
  return people.filter((p) => p && !p.available && p.assigned_plan_id)
}

// Capacidad en kg → texto honesto (— cuando no hay dato, no "0 kg").
export function capacityLabel(kg) {
  if (kg == null || !(Number(kg) > 0)) return 'Sin dato'
  return `${Number(kg).toLocaleString('es-MX')} kg`
}

// ── Asignación de recursos de UNA ruta ───────────────────────────────────────
// Deriva del payload de /available-resources qué unidad/chofer/vendedor ya trae
// ESTE plan. El backend marca los planes que ocupan cada recurso en
// `assigned_plan_ids` (LISTA: un recurso puede aparecer en varios planes del día).
// Antes se leía `assigned_plan_id` en singular —campo que el backend NUNCA
// devuelve—, así que la comparación era siempre 0 ≠ planId: los selectores salían
// "Sin asignar" aunque el plan ya tuviera sus recursos, y `busyElsewhere` jamás se
// activaba (se podía doblar una unidad ya usada en otra ruta del día).
const planIdsOfResource = (it) => {
  const raw = it?.assigned_plan_ids
  const list = Array.isArray(raw) ? raw : (raw == null ? [] : [raw])
  return list.map((v) => Number(v || 0)).filter((v) => v > 0)
}

export function isResourceAssignedTo(item, planId) {
  const pid = Number(planId || 0)
  return pid > 0 && planIdsOfResource(item).includes(pid)
}

export function derivePlanAssignment(resources = {}, planId = 0) {
  const pid = Number(planId || 0)
  const vehicles = Array.isArray(resources.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources.people) ? resources.people : []
  const veh = vehicles.find((v) => isResourceAssignedTo(v, pid)) || null
  const driver = people.find((p) => p.is_driver && isResourceAssignedTo(p, pid)) || null
  const seller = people.find((p) => p.is_seller && isResourceAssignedTo(p, pid)) || null
  return {
    vehicle: veh ? { id: veh.id, name: veh.name, capacity_kg: veh.capacity_kg } : null,
    driver: driver ? { id: driver.id, name: driver.name } : null,
    salesperson: seller ? { id: seller.id, name: seller.name } : null,
  }
}

// Opciones de un recurso para el picker: marca ocupado (en otra ruta de la fecha)
// y conserva la selección actual aunque esté "ocupada" por este mismo plan.
export function resourceOptions(items = [], planId = 0, currentId = 0) {
  const pid = Number(planId || 0)
  return (Array.isArray(items) ? items : []).map((it) => {
    const planIds = planIdsOfResource(it)
    // Otras rutas del día (excluye el plan actual): reutilizable, solo se etiqueta.
    const assignedPlanIds = planIds
    const elsewhereCount = planIds.filter((id) => id !== pid).length
    const busyElsewhere = elsewhereCount > 0
    return {
      id: it.id,
      name: it.name,
      capacity_kg: it.capacity_kg,
      busyElsewhere,
      elsewhereCount,
      assignedPlanIds,
      isCurrent: Number(it.id) === Number(currentId || 0),
    }
  })
}

// Readiness de PRESENCIA (foto local antes del write). El backend devuelve la
// readiness completa (incluye sobrecapacidad) en cada asignación; ésta solo dice
// qué recurso falta para no mostrar nada hasta el primer write.
export function resourceReadiness(assignment = {}) {
  const missing_vehicle = !assignment.vehicle
  const missing_driver = !assignment.driver
  const missing_salesperson = !assignment.salesperson
  let coverage_state = 'ready'
  if (missing_vehicle) coverage_state = 'blocked'
  else if (missing_driver || missing_salesperson) coverage_state = 'incomplete'
  return {
    missing_vehicle, missing_driver, missing_salesperson,
    coverage_state,
    coverage_label: coverage_state === 'ready' ? 'Lista' : coverage_state === 'incomplete' ? 'Incompleta' : 'Falta lo indispensable',
  }
}

export const COVERAGE_TONE = Object.freeze({ ready: 'ok', incomplete: 'warn', blocked: 'bad' })

// Roles de una persona en palabra (puede ser chofer y vendedor a la vez).
export function personRolesLabel(person = {}) {
  const roles = []
  if (person.is_driver) roles.push('Chofer')
  if (person.is_seller) roles.push('Vendedor')
  return roles.length ? roles.join(' · ') : 'Equipo'
}

// Contrato optimize↔publish (B5 · Codex P1). Interpreta la respuesta del
// optimizador y decide si habilita publicar. REGLA DURA: SOLO un éxito con
// `plan_revision` habilita publicar (blocked:false + revision). Todo lo demás
// —error explícito del backend (FORBIDDEN/LOCKED/VALIDATION/NOT_FOUND/CONFLICT/
// CAPABILITY_UNAVAILABLE/red) o un "éxito" malformado SIN revisión— BLOQUEA.
// NO se degrada a publicar directo: dejaría publicar (con el flag apagado) una
// ruta que no podemos anclar a una revisión verificable.
//
// `metrics` = payload para la tarjeta (o null). null ≠ 0: los kilos/capacidad/
// utilización sólo viajan si el backend los mandó; unassigned se normaliza a 0.
export function interpretOptimizeResponse(opt = {}) {
  const isErr = opt?.ok === false || String(opt?.status || '').toLowerCase() === 'error'
  const d = isErr ? {} : (opt?.data || opt || {})
  const revision = isErr ? null : (d.plan_revision || null)
  if (revision) {
    return {
      revision,
      blocked: false,
      message: '',
      metrics: {
        stops: (d.stops_count ?? null),
        km: (d.distance_km ?? null),
        min: (d.duration_min ?? null),
        revision,
        demandKg: (d.demand_kg ?? null),
        capacityKg: (d.capacity_kg ?? null),
        utilizationPct: (d.utilization_pct ?? null),
        unassigned: (Number(d.unassigned_count ?? 0) || 0),
        distanceSource: d.distance_source || null,
        sequence: Array.isArray(d.sequence) ? d.sequence : [],
      },
    }
  }
  const message = isErr
    ? (opt?.message || 'El optimizador no pudo secuenciar la ruta. Intenta de nuevo o avisa a soporte.')
    : 'El optimizador respondió sin una revisión verificable; no se publica.'
  return { revision: null, blocked: true, message, metrics: null }
}

// Contrato optimize→review→publish (B5+ · absorbe el review de Sebas). Interpreta
// la respuesta de `route-plan-review`: readiness ready/warning/blocked + bloqueos/
// avisos/geo/sobrecapacidad + la revisión POST-review (la que publish exigirá).
// `failed` = el ENDPOINT de review falló (no confundir con readiness 'blocked'):
// backend viejo/red ⇒ la UI debe detenerse; publicar sin revisión registrada viola
// el gate del servidor.
export function interpretReviewResponse(resp = {}) {
  const isErr = resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error'
  const d = isErr ? {} : (resp?.data || resp || {})
  return {
    failed: isErr,
    message: isErr ? (resp?.message || resp?.data?.message || 'No se pudo revisar el plan.') : '',
    state: String((isErr ? '' : d.readiness_state) || '').toLowerCase(),
    blockers: Array.isArray(d.blockers) ? d.blockers : [],
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
    missingGeo: (Number(d.missing_geo_count ?? 0) || 0),
    overcapacity: Boolean(d.overcapacity),
    distanceSource: d.distance_source || null,
    unassigned: (Number(d.unassigned_count ?? 0) || 0),
    revision: d.plan_revision || null,
  }
}

// B7: solo una respuesta exitosa CON el id del snapshot permite afirmar que la
// demanda quedó congelada. Un ok malformado no se presenta como éxito.
export function interpretDemandSnapshotResponse(resp = {}) {
  const isErr = resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error'
  const d = isErr ? {} : (resp?.data || resp || {})
  const snapshotId = Number(d.demand_snapshot_id || 0) || null
  const code = String(resp?.code || resp?.data?.code || '').toLowerCase()
  const parsedLineCount = Number(d.line_count)
  if (!isErr && snapshotId) {
    return {
      ok: true,
      snapshotId,
      lineCount: Number.isFinite(parsedLineCount) && parsedLineCount >= 0 ? parsedLineCount : null,
      message: resp?.message || 'Snapshot de demanda generado.',
    }
  }
  return {
    ok: false,
    snapshotId: null,
    lineCount: null,
    code: code || (isErr ? 'snapshot_failed' : 'snapshot_response_invalid'),
    message: resp?.message || resp?.data?.message || 'El servidor no confirmó el snapshot de demanda.',
  }
}

// Interpreta la respuesta de `route-plan-publish` (B5+). El envelope MANDA: los
// códigos accionables (readiness_blocked/readiness_warnings/demand_snapshot_required/
// revision_mismatch) NO son "éxito". Devuelve una decisión tipada para la UI.
export function interpretPublishResponse(resp = {}) {
  const isErr = resp?.ok === false
    || String(resp?.status || '').toLowerCase() === 'error'
    || String(resp?.data?.status || '').toLowerCase() === 'error'
  const code = String(resp?.code || resp?.data?.code || '').toLowerCase()
  const d = resp?.data || {}
  return {
    ok: !isErr && !code,
    code,
    blockers: Array.isArray(d.blockers) ? d.blockers : [],
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
    message: resp?.message || resp?.data?.message || '',
  }
}

export function reviewedPublishRevision(reviewResult) {
  const revision = reviewResult?.revision
  if (!revision) return null
  return revision
}

export function interpretPlanReadinessResponse(resp = {}) {
  const isErr = resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error'
  const data = isErr ? {} : (resp?.data || resp || {})
  if (!isErr && data.readiness) {
    return { ok: true, readiness: data.readiness, source: 'authoritative' }
  }
  return { ok: false, readiness: null, source: isErr ? 'error' : 'invalid' }
}

export async function runPrepareSequence({ generateSnapshot, afterSnapshot, runOptimize, runReview }) {
  const snapshot = await generateSnapshot()
  if (!snapshot?.ok || (snapshot.lineCount != null && snapshot.lineCount <= 0)) {
    return { snapshot, optimize: null, review: null, complete: false }
  }
  // El snapshot cambia demand_kg/overcapacity. Hay que refrescar readiness
  // AUTORITATIVA antes de optimize/UI para no dejar overcapacity stale.
  if (typeof afterSnapshot === 'function') {
    await afterSnapshot(snapshot)
  }
  const optimize = await runOptimize()
  if (optimize?.blocked || Number(optimize?.metrics?.unassigned || optimize?.unassigned || 0) > 0) {
    return { snapshot, optimize, review: null, complete: false }
  }
  try {
    const review = await runReview()
    const complete = Boolean(review && !review.failed && PUBLISHABLE_REVIEW_STATES.includes(String(review.state || '').toLowerCase()))
    return { snapshot, optimize, review, complete }
  } catch {
    return { snapshot, optimize, review: { failed: true, state: '', revision: null }, complete: false }
  }
}

export async function runPublishSequence({
  customersCount,
  snapshotOk,
  optimizeResult,
  reviewResult,
  publish,
}) {
  const revision = reviewedPublishRevision(reviewResult)
  const gate = canPublishPreparedRoute({
    customersCount,
    snapshotOk,
    optimizeBlocked: Boolean(optimizeResult == null || !optimizeResult.revision),
    planRevision: revision,
    unassigned: Number(optimizeResult?.unassigned || reviewResult?.unassigned || 0),
    missingGeo: Number(reviewResult?.missingGeo || 0),
    reviewFailed: Boolean(reviewResult?.failed),
    reviewState: reviewResult?.state || '',
  })
  if (!gate.ok) return { ok: false, published: false, revision: null, gate, publishCalled: false, pub: null }
  const pub = interpretPublishResponse(await publish(revision))
  return {
    ok: Boolean(pub.ok),
    published: Boolean(pub.ok),
    revision,
    gate,
    publishCalled: true,
    pub,
  }
}

export function preparationAfterReopen() {
  return { snapshotResult: null, optimizeResult: null, reviewResult: null }
}

export function isReopenNotFound(res) {
  if (String(res?.phase || '').toLowerCase() === 'not_found') return true
  // Raw ApiError before the shim attaches phase: HTTP 404 of a missing endpoint.
  if (res && res.phase == null && Number(res.status) === 404) return true
  return false
}

export function shouldAutoOpenEnsure({ alreadyOpened, hasRoute, zoneReady }) {
  return Boolean(!alreadyOpened && hasRoute && zoneReady)
}

export function echoedUnionKeys(ensureResp) {
  const data = ensureResp?.data || ensureResp || {}
  const keys = data.source_keys
  return Array.isArray(keys) ? keys.filter(Boolean) : null
}

export function shouldShowCombinedSources(sourceKeys) {
  return Array.isArray(sourceKeys) && sourceKeys.length >= 2
}

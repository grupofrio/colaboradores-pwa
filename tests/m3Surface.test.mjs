import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  getNavModules, getVisibleModulesForSession, isModuleVisibleForSession,
  getModuleEntryDecisionForSession, buildDesktopNav, buildMobileNav, isNavHiddenForPath,
} from '../src/lib/navModel.js'
import { M3_API_LATEST_FIXTURE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'
import * as m3Meta from '../src/modules/ejecucion/m3/m3Meta.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const homeSrc = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
const screenSrc = readFileSync(new URL('../src/modules/ejecucion/ScreenEjecucionM3.jsx', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const towerSession = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)
const EJECUCION = getModuleById('ejecucion')

// ── Catálogo canónico ────────────────────────────────────────────────────────
test('registry: ejecucion con accessPolicy m3, ruta /ejecucion, sin duplicados', () => {
  assert.ok(EJECUCION)
  assert.equal(EJECUCION.label, 'Ejecución de rutas')
  assert.equal(EJECUCION.route, '/ejecucion')
  assert.equal(EJECUCION.accessPolicy, 'm3')
  assert.equal(EJECUCION.showOnHome, true)
  assert.equal(EJECUCION.showInNav, true)
  assert.equal(MODULES.filter((m) => m.route === '/ejecucion').length, 1)
})

test('isModuleVisibleForRoles EXCLUYE módulos con accessPolicy', () => {
  assert.equal(isModuleVisibleForRoles(EJECUCION, ['direccion_general']), false)
  assert.equal(isModuleVisibleForRoles(EJECUCION, ['*']), false)
})

// ── B3: LA MISMA autoridad decide tarjeta, nav y clic ────────────────────────
test('direccion_general: tarjeta + nav móvil/desktop + clic directo + URL (guard)', () => {
  const sess = s('direccion_general')
  assert.equal(isModuleVisibleForSession(EJECUCION, sess), true)
  assert.ok(ids(getVisibleModulesForSession(sess)).includes('ejecucion'), 'tarjeta home')
  assert.ok(ids(getNavModules(sess)).includes('ejecucion'), 'nav')
  assert.ok(ids(buildDesktopNav(sess, '/').modules).includes('ejecucion'), 'rail desktop')
  const mobile = buildMobileNav(sess, '/')
  const inMobile = ids(mobile.primary).includes('ejecucion') || ids(mobile.overflow || []).includes('ejecucion')
  assert.ok(inMobile, 'nav móvil (directo o en Más)')
  const decision = getModuleEntryDecisionForSession(EJECUCION, sess)
  assert.equal(decision.type, 'direct')
  assert.equal(decision.selectedRole, '', 'sin role-context: navega directo')
})

test('admin_plataforma (tower_status): ve tarjeta/nav Y el clic ENTRA — sin asimetría', () => {
  const sess = towerSession('admin_plataforma')
  assert.equal(isModuleVisibleForSession(EJECUCION, sess), true)
  assert.ok(ids(getNavModules(sess)).includes('ejecucion'))
  assert.equal(getModuleEntryDecisionForSession(EJECUCION, sess).type, 'direct')
})

test('chofer/jefe_ruta/supervisor/gerente: NO ven, NO entran (Fase 10)', () => {
  for (const sess of [s('jefe_ruta'), s('auxiliar_ruta'), s('supervisor_ventas'),
    towerSession('supervisor_ventas'), s('gerente_sucursal'), s('operador_torres')]) {
    assert.equal(isModuleVisibleForSession(EJECUCION, sess), false)
    assert.ok(!ids(getNavModules(sess)).includes('ejecucion'))
    assert.equal(getModuleEntryDecisionForSession(EJECUCION, sess).type, 'denied')
  }
})

test('sesión inválida: cero tarjetas/nav y clic denegado', () => {
  for (const bad of [null, {}, { role: 'direccion_general' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    assert.equal(getModuleEntryDecisionForSession(EJECUCION, bad).type, 'denied')
  }
})

test('política desconocida => fail-closed; módulos normales delegan sin bypass', () => {
  const alien = { id: 'x', route: '/x', roles: ['*'], accessPolicy: 'otra', showOnHome: true, showInNav: true }
  assert.equal(isModuleVisibleForSession(alien, s('direccion_general')), false)
  assert.equal(getModuleEntryDecisionForSession(alien, s('direccion_general')).type, 'denied')
  const admin = getModuleById('admin_sucursal')
  assert.equal(getModuleEntryDecisionForSession(admin, s('supervisor_ventas')).type, 'denied')
  assert.notEqual(getModuleEntryDecisionForSession(admin, s('gerente_sucursal')).type, 'denied')
  // universales intactos para un rol básico
  assert.deepEqual(ids(getNavModules(s('rol_comun'))), ['kpis', 'encuestas', 'logros'])
})

test('ScreenHome usa la fuente session-aware para tarjetas Y clic', () => {
  // Post-#67: Home consume getHomeModulesForSession (orden histórico del
  // registry + showOnHome), no getVisibleModulesForSession — la autorización
  // no ordena ni filtra por superficie (fix de Sebastián d7c2bb8).
  assert.match(homeSrc, /getHomeModulesForSession\(session\)/)
  assert.match(homeSrc, /getModuleEntryDecisionForSession\(mod, session\)/)
  assert.ok(!/getModulesForRoles\(getEffectiveJobKeys/.test(homeSrc))
})

// ── Ruta y guard ─────────────────────────────────────────────────────────────
test('App.jsx: M3EjecucionRoute (fail-closed) monta /ejecucion; Tower intacto', () => {
  assert.match(appSrc, /function M3EjecucionRoute\(\{ children \}\)/)
  const block = appSrc.slice(appSrc.indexOf('function M3EjecucionRoute'), appSrc.indexOf('function M3EjecucionRoute') + 500)
  assert.match(block, /isValidAuthenticatedSession\(session\)/)
  assert.match(block, /readM3Access\(session\)\.level !== 'global'/)
  assert.ok(appSrc.includes('<Route path="/ejecucion" element={<M3EjecucionRoute><ScreenEjecucionM3Mount /></M3EjecucionRoute>} />'))
  assert.ok(!appSrc.includes('path="/ejecucion" element={<ModuleRoleRoute'), 'gate propio, no ModuleRoleRoute')
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.ok(appSrc.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
})

test('nav: /ejecucion NO está oculta (usa la nav global con estado activo)', () => {
  assert.equal(isNavHiddenForPath('/ejecucion'), false)
})

// ── Demo gateado + semántica honesta en la UI ────────────────────────────────
test('demo: la pantalla gatea con isM3DemoAllowed(import.meta.env)', () => {
  assert.match(screenSrc, /isM3DemoAllowed\(import\.meta\.env\)/)
  assert.match(screenSrc, /demoAllowed && new URLSearchParams\(location\.search\)\.get\('demo'\) === '1'/)
  assert.match(screenSrc, /if \(demo\) \{\s*const fixture = validateM3Latest\(M3_API_LATEST_FIXTURE\)/)
  assert.match(screenSrc, /payload: fixture\.payload, demo: true/)
  assert.ok(!/payload: M3_API_LATEST_FIXTURE, demo: true/.test(screenSrc), 'nunca renderiza fixture crudo')
})

test('labels: "Incidencias detectadas" con nota de no-unicidad; KPIs de una entidad', () => {
  assert.ok(screenSrc.includes('Incidencias detectadas'))
  assert.ok(/no entidades únicas/i.test(screenSrc), 'declara que NO son entidades únicas')
  assert.ok(screenSrc.includes('Cumplimiento de visita'))
  assert.ok(screenSrc.includes('Eventos offline pendientes'))
  assert.ok(screenSrc.includes('offline_events_note'), 'KPI offline honesto: sin telemetría v1')
})

test('Codex Track C/U: la UI distingue veredictos y no llama incumplimiento a una anomalía', () => {
  assert.match(screenSrc, /M3_VERDICT_LABELS/)
  assert.match(screenSrc, /M3_VERDICT_COLORS/)
  assert.match(screenSrc, /VerdictTile/)
  assert.match(screenSrc, /M3_CLASSIFICATION_LABELS/)
  // desglose obligatorio en la superficie
  assert.ok(screenSrc.includes('definitive_incident_rule_count'))
  assert.ok(screenSrc.includes('exploratory_signal_rule_count'))
  assert.ok(screenSrc.includes('not_evaluable_rule_count'))
  // copy que enseña a leer los veredictos
  assert.ok(screenSrc.includes('Lee los veredictos, no solo los colores'))
  assert.ok(/no prueban una conclusión de negocio/i.test(screenSrc))
  // el panel muestra el contrato epistémico
  for (const field of ['Universo medido', 'Supuesto de negocio', 'Limitaciones de evidencia', 'Umbral']) {
    assert.ok(screenSrc.includes(field), field)
  }
  assert.ok(screenSrc.includes('NO APROBADO'), 'marca los umbrales sin aprobar')
})

test('RED exploratorio conserva veredicto ANOMALÍA y copy operacional neutral', () => {
  const exploratoryRed = {
    status: 'RED',
    classification: 'exploratory',
    verdict: 'anomalia',
  }
  assert.equal(typeof m3Meta.getM3FindingSemanticLabel, 'function')
  assert.equal(m3Meta.getM3FindingSemanticLabel(exploratoryRed), 'ANOMALÍA')
  assert.notEqual(m3Meta.getM3FindingSemanticLabel(exploratoryRed), 'Incumplimiento')
  assert.equal(m3Meta.M3_OPERATIONAL_STATUS_LABELS?.RED, 'Alerta operativa')

  assert.match(screenSrc, /M3_OPERATIONAL_STATUS_LABELS\[block\.status\]/)
  assert.match(screenSrc, /getM3FindingSemanticLabel\(f\)/)
  assert.doesNotMatch(screenSrc, /detectó incumplimientos/i)
})

test('filtros epistémicos: controles separados, reset y backend autoritativo', () => {
  assert.match(screenSrc, /aria-label="Veredicto"/)
  assert.match(screenSrc, /value=\{filters\.verdict\}/)
  assert.match(screenSrc, /aria-label="Clasificación"/)
  assert.match(screenSrc, /value=\{filters\.classification\}/)
  assert.ok(!screenSrc.includes('aria-label="Estado"'), 'no ofrece status RED/AMBER como veredicto')
  assert.match(screenSrc, /setFilters\(M3_DEFAULT_FILTERS\)/, 'permite limpiar filtros')
  assert.match(screenSrc, /setPage\(1\)/, 'selección o reset vuelve a página 1')

  assert.match(screenSrc, /items:\s*result\.payload\.items/)
  assert.match(screenSrc, /total:\s*result\.payload\.total/)
  assert.match(screenSrc, /pages:\s*result\.payload\.pages/)
  assert.doesNotMatch(screenSrc, /result\.payload\.items\.filter\(/,
    'no postfiltra una página ya paginada por el servidor')
  assert.doesNotMatch(screenSrc, /key !== 'status'/)
})

test('Track H: el KPI de cumplimiento declara su universo y su justificación', () => {
  assert.match(screenSrc, /visit_compliance\?\.universe_label/)
  assert.match(screenSrc, /visit_compliance\?\.rationale/)
})

test('granularidad: "Detalle de regla", badges y columna Sucursal; sin drill-down fingido', () => {
  assert.ok(screenSrc.includes('Detalle de regla'))
  assert.ok(!screenSrc.toLowerCase().includes('drill-down'))
  assert.match(screenSrc, /M3_GRANULARITY_LABELS/)
  assert.ok(screenSrc.includes("'Sucursal'"), 'columna sucursal en la tabla')
  assert.ok(!screenSrc.includes('Abrir en Odoo'))
})

test('lifecycle real gateado: persistentes/corregidos/tendencias con >= 2 corridas', () => {
  assert.match(screenSrc, /runsCount >= 2/)
  assert.ok(screenSrc.includes('primera corrida'))
})

test('STALE prominente + exports marcados + export plan vs real presente', () => {
  assert.match(screenSrc, /CORRIDA STALE/)
  assert.match(screenSrc, /exportFilename\('m3_findings', 'csv', \{ stale, demo: load\.demo \}\)/)
  assert.ok(screenSrc.includes('Comparación plan vs real'))
})

test('estados de fuente: disabled/unavailable/session/forbidden/schema_mismatch/invalid', () => {
  for (const state of ['disabled', 'unavailable', 'session_expired', 'forbidden', 'schema_mismatch', 'invalid']) {
    assert.ok(screenSrc.includes(`${state}:`), state)
  }
})

// ── Read-only duro ───────────────────────────────────────────────────────────
const M3_DIR = fileURLToPath(new URL('../src/modules/ejecucion', import.meta.url))
const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(jsx?|mjs)$/.test(entry)) acc.push(p)
  }
  return acc
}

test('read-only: el módulo M3 no emite verbos de escritura ni llamadas Odoo directas', () => {
  for (const file of walk(M3_DIR)) {
    // El fixture NO es código ejecutable de red: su procedencia cita el canal
    // de medición (xmlrpc read-only) como texto. Se valida aparte.
    if (path.basename(file) === 'apiLatestFixture.js') continue
    const src = readFileSync(file, 'utf8')
    assert.ok(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(src), `${path.basename(file)} sin verbos de escritura`)
    assert.ok(!/apiPost|apiPatch|apiDelete|execute_kw|xmlrpc/i.test(src), `${path.basename(file)} sin escrituras`)
  }
  // El fixture es data pura: sin llamadas de red de ningún tipo.
  const fixture = readFileSync(path.join(M3_DIR, 'm3', 'fixtures', 'apiLatestFixture.js'), 'utf8')
  assert.ok(!/fetch\(|XMLHttpRequest|axios/i.test(fixture), 'el fixture no hace red')
  assert.ok(fixture.includes('is_production_shell_run: false'), 'declara que no es corrida productiva')
})

test('read-only: sin botones de corrección; declara auto_fix=false y READ-ONLY', () => {
  for (const forbidden of ['Cerrar ruta', 'Corregir', 'Asignar ruta', 'Cerrar hallazgo', 'Liquidar', 'Guardar cambios', 'Conciliar ahora']) {
    assert.ok(!screenSrc.includes(forbidden), `sin botón "${forbidden}"`)
  }
  assert.ok(screenSrc.includes('auto_fix = false'))
  assert.ok(screenSrc.includes('READ-ONLY'))
})

// ── Blindaje: nada servible en public/ ───────────────────────────────────────
test('blindaje: public/ sin JSON de M3', () => {
  const PUBLIC = fileURLToPath(new URL('../public', import.meta.url))
  const leaked = []
  const walkPublic = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry)
      if (statSync(p).isDirectory()) walkPublic(p)
      else if (/m3/i.test(entry) && /\.json$/i.test(entry)) leaked.push(p)
    }
  }
  walkPublic(PUBLIC)
  assert.deepEqual(leaked, [])
})

// ── Codex ronda 2 §1: el banner de evidencia no formal es NO AMBIGUO ─────────
test('banner de evidencia NO FORMAL se decide por el DATO, no por el modo demo', () => {
  // Clave: la condición es !run.is_production_shell_run — NO load.demo. Una
  // corrida no formal ingerida en producción (demo=false) debe advertir igual.
  assert.match(screenSrc, /!run\.is_production_shell_run\s*&&/)
  assert.match(screenSrc, /EVIDENCIA NO FORMAL/)
  assert.match(screenSrc, /NO es la corrida formal por odoo-shell en producción/)
  // Muestra POR QUÉ está bloqueada y QUÉ build midió.
  assert.match(screenSrc, /production_shell_run_blocked_by/)
  assert.match(screenSrc, /auditor_build_sha/)
})

test('linaje UI muestra build auditor y contrato sin depender de build_sha', () => {
  assert.equal(typeof m3Meta.getM3Lineage, 'function')
  assert.deepEqual(m3Meta.getM3Lineage({
    auditor_build_sha: '1111111',
    contract_build_sha: '2222222',
  }), { auditor: '1111111', contract: '2222222' })
  assert.match(screenSrc, /getM3Lineage\(run, shortHash\)/)
  assert.match(screenSrc, /lineage\.auditor/)
  assert.match(screenSrc, /lineage\.contract/)
  assert.doesNotMatch(screenSrc, /run\.build_sha/)
})

test('tabla M3 aplica loading y resultado solo para la petición más reciente', () => {
  assert.match(screenSrc, /createLatestRequestGate/)
  assert.match(screenSrc, /tableRequestGate\.current\.begin\(\)/)
  assert.match(screenSrc, /tableRequestGate\.current\.isLatest\(requestId\)/)
  assert.match(screenSrc, /!aliveRef\.current\s*\|\|\s*!tableRequestGate\.current\.isLatest\(requestId\)/)
  assert.match(screenSrc, /tableQueryKeyRef\.current !== requestQueryKey/)
})

test('tabla M3 fija findings al run de latest y falla cerrada ante rechazos', () => {
  assert.match(screenSrc, /run_id:\s*payload\.run\.run_id/)
  assert.match(screenSrc, /invalid_request/)
  assert.match(screenSrc, /clearFilters/)
  assert.match(screenSrc, /Filtros rechazados por el backend/)
  assert.match(screenSrc, /result\.payload\.page !== page/)
  assert.match(screenSrc, /setPage\(result\.payload\.page\)/)
})

test('stale se recompone mientras la pantalla sigue montada y gobierna exports', () => {
  assert.match(screenSrc, /startM3StaleClock/)
  assert.match(screenSrc, /payload\?\.stale === true \|\| localStale/)
  assert.match(screenSrc, /effectivePayload/)
  assert.match(screenSrc, /evidenceJson\(effectivePayload,/)
  assert.match(screenSrc, /executiveSummaryText\(effectivePayload/)
  assert.match(screenSrc, /technical=\{run\.technical_state === 'PASS' && stale \? 'STALE' : run\.technical_state\}/)
  assert.match(screenSrc, /effectivePayload\.age_days/)
})

test('fixture demo se resuelve por alias de build y nunca se importa por ruta real', () => {
  assert.match(screenSrc, /from '#m3-demo-fixture'/)
  assert.doesNotMatch(screenSrc, /m3\/fixtures\/apiLatestFixture/)
})

test('el fixture del demo NO se declara corrida formal', () => {
  assert.equal(M3_API_LATEST_FIXTURE.run.is_production_shell_run, false)
  assert.equal(M3_API_LATEST_FIXTURE.run.evidence_classification,
    'pre_deployment_semantic_validation')
  assert.ok(M3_API_LATEST_FIXTURE.run.production_shell_run_blocked_by.length > 0)
})

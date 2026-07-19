// Drift del contrato compartido (P15): las copias locales del contrato canónico
// (backend GrupoVeniu/GrupoFrio#220) deben (1) mantener integridad sha256 contra
// CONTRACT_SOURCE.json, (2) los fixtures JS deben ser DEEP-EQUAL a los golden
// (independiente de EOL), y (3) los fixtures deben respetar los enums y
// requeridos del schema (mini-validador del mismo subset que usa el backend).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DAY_CONTROL_FIXTURE, DAY_CONTROL_FIXTURE_DEGRADED, RADAR_FIXTURE,
} from '../src/modules/supervisor-ventas/dayControl/fixtures.js'

const DIR = fileURLToPath(new URL('../src/modules/supervisor-ventas/dayControl/contracts/', import.meta.url))
const read = (name) => readFileSync(DIR + name)
const readJson = (name) => JSON.parse(read(name).toString('utf8'))

const SOURCE = readJson('CONTRACT_SOURCE.json')
const DC_SCHEMA = readJson('supervisor_day_control_v1.schema.json')
const RADAR_SCHEMA = readJson('supervisor_radar_v1.schema.json')
const DC_GOLDEN = readJson('day_control_v1.golden.json')
const RADAR_GOLDEN = readJson('radar_v1.golden.json')

// ── mini-validador (mismo subset que el backend: type/required/properties/items/enum)
const TYPE_CHECKS = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  boolean: (v) => typeof v === 'boolean',
  integer: (v) => Number.isInteger(v),
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  null: (v) => v === null,
}
function validate(instance, schema, path = '$', errors = []) {
  const stype = schema.type
  if (stype !== undefined) {
    const types = Array.isArray(stype) ? stype : [stype]
    if (!types.some((t) => (TYPE_CHECKS[t] || (() => false))(instance))) {
      errors.push(`${path}: tipo ${typeof instance} no coincide con ${types}`)
      return errors
    }
  }
  if (schema.enum && instance !== null && !schema.enum.includes(instance)) {
    errors.push(`${path}: ${JSON.stringify(instance)} fuera de enum`)
  }
  if (instance && typeof instance === 'object' && !Array.isArray(instance)) {
    for (const key of schema.required || []) {
      if (!(key in instance)) errors.push(`${path}: falta requerido '${key}'`)
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in instance) validate(instance[key], sub, `${path}.${key}`, errors)
    }
  }
  if (Array.isArray(instance) && schema.items) {
    instance.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, errors))
  }
  return errors
}

// ── integridad de las copias ─────────────────────────────────────────────────
test('sha256 de las copias del contrato coincide con CONTRACT_SOURCE.json', () => {
  for (const [name, expected] of Object.entries(SOURCE.sha256)) {
    const actual = createHash('sha256').update(read(name)).digest('hex')
    assert.equal(actual, expected, `hash drift en ${name} — regenerar copia + pin`)
  }
  assert.equal(SOURCE.contract_versions.day_control, 'gf.salesops.supervisor.day_control/1')
  assert.equal(SOURCE.contract_versions.radar, 'gf.salesops.supervisor.radar/1')
  assert.equal(SOURCE.source.pr, 220)
})

// ── paridad fixtures ↔ golden ────────────────────────────────────────────────
test('DAY_CONTROL_FIXTURE es deep-equal al golden canónico', () => {
  assert.deepEqual(DAY_CONTROL_FIXTURE, DC_GOLDEN)
})

test('RADAR_FIXTURE es deep-equal al golden canónico', () => {
  assert.deepEqual(RADAR_FIXTURE, RADAR_GOLDEN)
})

// ── conformidad con el schema ────────────────────────────────────────────────
test('golden day-control valida contra su schema (validador local)', () => {
  const errors = validate(DC_GOLDEN, DC_SCHEMA)
  assert.deepEqual(errors, [], errors.join('\n'))
})

test('golden radar valida contra su schema', () => {
  const errors = validate(RADAR_GOLDEN, RADAR_SCHEMA)
  assert.deepEqual(errors, [], errors.join('\n'))
})

test('fixture degradado (multi-moneda) también respeta el schema', () => {
  const errors = validate(DAY_CONTROL_FIXTURE_DEGRADED, DC_SCHEMA)
  assert.deepEqual(errors, [], errors.join('\n'))
})

test('el validador local MUERDE (mutación de enum falla)', () => {
  const mutated = structuredClone(DC_GOLDEN)
  mutated.routes[0].departure.status = 'tarde_inventada'
  assert.ok(validate(mutated, DC_SCHEMA).length > 0)
  const mutated2 = structuredClone(DC_GOLDEN)
  delete mutated2.summary.departure_unknown
  assert.ok(validate(mutated2, DC_SCHEMA).length > 0)
})

// ── enums del schema como autoridad para la presentación ─────────────────────
test('enums del schema cubren los estados que la presentación etiqueta', () => {
  const dep = DC_SCHEMA.properties.routes.items.properties.departure.properties.status.enum
  assert.deepEqual(dep.sort(), ['late', 'not_departed', 'on_time', 'unknown'].sort())
  const stages = DC_SCHEMA.properties.routes.items.properties.close.properties.stage.enum
  assert.equal(stages.length, 6) // 5 etapas + unknown
  const prio = DC_SCHEMA.properties.priorities.items.properties.type.enum
  assert.ok(!prio.includes('high_incident'))
  const loads = DC_SCHEMA.properties.routes.items.properties.loads
  const kinds = loads.properties.items.items.properties.load_kind.enum
  assert.deepEqual(kinds.sort(), ['initial', 'refill', 'manual', 'unknown'].sort())
  const statuses = loads.properties.items.items.properties.status.enum
  assert.deepEqual(statuses.sort(),
    ['prepared', 'pending_acceptance', 'accepted', 'cancelled', 'unknown'].sort())
})

test('P1/P3: timezone_source + prioridades con SOLO count (related_entity_ids eliminado)', () => {
  // timezone_source (P1-C)
  const tzEnum = DC_SCHEMA.properties.timezone_source.enum
  assert.deepEqual([...tzEnum].sort(), ['branch', 'company', 'system_fallback'])
  assert.ok(DC_SCHEMA.required.includes('timezone_source'))
  assert.ok(RADAR_SCHEMA.required.includes('timezone_source'))
  assert.ok(tzEnum.includes(DC_GOLDEN.timezone_source))
  assert.ok(tzEnum.includes(RADAR_GOLDEN.timezone_source))
  // count requerido; related_entity_ids ELIMINADO del contrato v1 (RED-2 P2)
  const prioItem = DC_SCHEMA.properties.priorities.items
  assert.ok(prioItem.required.includes('count'))
  assert.equal(prioItem.properties.count.minimum, 1)
  assert.ok(!prioItem.required.includes('related_entity_ids'))
  assert.ok(!('related_entity_ids' in prioItem.properties))
  for (const p of DC_GOLDEN.priorities) {
    assert.ok(Number.isInteger(p.count) && p.count >= 1, 'count entero >=1')
    assert.ok(!('related_entity_ids' in p), 'related_entity_ids no debe existir')
  }
  // ni en el JSON crudo de ningún artefacto
  for (const raw of [JSON.stringify(DC_GOLDEN), JSON.stringify(DAY_CONTROL_FIXTURE),
    JSON.stringify(DAY_CONTROL_FIXTURE_DEGRADED)]) {
    assert.ok(!raw.includes('related_entity_ids'))
  }
})

test('P1-B/P2: UNA prioridad load_pending_acceptance por ruta (dedup) con reason agregado', () => {
  const routesById = new Map(DC_GOLDEN.routes.map((r) => [r.plan_id, r]))
  const loadPrios = DC_GOLDEN.priorities.filter((p) => p.type === 'load_pending_acceptance')
  const routeIds = loadPrios.map((p) => p.route_id)
  assert.equal(routeIds.length, new Set(routeIds).size, 'prioridad de refill duplicada por ruta')
  for (const p of loadPrios) {
    const route = routesById.get(p.route_id)
    const pend = route.loads.items.filter(
      (l) => l.load_kind === 'refill' && l.status === 'pending_acceptance')
    const uniquePickings = new Set(pend.map((l) => l.picking_id))
    assert.equal(p.count, uniquePickings.size, 'count = picking_ids únicos pendientes')
    assert.equal(p.occurred_at, pend.map((l) => l.created_at).sort()[0], 'timestamp = más antiguo')
    const expected = p.count === 1
      ? `1 refill pendiente de aceptación del chofer en la ruta ${route.route_name}.`
      : `${p.count} refills pendientes de aceptación del chofer en la ruta ${route.route_name}.`
    assert.equal(p.reason, expected)
  }
})

test('van.* y vocabulario descartado NO reaparecen en contrato ni fixtures (P7 ban)', () => {
  const banned = DC_SCHEMA['x-banned-terms']
  assert.ok(banned.includes('van.refill.request') && banned.includes('van.unload.request'))
  const artifacts = [
    ['golden day', JSON.stringify(DC_GOLDEN)],
    ['golden radar', JSON.stringify(RADAR_GOLDEN)],
    ['fixture', JSON.stringify(DAY_CONTROL_FIXTURE)],
    ['fixture degraded', JSON.stringify(DAY_CONTROL_FIXTURE_DEGRADED)],
  ]
  for (const [name, raw] of artifacts) {
    for (const term of banned) {
      assert.ok(!raw.includes(term), `${name} contiene término descartado: ${term}`)
    }
  }
  // el schema solo menciona los nombres van.* dentro de x-banned-terms
  const schemaNoBanned = { ...DC_SCHEMA }
  delete schemaNoBanned['x-banned-terms']
  const raw = JSON.stringify(schemaNoBanned)
  for (const term of banned) assert.ok(!raw.includes(term), `schema contiene ${term}`)
})

// ── PII: los artefactos compartidos son SINTÉTICOS (validación ESTRUCTURAL) ───
// Estrategia P1-A/P3 (RED-2 Codex): NO se listan valores reales para excluirlos —
// versionar una lista de nombres/ids/códigos reales ES, en sí, versionar PII. Se
// AFIRMA POSITIVAMENTE que cada artefacto vive en el ESPACIO SINTÉTICO reservado.
// RED-2 P3 endurece: TODO campo id/*_id/*_ids se valida por banda o regla demo
// general; los nombres solo de una allowlist/patrones demo; correos/URLs solo con
// dominio reservado `.invalid` (cualquier TLD real reprueba, con o sin protocolo,
// mayúsculas y subdominios). Ninguna definición contiene un dato real: son la
// FRONTERA del universo demo, no su contenido.

// (A) IDS — bandas específicas que EXCLUYEN los ids reales; el resto por regla
// demo general documentada. Se incluyen explícitamente los ids que pidió Codex.
const SYNTHETIC_ID_BANDS = Object.freeze({
  company_id: [3000, 3099],
  employee_id: [1000, 1999],
  branch_config_id: [2000, 2099],
  analytic_account_id: [2100, 2199],
  warehouse_id: [4000, 4099],
  vehicle_id: [4100, 4199],
  plan_id: [5000, 5999],
  route_id: [5000, 5999],
  entity_id: [5000, 5999],
  stop_id: [6000, 6999],
  incident_type_id: [7000, 7999],
  picking_id: [9000, 9999],
  id: [4100, 4199], // 'id' pelón solo aparece bajo vehicle
})
const DEMO_ID_MAX = 100000 // regla demo GENERAL para claves id no mapeadas
// helper solicitado: isSyntheticId(key, value)
function isSyntheticId(key, value) {
  if (!Number.isInteger(value) || value <= 0) return false // bool ⇒ Number.isInteger false
  const band = SYNTHETIC_ID_BANDS[key]
  if (band) return value >= band[0] && value <= band[1]
  return value < DEMO_ID_MAX // regla general documentada
}
const isIdKey = (k) => /^id$|_id$/.test(k)
const isIdArrayKey = (k) => /(_ids|Ids)$/.test(k)

// (B) COORDENADAS — zona oceánica fija (Atlántico central), jamás operación real.
const SYNTHETIC_ZONE = Object.freeze({ lat: [10, 11], lon: [-36, -35] })
function isSyntheticCoordinate(lat, lon) {
  return typeof lat === 'number' && typeof lon === 'number'
    && lat > SYNTHETIC_ZONE.lat[0] && lat < SYNTHETIC_ZONE.lat[1]
    && lon > SYNTHETIC_ZONE.lon[0] && lon < SYNTHETIC_ZONE.lon[1]
}

// (C) MONEDA — solo códigos de PRUEBA ISO 4217 (XTS/XXX); cualquier real reprueba.
const SYNTHETIC_CURRENCIES = new Set(['XTS', 'XXX'])
const isSyntheticCurrency = (code) => code == null || SYNTHETIC_CURRENCIES.has(code)
const CURRENCY_CODE_KEYS = new Set(['currency', 'sales_day_currency', 'cash_pending_currency'])

// (D) FECHAS — día demo fijo (no es la fecha real actual); documentado.
const DEMO_DATE = '2026-01-15'
const isSyntheticDate = (s) => s == null || String(s).startsWith(DEMO_DATE)

// (E) NOMBRES DE IDENTIDAD — allowlist + patrones demo, todos ARTIFICIALES.
const IDENTITY_NAME_KEYS = new Set(['name', 'route_name'])
const DEMO_NAME_ALLOWLIST = new Set([
  'Supervisor Demo', 'Conductor Demo A', 'Conductor Demo B',
  'Ruta Demo Norte', 'Unidad Demo 01', 'Sucursal Demo',
])
const DEMO_NAME_PATTERNS = [
  /^BR-DEMO(?: [\wÁÉÍÓÚÑáéíóúñ]+)*$/, // sucursal: "BR-DEMO Sucursal Demo"
  /^ROUTE-DEMO-\w+$/, /^VEH-DEMO-\w+$/, // códigos demo documentados
  /^Chofer Demo \w+$/, /^Conductor Demo [A-Z]$/,
  /^Cliente Demo \w+$/, /^Ruta Demo \w+$/,
  /^Unidad Demo (?:[A-Z]|\d{2})$/, /^Marcador Demo \w+$/,
]
function isDemoIdentityString(s) {
  if (typeof s !== 'string') return false
  if (DEMO_NAME_ALLOWLIST.has(s)) return true
  return DEMO_NAME_PATTERNS.some((re) => re.test(s))
}

// (F) CORREOS/URLS/DOMINIOS — solo dominios reservados `.invalid` (RFC 6761).
// Cualquier TLD real reprueba, con o sin protocolo, insensible a mayúsculas y
// detectando subdominios. Los nombres punteados de Odoo (sale.order, gf.route.…)
// NO terminan en un TLD real ⇒ no colisionan.
const RESERVED_TLD_RE = /\.invalid$/i
const REAL_TLDS = ['com', 'mx', 'net', 'org', 'io', 'co', 'gov', 'edu', 'info',
  'biz', 'us', 'es', 'dev', 'app', 'xyz', 'online', 'site', 'store', 'tv', 'ai', 'cloud']
const REAL_DOMAIN_RE = new RegExp(
  String.raw`\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:${REAL_TLDS.join('|')})\b`, 'i')
const URL_HOST_RE = /\bhttps?:\/\/([^\s/]+)/i
const EMAIL_DOMAIN_RE = /[\w.+-]+@([a-z0-9.-]+\.[a-z]{2,})/i
function contactLeak(s) {
  const url = URL_HOST_RE.exec(s)
  if (url && !RESERVED_TLD_RE.test(url[1])) return `URL con host real: ${url[1]}`
  const email = EMAIL_DOMAIN_RE.exec(s)
  if (email && !RESERVED_TLD_RE.test(email[1])) return `email con dominio real: ${email[1]}`
  const dom = REAL_DOMAIN_RE.exec(s)
  if (dom) return `dominio con TLD real: ${dom[0]}`
  return null
}

// helper solicitado: isDemoBranch(branch) — marca demo + ids en banda.
function isDemoBranch(branch) {
  return !!branch && isDemoIdentityString(branch.name)
    && isSyntheticId('branch_config_id', branch.branch_config_id)
    && isSyntheticId('analytic_account_id', branch.analytic_account_id)
    && isSyntheticId('warehouse_id', branch.warehouse_id)
}

// Recorre el artefacto afirmando que TODO lo identificable es sintético.
function auditSynthetic(node, path, errs) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => auditSynthetic(v, `${path}[${i}]`, errs))
    return
  }
  if (node && typeof node === 'object') {
    if ('latitude' in node && 'longitude' in node) {
      const { latitude: la, longitude: lo } = node
      if (la != null && lo != null && !isSyntheticCoordinate(la, lo)) {
        errs.push(`${path}: coordenada fuera de la zona sintética (${la}, ${lo})`)
      }
    }
    for (const [k, v] of Object.entries(node)) {
      const p = `${path}.${k}`
      if (isIdArrayKey(k) && Array.isArray(v)) {
        v.forEach((id, i) => {
          if (!isSyntheticId(k, id)) errs.push(`${p}[${i}]: id ${id} fuera de banda demo`)
        })
      } else if (isIdKey(k) && typeof v === 'number') {
        if (!isSyntheticId(k, v)) errs.push(`${p}: id ${v} fuera de banda demo`)
      } else if (CURRENCY_CODE_KEYS.has(k) && (typeof v === 'string' || v === null)) {
        if (!isSyntheticCurrency(v)) errs.push(`${p}: moneda no sintética '${v}'`)
      } else if (IDENTITY_NAME_KEYS.has(k) && typeof v === 'string') {
        if (!isDemoIdentityString(v)) errs.push(`${p}: nombre no sintético '${v}'`)
        const leak = contactLeak(v)
        if (leak) errs.push(`${p}: ${leak}`)
      } else {
        auditSynthetic(v, p, errs)
      }
    }
    return
  }
  if (typeof node === 'string') {
    const leak = contactLeak(node)
    if (leak) errs.push(`${path}: ${leak}`)
    if (/^\d{4}-\d{2}-\d{2}/.test(node) && !isSyntheticDate(node)) errs.push(`${path}: fecha no demo '${node}'`)
  }
}

// helper solicitado: isSyntheticFixture(fixture) — todo sintético + branch demo.
function syntheticFixtureErrors(fixture) {
  const errs = []
  auditSynthetic(fixture, '$', errs)
  if (fixture && fixture.branch && !isDemoBranch(fixture.branch)) {
    errs.push('$.branch: no es una sucursal de demo reconocible')
  }
  return errs
}
const isSyntheticFixture = (fixture) => syntheticFixtureErrors(fixture).length === 0

test('artefactos 100% sintéticos por estructura (ids/coords/moneda/fechas/nombres/dominios)', () => {
  for (const [name, art] of [
    ['golden day', DC_GOLDEN], ['golden radar', RADAR_GOLDEN],
    ['fixture', DAY_CONTROL_FIXTURE], ['fixture degraded', DAY_CONTROL_FIXTURE_DEGRADED],
    ['radar fixture', RADAR_FIXTURE],
  ]) {
    assert.deepEqual(syntheticFixtureErrors(art), [], `${name}: ${syntheticFixtureErrors(art).join('\n')}`)
    assert.ok(isSyntheticFixture(art), `${name} debe ser sintético`)
  }
  assert.ok(isDemoBranch(DC_GOLDEN.branch))
})

test('los validadores sintéticos MUERDEN — datos ARTIFICIALES fuera de banda fallan', () => {
  // NOTA P1-A/P3: las mutaciones usan valores OBVIAMENTE FALSOS y fuera de banda —
  // NUNCA un id/coord/moneda/dominio real de la operación (eso re-versionaría PII).
  const bites = []
  const mut = (fn) => { const c = structuredClone(DC_GOLDEN); fn(c); return syntheticFixtureErrors(c) }

  // id de un campo genérico id/*_id fuera de banda (empleado)
  bites.push(mut((c) => { c.routes[0].driver.employee_id = 424242 }))
  // company_id (Codex lo pidió explícito): fuera de la banda demo [3000,3099]
  bites.push(mut((c) => { c.routes[0].driver.company_id = 88888 }))
  // coordenada fuera de la zona sintética (otro continente, artificial)
  assert.ok(!isSyntheticCoordinate(51.5, -0.12))
  bites.push(mut((c) => { c.routes[0].position.latitude = 51.5; c.routes[0].position.longitude = -0.12 }))
  // moneda real (≠ XTS/XXX)
  assert.ok(!isSyntheticCurrency('EUR'))
  bites.push(mut((c) => { c.summary.sales_day_currency = 'EUR' }))
  // nombre arbitrario (no demo)
  bites.push(mut((c) => { c.routes[0].driver.name = 'Persona Cualquiera' }))
  // email con dominio real (artificial, TLD real)
  bites.push(mut((c) => { c.routes[0].driver.name = 'buzon@casillero-ficticio.com' }))
  // dominio SIN protocolo, en MAYÚSCULAS y con SUBDOMINIO (artificial, TLD real)
  bites.push(mut((c) => { c.data_notes.leak_probe = 'visita SUB.EMPRESA-FICTICIA.MX ya' }))
  // URL con host real (artificial)
  bites.push(mut((c) => { c.data_notes.leak_probe = 'ver https://portal-ficticio.net/x' }))
  // fecha fuera del día demo (genérica)
  bites.push(mut((c) => { c.routes[0].data_as_of.generated_at = '1999-12-31 10:00:00' }))

  bites.forEach((errs, i) => assert.ok(errs.length > 0, `mutación #${i} debió MORDER`))
})

test('dominios reservados .invalid SÍ pasan; nombres punteados de Odoo no son dominios', () => {
  // .invalid es el único dominio permitido para pruebas (RFC 6761)
  assert.equal(contactLeak('correo@ejemplo.invalid'), null)
  assert.equal(contactLeak('https://host.invalid/x'), null)
  assert.equal(contactLeak('ver ejemplo.invalid'), null)
  // nombres de modelo/campo de Odoo NO terminan en TLD real ⇒ no son dominios
  for (const s of ['sale.order', 'gf.route.plan', 'ir.config_parameter',
    'gf.tower.m1.route.backlog.cash', 'America/Mexico_City', 'v_gf_tower_m1_route_backlog_cash']) {
    assert.equal(contactLeak(s), null, `${s} no debe marcarse como dominio`)
  }
  // pero un dominio real (artificial) con TLD real SÍ se detecta
  assert.ok(contactLeak('empresa-ficticia.com'))
  assert.ok(contactLeak('MAIL.EMPRESA-FICTICIA.MX')) // mayúsculas + subdominio
})

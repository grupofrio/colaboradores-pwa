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
// YELLOW-3 F2: validación ESTRICTA de format:date-time (subconjunto contractual).
// No usa Date.parse permisivo: valida estructura ISO + componentes civiles + offset
// válido + timezone PRESENTE (Z u offset). Rechaza naive (espacio o sin tz).
function isValidContractDateTime(s) {
  if (typeof s !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(s)
  if (!m) return false // exige 'T', segundos y TZ; rechaza espacio/naive/parcial
  const y = +m[1], mo = +m[2], d = +m[3], hh = +m[4], mm = +m[5], ss = +m[6], tz = m[8]
  if (mo < 1 || mo > 12) return false
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (d < 1 || d > dim[mo - 1]) return false
  if (hh > 23 || mm > 59 || ss > 59) return false
  if (tz !== 'Z') { // offset válido: ±00:00..±14:00
    const oh = +tz.slice(1, 3), om = +tz.slice(4, 6)
    if (oh > 14 || om > 59) return false
  }
  return true
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
  if (schema.format === 'date-time' && instance !== null && !isValidContractDateTime(instance)) {
    errors.push(`${path}: '${instance}' no es date-time UTC/ISO válido (naive/parcial/imposible)`)
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

test('F2: validador format:date-time acepta ISO UTC/offset y rechaza naive/parcial', () => {
  for (const ok of ['2026-01-15T12:30:00Z', '2026-01-15T06:30:00-06:00',
    '2026-01-15T12:30:00+00:00', '2026-01-15T12:30:00.5Z']) {
    assert.ok(isValidContractDateTime(ok), `${ok} debe ser válido`)
  }
  for (const bad of ['2026-01-15 12:30:00', '2026-01-15T12:30:00', '2026-13-01T00:00:00Z',
    '2026-02-29T00:00:00Z', '2026-01-15T25:00:00Z', '2026-01-15T12:30:00+99:99',
    'texto', '  ', '', '2026-01-15', null, 42]) {
    assert.ok(!isValidContractDateTime(bad), `${bad} debe rechazarse`)
  }
})

test('F2: el validador MUERDE un occurred_at naive en el fixture degradado', () => {
  // el schema declara occurred_at con format:date-time ⇒ un naive DEBE fallar
  const gpsPrio = DC_SCHEMA.properties.priorities.items.properties.occurred_at
  assert.equal(gpsPrio.format, 'date-time')
  const mutated = structuredClone(DAY_CONTROL_FIXTURE_DEGRADED)
  const withTs = mutated.priorities.find((p) => p.occurred_at !== null)
  assert.ok(withTs, 'debe haber al menos una prioridad con occurred_at no-null')
  withTs.occurred_at = '2026-01-15 14:40:00' // naive (regresión)
  assert.ok(validate(mutated, DC_SCHEMA).length > 0, 'el validador debe morder el naive')
  // y el fixture REAL (canónico) pasa
  assert.deepEqual(validate(DAY_CONTROL_FIXTURE_DEGRADED, DC_SCHEMA), [])
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

// Normaliza cualquier timestamp (naive Odoo=UTC, Z, offset) al instante UTC en ms.
// Cómputo INDEPENDIENTE del backend (usa getUTC*, sin tz del SO) — no copia la impl.
function instantMs(ts) {
  const iso = /[T ]/.test(ts) ? ts.replace(' ', 'T') : ts
  const withTz = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z' // naive ⇒ UTC
  const ms = Date.parse(withTz)
  return Number.isFinite(ms) ? ms : null
}
const CANONICAL_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
function toCanonical(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`
}

test('P1-B/P2: dedup por ruta + occurred_at = mínimo por INSTANTE en UTC canónico', () => {
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
    // occurred_at = mínimo por INSTANTE (no por string), en forma canónica
    const oldestMs = Math.min(...pend.map((l) => instantMs(l.created_at)).filter((x) => x !== null))
    assert.match(p.occurred_at, CANONICAL_TS_RE, 'occurred_at canónico YYYY-MM-DDTHH:MM:SSZ')
    assert.equal(p.occurred_at, toCanonical(oldestMs), 'occurred_at = instante más antiguo normalizado')
    const expected = p.count === 1
      ? `1 refill pendiente de aceptación del chofer en la ruta ${route.route_name}.`
      : `${p.count} refills pendientes de aceptación del chofer en la ruta ${route.route_name}.`
    assert.equal(p.reason, expected)
  }
  // toda prioridad: occurred_at es canónico o null
  for (const p of DC_GOLDEN.priorities) {
    if (p.occurred_at !== null) assert.match(p.occurred_at, CANONICAL_TS_RE)
  }
})

test('P3-C: el head canónico del mirror doc == CONTRACT_SOURCE.source.head (no divergen)', () => {
  const MIRROR = fileURLToPath(new URL('../docs/supervisor/SUPERVISOR_DAY_CONTROL_CONTRACT_MIRROR.md', import.meta.url))
  const doc = readFileSync(MIRROR, 'utf8')
  const m = /Ancla canónica \(head backend actual\):\*\*\s*`([0-9a-f]{7,40})`/.exec(doc)
  assert.ok(m, 'el mirror debe declarar el head backend canónico actual')
  assert.equal(m[1], SOURCE.source.head, 'head del mirror diverge de CONTRACT_SOURCE.source.head')
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
// YELLOW-3 F3: NAMESPACE demo alto RESERVADO. "Los IDs demo pertenecen a un
// namespace alto reservado y NO representan IDs Odoo." Las claves conocidas usan
// bandas específicas (espejo de los ids sintéticos del backend GREEN #220); CUALQUIER
// clave id SIN regla específica DEBE caer en [DEMO_ID_MIN, DEMO_ID_MAX]. Se elimina la
// vieja banda [1,99999] (permitía ids productivos bajos). No se derivan rangos de prod.
const DEMO_ID_MIN = 900000
const DEMO_ID_MAX = 999999
// helper solicitado: isSyntheticId(key, value). Escalar DEBE ser number, integer,
// positivo, NO bool (Number.isInteger(true)===false), dentro de banda específica o del
// namespace alto. Rechaza 1/42/99999/"1001"/true/1.5/0/-1/null/obj/array.
function isSyntheticId(key, value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return false
  const band = SYNTHETIC_ID_BANDS[key]
  if (band) return value >= band[0] && value <= band[1]
  return value >= DEMO_ID_MIN && value <= DEMO_ID_MAX // namespace alto reservado
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

// (F) CORREOS/URLS/DOMINIOS (YELLOW-3 F3) — SIN lista de TLD y SIN excepción por
// raíz/prefijo (que permitía evadir con `sale.`/`route.`/`gf.`). Regla POSITIVA: el
// único hostname permitido es `.invalid` (RFC 6761). Se detecta cualquier forma de
// hostname/dominio/URL/email con/sin protocolo, TLD desconocido, mayúsculas,
// subdominios, puerto, path, en texto. La ÚNICA excepción para un nombre de MODELO
// Odoo es CONTEXTUAL: solo si la CLAVE del campo es de modelo (model/model_name/
// res_model/odoo_model/technical_model) y el valor cumple la gramática estricta.
const RESERVED_TLD_RE = /\.invalid$/i
const ODOO_MODEL_GRAMMAR = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/
const MODEL_KEYS = new Set(['model', 'model_name', 'res_model', 'odoo_model', 'technical_model'])
// Prosa técnica documental (data_notes/reason/contract/note/description/title): sus
// valores contienen nombres de modelo punteados por DISEÑO ⇒ NO se escanea hostname
// suelto, pero SÍ email/URL (un leak real sigue mordiendo). Identificado por CLAVE.
const PROSE_PATH_RE = /(^|\.)data_notes(\.|$)|\.reason$|\.contract$|\.note$|\.description$|\.title$/
const hostBare = (h) => h.replace(/:\d+.*$/, '').replace(/\/.*$/, '')
const URL_RE = /\bhttps?:\/\/([^\s/:]+(?::\d+)?)/gi
const EMAIL_RE = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z][a-z0-9-]*)/gi
const HOST_RE = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*(?::\d+)?(?:\/[^\s]*)?/gi
// email/URL leaks SOLO (para prosa técnica): dominio real en email/URL sigue mordiendo.
function emailUrlLeak(s) {
  for (const m of s.matchAll(URL_RE)) {
    if (!RESERVED_TLD_RE.test(hostBare(m[1]))) return `URL con host no-.invalid: ${m[1]}`
  }
  for (const m of s.matchAll(EMAIL_RE)) {
    if (!RESERVED_TLD_RE.test(m[1])) return `email con dominio no-.invalid: ${m[1]}`
  }
  return null
}
// detección ESTRICTA: email/URL + hostname suelto; solo `.invalid` pasa. Sin excepción
// por root — la excepción de modelo Odoo es contextual (la aplica el walker por CLAVE).
function contactLeak(s) {
  const eu = emailUrlLeak(s)
  if (eu) return eu
  for (const m of s.matchAll(HOST_RE)) {
    const before = s[m.index - 1], after = s[m.index + m[0].length]
    if (before === '_' || after === '_') continue // fragmento snake_case (DNS no lleva '_')
    const bare = hostBare(m[0])
    if (RESERVED_TLD_RE.test(bare)) continue // .invalid es el único permitido
    return `hostname no-.invalid: ${bare}`
  }
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
      if (isIdArrayKey(k)) {
        // RED-2 P3-A: *_ids/*Ids DEBE ser array homogéneo de ids sintéticos —
        // sin strings/floats/null/negativos/bools/mixtos, y no un no-array.
        if (!Array.isArray(v) || !v.every((id) => isSyntheticId(k, id))) {
          errs.push(`${p}: se esperaba array homogéneo de ids sintéticos, hay ${JSON.stringify(v)}`)
        }
      } else if (isIdKey(k)) {
        // valida SIEMPRE (cualquier tipo): un id de tipo no-numérico/float/bool falla
        if (!isSyntheticId(k, v)) errs.push(`${p}: id no sintético ${JSON.stringify(v)}`)
      } else if (CURRENCY_CODE_KEYS.has(k) && (typeof v === 'string' || v === null)) {
        if (!isSyntheticCurrency(v)) errs.push(`${p}: moneda no sintética '${v}'`)
      } else if (MODEL_KEYS.has(k) && typeof v === 'string') {
        // F3: SOLO en campos de modelo el valor punteado se acepta como modelo Odoo
        if (!ODOO_MODEL_GRAMMAR.test(v)) errs.push(`${p}: valor de modelo Odoo inválido '${v}'`)
      } else if (IDENTITY_NAME_KEYS.has(k) && typeof v === 'string') {
        if (!isDemoIdentityString(v)) errs.push(`${p}: nombre no sintético '${v}'`)
        const leak = contactLeak(v) // identidad: escaneo ESTRICTO (hostname incluido)
        if (leak) errs.push(`${p}: ${leak}`)
      } else {
        auditSynthetic(v, p, errs)
      }
    }
    return
  }
  if (typeof node === 'string') {
    // prosa técnica documental ⇒ solo email/URL; cualquier otro campo ⇒ estricto
    const leak = PROSE_PATH_RE.test(path) ? emailUrlLeak(node) : contactLeak(node)
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
  // RED-2 P3-A: id de TIPO no numérico / float / bool / cero / negativo / null
  bites.push(mut((c) => { c.routes[0].driver.employee_id = '1001' }))     // string
  bites.push(mut((c) => { c.routes[0].driver.employee_id = true }))       // bool
  bites.push(mut((c) => { c.routes[0].driver.employee_id = 1.5 }))        // float
  bites.push(mut((c) => { c.routes[0].driver.employee_id = 0 }))          // cero
  bites.push(mut((c) => { c.routes[0].driver.employee_id = -1 }))         // negativo
  bites.push(mut((c) => { c.routes[0].driver.employee_id = null }))       // null
  // campos id DESCONOCIDOS (namespace alto): escalar inválido y array no homogéneo
  bites.push(mut((c) => { c.routes[0].mystery_id = '5' }))                // desconocido string
  bites.push(mut((c) => { c.routes[0].custom_entity_id = true }))         // desconocido bool
  bites.push(mut((c) => { c.routes[0].arbitrary_ids = [900001, '2', 3] })) // array mixto
  bites.push(mut((c) => { c.routes[0].arbitrary_ids = 'no-array' }))      // *_ids no-array
  bites.push(mut((c) => { c.routes[0].stops.nested_unknown_id = -7 }))    // anidado negativo
  // YELLOW-3 F3: valores BAJOS (productivos plausibles) bajo clave desconocida ⇒ FUERA
  // del namespace alto reservado [900000,999999] ⇒ rechazados (1/42/99999)
  bites.push(mut((c) => { c.routes[0].mystery_id = 1 }))
  bites.push(mut((c) => { c.routes[0].mystery_id = 42 }))
  bites.push(mut((c) => { c.routes[0].mystery_id = 99999 }))
  // coordenada fuera de la zona sintética (otro continente, artificial)
  assert.ok(!isSyntheticCoordinate(51.5, -0.12))
  bites.push(mut((c) => { c.routes[0].position.latitude = 51.5; c.routes[0].position.longitude = -0.12 }))
  // moneda real (≠ XTS/XXX)
  assert.ok(!isSyntheticCurrency('EUR'))
  bites.push(mut((c) => { c.summary.sales_day_currency = 'EUR' }))
  // nombre arbitrario (no demo)
  bites.push(mut((c) => { c.routes[0].driver.name = 'Persona Cualquiera' }))
  // F3 hostnames en campos NO-modelo/NO-prosa: SIN protocolo / TLD desconocido /
  // mayúsculas / subdominio / puerto / path / email — ninguno .invalid ⇒ fallan
  bites.push(mut((c) => { c.routes[0].url = 'sale.example' }))
  bites.push(mut((c) => { c.routes[0].host = 'stock.examplecustom' }))
  bites.push(mut((c) => { c.routes[0].text = 'route.synthetic' }))
  bites.push(mut((c) => { c.routes[0].contact_email = 'user@sale.synthetic' }))
  bites.push(mut((c) => { c.routes[0].url = 'HTTPS://HOST.SYNTHETIC/path' }))
  bites.push(mut((c) => { c.routes[0].host = 'host.synthetic:8080' }))
  // fecha fuera del día demo (genérica)
  bites.push(mut((c) => { c.routes[0].data_as_of.generated_at = '1999-12-31 10:00:00' }))

  bites.forEach((errs, i) => assert.ok(errs.length > 0, `mutación #${i} debió MORDER`))
})

test('F3: campo id desconocido con valor del NAMESPACE ALTO reservado pasa', () => {
  const c = structuredClone(DC_GOLDEN)
  c.routes[0].mystery_id = 900042           // en [900000,999999]
  c.routes[0].custom_entity_id = 999999     // tope del namespace
  c.routes[0].arbitrary_ids = [900010, 900020, 900030]  // array homogéneo en namespace
  assert.deepEqual(syntheticFixtureErrors(c), [])
})

test('F3: modelo Odoo permitido SOLO por clave de modelo; en otros campos = hostname', () => {
  // A) campos de MODELO: valor con gramática Odoo ⇒ permitido
  for (const [key, val] of [['res_model', 'sale.order'], ['model_name', 'gf.route.plan'],
    ['model', 'stock.picking'], ['odoo_model', 'hr.employee']]) {
    const c = structuredClone(DC_GOLDEN); c.routes[0][key] = val
    assert.deepEqual(syntheticFixtureErrors(c), [], `${key}=${val} debe permitirse`)
  }
  // B) el MISMO valor en un campo NO-modelo/NO-prosa ⇒ analizado como hostname y rechazado
  for (const [key, val] of [['url', 'sale.example'], ['host', 'stock.examplecustom'],
    ['text', 'route.synthetic'], ['gateway', 'gf.example']]) {
    const c = structuredClone(DC_GOLDEN); c.routes[0][key] = val
    assert.ok(syntheticFixtureErrors(c).length > 0, `${key}=${val} debe rechazarse`)
  }
  // C) prosa técnica (note/data_notes): un nombre punteado de modelo = string ordinario
  const cNote = structuredClone(DC_GOLDEN); cNote.routes[0].note = 'sale.order'
  assert.deepEqual(syntheticFixtureErrors(cNote), [], 'note=sale.order ⇒ ordinario (prosa)')
  const cDn = structuredClone(DC_GOLDEN); cDn.data_notes.extra = 'usa gf.route.plan y stock.picking'
  assert.deepEqual(syntheticFixtureErrors(cDn), [], 'data_notes con modelos = prosa ordinaria')
  // …pero un email/URL real en prosa SIGUE mordiendo
  const cLeak = structuredClone(DC_GOLDEN); cLeak.data_notes.extra = 'reporta a x@empresa-ficticia.com'
  assert.ok(syntheticFixtureErrors(cLeak).length > 0, 'email real en prosa debe morder')
})

test('F3: contactLeak estricto — .invalid pasa; cualquier otro hostname (incl. modelo) muerde', () => {
  for (const ok of ['demo.invalid', 'sub.demo.invalid', 'user@demo.invalid',
    'https://demo.invalid/path', 'ver demo.invalid ahora']) {
    assert.equal(contactLeak(ok), null, `${ok} debe permitirse`)
  }
  // SIN excepción por root: sale./stock./route./gf. ya no evaden el detector estricto
  for (const bad of ['sale.example', 'stock.examplecustom', 'route.synthetic', 'gf.example',
    'demo.synthetic', 'host.unknownsuffix', 'sub.host.examplecustom',
    'HTTPS://HOST.SYNTHETIC/path', 'user@host.synthetic', 'host.synthetic:8080']) {
    assert.ok(contactLeak(bad), `${bad} debe morder en contexto estricto`)
  }
  // en PROSA (email/URL only) un modelo punteado NO muerde, pero email/URL real sí
  assert.equal(emailUrlLeak('sale.order y gf.route.plan'), null)
  assert.ok(emailUrlLeak('http://portal-ficticio.net/x'))
  assert.ok(emailUrlLeak('x@empresa-ficticia.mx'))
})

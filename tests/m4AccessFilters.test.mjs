// KOLD OS · M4 — matriz de acceso (fail-closed) + filtros + exporters seguros.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  readM4Access, scopeFindingsForAccess, M4_ALLOWED_JOB_KEYS, M4_ALLOWED_TOWER_STATUS,
} from '../src/modules/ventas/m4/access.js'
import { isM4DemoAllowed } from '../src/modules/ventas/m4/demoGate.js'
import { applyFindingFilters, paginate, M4_DEFAULT_FILTERS } from '../src/modules/ventas/m4/filters.js'
import {
  findingsToCsv, neutralizeCsvCell, csvCell, sanitizeForExport, exportFilename,
  evidenceJson, executiveSummaryText, recurrenceText, handoffM4M2Text, M4_CSV_COLUMNS,
} from '../src/modules/ventas/m4/exporters.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const FINDINGS = M4_API_LATEST_FIXTURE.findings

// ── Matriz de acceso v1 (Fase permisos: fail-closed) ─────────────────────────
test('contrato v1: direccion_general y su proyección admin_plataforma', () => {
  assert.deepEqual([...M4_ALLOWED_JOB_KEYS], ['direccion_general'])
  assert.deepEqual([...M4_ALLOWED_TOWER_STATUS], ['admin_plataforma'])
})

test('direccion_general: GLOBAL (primario y vía additional_job_keys)', () => {
  assert.deepEqual(readM4Access(s('direccion_general')),
    { level: 'global', reason: 'job_key_direccion_general' })
  assert.equal(readM4Access(s('gerente_sucursal', { additional_job_keys: ['direccion_general'] })).level, 'global')
})

test('admin_plataforma (tower_status): GLOBAL — proyeccion aceptada por el backend', () => {
  assert.deepEqual(readM4Access(tower('admin_plataforma')),
    { level: 'global', reason: 'tower_admin_plataforma' })
})

test('NO acceso v1: gerente/supervisor/vendedor/chofer/jefe_ruta (fail-closed)', () => {
  for (const sess of [s('gerente_sucursal'), s('supervisor_ventas'), s('vendedor'),
    s('chofer'), s('jefe_ruta'), tower('supervisor_ventas')]) {
    assert.equal(readM4Access(sess).level, 'none')
  }
})

test('sesión inválida => none aunque el payload traiga rol privilegiado', () => {
  for (const bad of [null, {}, { role: 'direccion_general' },
    { employee_id: 100, role: 'direccion_general' }]) {
    assert.equal(readM4Access(bad).level, 'none')
    assert.equal(readM4Access(bad).reason, 'invalid_session')
  }
})

test('tower_status con case distinto o ajeno NO abre M4 (strict)', () => {
  assert.equal(readM4Access(tower('Admin_Plataforma')).level, 'none')
  assert.equal(readM4Access(tower('otro_rol')).level, 'none')
})

test('scope: none => cero hallazgos; global => todos', () => {
  assert.deepEqual(scopeFindingsForAccess(FINDINGS, { level: 'none' }), [])
  assert.equal(scopeFindingsForAccess(FINDINGS, { level: 'global' }).length, FINDINGS.length)
})

// ── Demo gate ────────────────────────────────────────────────────────────────
test('demo gate: DEV sí · Preview con VITE_ENABLE_M4_DEMO sí · producción NO', () => {
  assert.equal(isM4DemoAllowed({ DEV: true }), true)
  assert.equal(isM4DemoAllowed({ DEV: false, VITE_ENABLE_M4_DEMO: 'true' }), true)
  assert.equal(isM4DemoAllowed({ DEV: false }), false)
  assert.equal(isM4DemoAllowed({ DEV: false, VITE_ENABLE_M4_DEMO: 'false' }), false)
  assert.equal(isM4DemoAllowed(null), false)
})

// ── Filtros + paginación (demo local; en real es server-side) ────────────────
test('filtros: verdict/classification/category filtran; desconocidos no', () => {
  const porVerdicto = applyFindingFilters(FINDINGS, { ...M4_DEFAULT_FILTERS, verdict: 'riesgo' })
  assert.ok(porVerdicto.length > 0)
  assert.ok(porVerdicto.every((f) => f.verdict === 'riesgo'))
  const porClasificacion = applyFindingFilters(FINDINGS, { ...M4_DEFAULT_FILTERS, classification: 'exploratory' })
  assert.ok(porClasificacion.every((f) => f.classification === 'exploratory'))
  const porCategoria = applyFindingFilters(FINDINGS, { ...M4_DEFAULT_FILTERS, category: 'recurrencia' })
  assert.ok(porCategoria.every((f) => f.category === 'recurrencia'))
})

// El caso que Codex pidió confirmar: con CERO incumplimientos, pedir "solo
// incumplimientos" tiene que dar tabla vacía. Devolver la lista completa (o
// colar anomalías) sería la mentira silenciosa que motivó todo este arreglo.
test('cero incumplimientos: filtrar por incumplimiento deja la tabla vacía', () => {
  assert.equal(FINDINGS.filter((f) => f.verdict === 'incumplimiento').length, 0,
    'la evidencia v1 no prueba ningún incumplimiento')
  const out = applyFindingFilters(FINDINGS, { ...M4_DEFAULT_FILTERS, verdict: 'incumplimiento' })
  assert.deepEqual(out, [], 'no puede colarse ni un hallazgo')
  const page = paginate(out, 1, 10)
  assert.equal(page.total, 0, 'el total filtrado corresponde a las filas filtradas')
  assert.deepEqual(page.items, [])
  assert.ok(FINDINGS.length > 0, 'y sin filtro sí hay hallazgos: el filtro recorta de verdad')
})

// El total filtrado debe ser el de las filas filtradas, no el global.
test('el total filtrado corresponde a las filas filtradas', () => {
  for (const verdict of ['riesgo', 'anomalia']) {
    const rows = applyFindingFilters(FINDINGS, { ...M4_DEFAULT_FILTERS, verdict })
    const page = paginate(rows, 1, 10)
    assert.equal(page.total, rows.length)
    assert.ok(page.total < FINDINGS.length, `${verdict} debe ser un subconjunto`)
    assert.ok(rows.every((f) => f.verdict === verdict))
  }
})

// El export tiene que coincidir con la pantalla y con la API: si el CSV dice
// una cosa y la UI otra, el que abre el CSV se lleva la versión equivocada.
test('export CSV: M4-F-01 y M4-A-04 coinciden con la API, con su universo', async () => {
  const { findingsToCsv, M4_CSV_COLUMNS } = await import('../src/modules/ventas/m4/exporters.js')
  assert.ok(M4_CSV_COLUMNS.includes('universe_id'), 'el CSV debe llevar el universo canónico')
  assert.ok(!M4_CSV_COLUMNS.includes('company_id'), 'dimensión inexistente en v1')
  assert.ok(!M4_CSV_COLUMNS.includes('branch_id'), 'dimensión inexistente en v1')

  // Parser RFC-4180 mínimo: partir por comas rompe, porque los campos citados
  // llevan comas dentro (los universos son frases largas).
  const parseCsv = (text) => {
    const rows = []
    let row = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i]
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 1 } else { quoted = false }
        } else cell += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') { row.push(cell); cell = '' }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else if (ch !== '\r') cell += ch
    }
    if (cell || row.length) { row.push(cell); rows.push(row) }
    return rows
  }

  const csv = findingsToCsv(FINDINGS)
  const rows = parseCsv(csv)
  const header = rows[0]
  const iCode = header.indexOf('rule_code')
  const iNum = header.indexOf('numerator')
  const iDen = header.indexOf('denominator')
  const iUid = header.indexOf('universe_id')
  assert.ok(iCode >= 0 && iNum >= 0 && iDen >= 0 && iUid >= 0, 'faltan columnas en el CSV')

  const row = (code) => rows.slice(1).find((cells) => cells[iCode] === code)

  const f01 = row('M4-F-01')
  assert.ok(f01, 'M4-F-01 debe estar en el export')
  assert.equal(f01[iNum], '78')
  assert.equal(f01[iDen], '584')
  assert.equal(f01[iUid], 'active_commercial_customer_roots_in_scope')

  const a04 = row('M4-A-04')
  assert.ok(a04, 'M4-A-04 debe estar en el export')
  assert.equal(a04[iNum], '168')
  assert.equal(a04[iDen], '752', 'el export no puede dividir archivados entre activos')
  assert.equal(a04[iUid], 'commercial_customer_roots_in_scope')

  // Y cero cifras del universo viejo en el archivo entero.
  for (const figure of ['1,620', '1620', '2,333', '2333']) {
    assert.ok(!csv.includes(figure), `${figure} viaja en el export`)
  }
})

// Ningún hallazgo puede portar una dimensión que las capabilities niegan.
test('los findings no portan dimensiones fantasma (company/branch/route)', () => {
  for (const f of FINDINGS) {
    for (const banned of ['company_id', 'branch_id', 'branch_code', 'route_id', 'plan_id', 'stop_id']) {
      assert.ok(!(banned in f), `${banned} no existe en el contrato v1`)
    }
    assert.equal(f.granularity, 'aggregate')
  }
})

test('paginación defensiva: clamps y total', () => {
  const page = paginate(FINDINGS, 99, 5)
  assert.equal(page.total, FINDINGS.length)
  assert.ok(page.page <= page.pages)
  assert.ok(page.items.length <= 5)
  assert.equal(paginate([], 1, 10).pages, 1)
})

// ── Exporters seguros ────────────────────────────────────────────────────────
test('CSV incluye columnas del contrato epistémico', () => {
  for (const col of ['verdict', 'classification', 'approved_threshold', 'universe']) {
    assert.ok(M4_CSV_COLUMNS.includes(col), col)
  }
  const csv = findingsToCsv(FINDINGS)
  assert.ok(csv.startsWith(M4_CSV_COLUMNS.join(',')))
})

test('formula injection neutralizada ANTES del escaping', () => {
  assert.equal(neutralizeCsvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(neutralizeCsvCell('+1'), "'+1")
  assert.equal(neutralizeCsvCell('@cmd'), "'@cmd")
  const hostil = findingsToCsv([{ ...FINDINGS[0], observed_value: '=HYPERLINK("http://x")' }])
  assert.ok(!hostil.includes('\n=HYPERLINK'), 'la fórmula no queda ejecutable')
  assert.ok(csvCell('a,b').startsWith('"'))
})

test('exportFilename marca DEMO / STALE / NONFORMAL en el NOMBRE', () => {
  assert.equal(exportFilename('m4', 'csv', {}), 'm4.csv')
  assert.equal(exportFilename('m4', 'csv', { demo: true }), 'm4_DEMO.csv')
  assert.equal(exportFilename('m4', 'csv', { stale: true, nonformal: true }), 'm4_STALE_NONFORMAL.csv')
  assert.equal(exportFilename('m4', 'csv', { demo: true, stale: true, nonformal: true }), 'm4_DEMO_STALE_NONFORMAL.csv')
})

test('sanitizeForExport: PII fuera (drop), credenciales en VALORES [REDACTED]', () => {
  const dirty = { customer_name: 'X', phone: '555', nested: { email: 'a@b.c', ok: 1 }, comment_line: 'api_key=sk-abc123' }
  const clean = sanitizeForExport(dirty)
  assert.ok(!('customer_name' in clean) && !('phone' in clean), 'claves PII se dropean')
  assert.ok(!('email' in clean.nested) && clean.nested.ok === 1)
  assert.equal(clean.comment_line, '[REDACTED]', 'credencial en el VALOR se redacta')
})

test('exports de texto: resumen/recurrencia/handoff declaran NO FORMAL y frontera M8/M2', () => {
  const resumen = executiveSummaryText(M4_API_LATEST_FIXTURE, { demo: true })
  assert.ok(resumen.includes('EVIDENCIA NO FORMAL'))
  assert.ok(resumen.includes('INCUMPLIMIENTOS'))
  assert.ok(resumen.includes('NO ejecuta campañas'))
  const rec = recurrenceText(M4_API_LATEST_FIXTURE, {})
  assert.ok(rec.includes('RECURRENCIA'))
  assert.ok(rec.includes('NO aprobada'))
  const handoff = handoffM4M2Text(M4_API_LATEST_FIXTURE, {})
  assert.ok(handoff.includes('M4 → M2') || handoff.includes('M4→M2'))
  assert.ok(handoff.includes('NO escribe'))
})

test('evidenceJson exporta el envelope sanitizado con metadata', () => {
  const json = JSON.parse(evidenceJson(M4_API_LATEST_FIXTURE, { fixture: true }))
  assert.equal(json.exported_schema, 'kold.os.m4.export/1')
  assert.equal(json.export_meta.fixture, true)
  assert.equal(json.envelope.schema_version, 'kold.os.m4.api/1')
})

// KOLD OS · M5 — matriz de acceso (fail-closed) + filtros + exporters seguros.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  readM5Access, scopeFindingsForAccess, M5_ALLOWED_JOB_KEYS, M5_ALLOWED_TOWER_STATUS,
} from '../src/modules/inventario/m5/access.js'
import { isM5DemoAllowed } from '../src/modules/inventario/m5/demoGate.js'
import { applyFindingFilters, paginate, M5_DEFAULT_FILTERS } from '../src/modules/inventario/m5/filters.js'
import {
  findingsToCsv, neutralizeCsvCell, csvCell, sanitizeForExport, exportFilename,
  evidenceJson, executiveSummaryText, differencesText, handoffM5M6M7Text, M5_CSV_COLUMNS,
} from '../src/modules/inventario/m5/exporters.js'
import { M5_API_LATEST_FIXTURE } from '../src/modules/inventario/m5/fixtures/apiLatestFixture.js'

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const FINDINGS = M5_API_LATEST_FIXTURE.findings

// ── Matriz de acceso v1 (Fase permisos: fail-closed) ─────────────────────────
test('contrato v1: direccion_general y su proyección admin_plataforma', () => {
  assert.deepEqual([...M5_ALLOWED_JOB_KEYS], ['direccion_general'])
  assert.deepEqual([...M5_ALLOWED_TOWER_STATUS], ['admin_plataforma'])
})

test('direccion_general: GLOBAL (primario y vía additional_job_keys)', () => {
  assert.deepEqual(readM5Access(s('direccion_general')),
    { level: 'global', reason: 'job_key_direccion_general' })
  assert.equal(readM5Access(s('gerente_sucursal', { additional_job_keys: ['direccion_general'] })).level, 'global')
})

test('admin_plataforma (tower_status): GLOBAL — proyeccion aceptada por el backend', () => {
  assert.deepEqual(readM5Access(tower('admin_plataforma')),
    { level: 'global', reason: 'tower_admin_plataforma' })
})

test('NO acceso v1: gerente/supervisor/vendedor/chofer/jefe_ruta (fail-closed)', () => {
  for (const sess of [s('gerente_sucursal'), s('supervisor_ventas'), s('vendedor'),
    s('chofer'), s('jefe_ruta'), tower('supervisor_ventas')]) {
    assert.equal(readM5Access(sess).level, 'none')
  }
})

test('sesión inválida => none aunque el payload traiga rol privilegiado', () => {
  for (const bad of [null, {}, { role: 'direccion_general' },
    { employee_id: 100, role: 'direccion_general' }]) {
    assert.equal(readM5Access(bad).level, 'none')
    assert.equal(readM5Access(bad).reason, 'invalid_session')
  }
})

test('tower_status con case distinto o ajeno NO abre M5 (strict)', () => {
  assert.equal(readM5Access(tower('Admin_Plataforma')).level, 'none')
  assert.equal(readM5Access(tower('otro_rol')).level, 'none')
})

test('scope: none => cero hallazgos; global => todos', () => {
  assert.deepEqual(scopeFindingsForAccess(FINDINGS, { level: 'none' }), [])
  assert.equal(scopeFindingsForAccess(FINDINGS, { level: 'global' }).length, FINDINGS.length)
})

// ── Demo gate ────────────────────────────────────────────────────────────────
test('demo gate: DEV sí · Preview con VITE_ENABLE_M5_DEMO sí · producción NO', () => {
  assert.equal(isM5DemoAllowed({ DEV: true }), true)
  assert.equal(isM5DemoAllowed({ DEV: false, VITE_ENABLE_M5_DEMO: 'true' }), true)
  assert.equal(isM5DemoAllowed({ DEV: false }), false)
  assert.equal(isM5DemoAllowed({ DEV: false, VITE_ENABLE_M5_DEMO: 'false' }), false)
  assert.equal(isM5DemoAllowed(null), false)
})

// ── Filtros + paginación (demo local; en real es server-side) ────────────────
test('filtros: verdict/classification/category filtran; desconocidos no', () => {
  const porVerdicto = applyFindingFilters(FINDINGS, { ...M5_DEFAULT_FILTERS, verdict: 'riesgo' })
  assert.ok(porVerdicto.length > 0)
  assert.ok(porVerdicto.every((f) => f.verdict === 'riesgo'))
  const porClasificacion = applyFindingFilters(FINDINGS, { ...M5_DEFAULT_FILTERS, classification: 'exploratory' })
  assert.ok(porClasificacion.every((f) => f.classification === 'exploratory'))
  // 'recurrencia' era una categoría de M4 que en M5 NO existe: el filtro
  // devolvía [] y `every()` sobre [] es true, así que el test PASABA sin
  // verificar nada. Un test vacuo es peor que ninguno: da falsa cobertura.
  const porCategoria = applyFindingFilters(FINDINGS, { ...M5_DEFAULT_FILTERS, category: 'mermas_diferencias' })
  assert.ok(porCategoria.length > 0, 'la categoría debe existir de verdad en el fixture')
  assert.ok(porCategoria.every((f) => f.category === 'mermas_diferencias'))
  // Y una categoría ajena no puede colar la lista completa (mentira silenciosa).
  assert.equal(applyFindingFilters(FINDINGS, { ...M5_DEFAULT_FILTERS, category: 'recurrencia' }).length, 0,
    'una categoría de otro módulo no filtra: devuelve vacío, jamás la lista entera')
})

// El caso que Codex pidió confirmar: con CERO incumplimientos, pedir "solo
// incumplimientos" tiene que dar tabla vacía. Devolver la lista completa (o
// colar anomalías) sería la mentira silenciosa que motivó todo este arreglo.
test('cero incumplimientos: filtrar por incumplimiento deja la tabla vacía', () => {
  assert.equal(FINDINGS.filter((f) => f.verdict === 'incumplimiento').length, 0,
    'la evidencia v1 no prueba ningún incumplimiento')
  const out = applyFindingFilters(FINDINGS, { ...M5_DEFAULT_FILTERS, verdict: 'incumplimiento' })
  assert.deepEqual(out, [], 'no puede colarse ni un hallazgo')
  const page = paginate(out, 1, 10)
  assert.equal(page.total, 0, 'el total filtrado corresponde a las filas filtradas')
  assert.deepEqual(page.items, [])
  assert.ok(FINDINGS.length > 0, 'y sin filtro sí hay hallazgos: el filtro recorta de verdad')
})

// El total filtrado debe ser el de las filas filtradas, no el global.
test('el total filtrado corresponde a las filas filtradas', () => {
  for (const verdict of ['riesgo', 'anomalia']) {
    const rows = applyFindingFilters(FINDINGS, { ...M5_DEFAULT_FILTERS, verdict })
    const page = paginate(rows, 1, 10)
    assert.equal(page.total, rows.length)
    assert.ok(page.total < FINDINGS.length, `${verdict} debe ser un subconjunto`)
    assert.ok(rows.every((f) => f.verdict === verdict))
  }
})

// El export tiene que coincidir con la pantalla y con la API: si el CSV dice
// una cosa y la UI otra, el que abre el CSV se lleva la versión equivocada.
test('export CSV: M5-H-01 y M5-G-07 coinciden con la API, con su universo', async () => {
  const { findingsToCsv, M5_CSV_COLUMNS } = await import('../src/modules/inventario/m5/exporters.js')
  assert.ok(M5_CSV_COLUMNS.includes('universe_id'), 'el CSV debe llevar el universo canónico')
  assert.ok(!M5_CSV_COLUMNS.includes('company_id'), 'dimensión inexistente en v1')

  const parseCsv = (text) => {
    const rows = []; let row = []; let cell = ''; let quoted = false
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i]
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1 } else quoted = false }
        else cell += ch
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
  const iUid = header.indexOf('universe_id')
  const iNum = header.indexOf('numerator')
  const h01 = rows.slice(1).find((c) => c[iCode] === 'M5-H-01')
  assert.ok(h01, 'M5-H-01 en el export')
  assert.equal(h01[iUid], 'executed_stops_in_window')
  const api = FINDINGS.find((f) => f.rule_code === 'M5-H-01')
  assert.equal(Number(h01[iNum]), api.numerator, 'el export coincide con la API')
  // M5-G-06 (la condición agregada) ya NO viaja: medida solo contra las
  // conciliaciones FINALES, la condición no se cumple => cumple => sin hallazgo.
  // Se exporta G-07, la comparación POR PRODUCTO, que sí declara diferencia.
  assert.ok(!rows.slice(1).some((c) => c[iCode] === 'M5-G-06'),
    'una regla que cumple no genera hallazgo, así que no viaja en el export')
  const g07 = rows.slice(1).find((c) => c[iCode] === 'M5-G-07')
  assert.ok(g07, 'M5-G-07 (diferencia reportada por producto) viaja en el export')
  assert.equal(g07[iUid], 'final_reconciliation_product_lines_in_window')
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
    assert.ok(M5_CSV_COLUMNS.includes(col), col)
  }
  const csv = findingsToCsv(FINDINGS)
  assert.ok(csv.startsWith(M5_CSV_COLUMNS.join(',')))
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
  assert.equal(exportFilename('m5', 'csv', {}), 'm5.csv')
  assert.equal(exportFilename('m5', 'csv', { demo: true }), 'm5_DEMO.csv')
  assert.equal(exportFilename('m5', 'csv', { stale: true, nonformal: true }), 'm5_STALE_NONFORMAL.csv')
  assert.equal(exportFilename('m5', 'csv', { demo: true, stale: true, nonformal: true }), 'm5_DEMO_STALE_NONFORMAL.csv')
})

test('sanitizeForExport: PII fuera (drop), credenciales en VALORES [REDACTED]', () => {
  const dirty = { customer_name: 'X', phone: '555', nested: { email: 'a@b.c', ok: 1 }, comment_line: 'api_key=sk-abc123' }
  const clean = sanitizeForExport(dirty)
  assert.ok(!('customer_name' in clean) && !('phone' in clean), 'claves PII se dropean')
  assert.ok(!('email' in clean.nested) && clean.nested.ok === 1)
  assert.equal(clean.comment_line, '[REDACTED]', 'credencial en el VALOR se redacta')
})

test('exports de texto: resumen/diferencias/handoff declaran NO FORMAL y fronteras', async () => {
  const { executiveSummaryText, differencesText, handoffM5M6M7Text } =
    await import('../src/modules/inventario/m5/exporters.js')
  const resumen = executiveSummaryText(M5_API_LATEST_FIXTURE, { demo: true })
  assert.match(resumen, /EVIDENCIA NO FORMAL/)
  const dif = differencesText(M5_API_LATEST_FIXTURE, { demo: true })
  // El export ya no promete un "cuadre": nombra lo que de verdad trae.
  assert.match(dif, /DIFERENCIAS REPORTADAS EN CONCILIACIÓN/)
  assert.match(dif, /NIVEL 1 · SEÑALES REPORTADAS/)
  assert.match(dif, /NIVEL 2 · COBERTURA DE INSTRUMENTACIÓN/)
  assert.match(dif, /NIVEL 3 · CAPACIDADES NO DISPONIBLES/)
  assert.ok(!/NO CUADRA/i.test(dif), 'el export jamás afirma un descuadre')
  // La v1 afirmaba "UOM heterogéneas" -- y esa afirmación tampoco estaba medida.
  // La medición la refuta: uom_category_count = 1 (todos los productos
  // conciliados comparten la categoría "Unit"), así que las sumas SÍ son
  // dimensionalmente consistentes como conteo. Lo que no son es una magnitud
  // física ni una normalización por producto: eso es lo que debe declararse.
  assert.match(dif, /REPORTADA|reportan|reportado/)
  assert.match(dif, /Normalización por UOM\s*:\s*NO DISPONIBLE/)
  assert.match(dif, /Cuadre físico integral\s*:\s*NO DISPONIBLE/)
  assert.ok(!/heterogéneas/i.test(dif),
    'no se afirma heterogeneidad de UOM: la medición dice 1 sola categoría')
  const handoff = handoffM5M6M7Text(M5_API_LATEST_FIXTURE, { demo: true })
  assert.match(handoff, /M6/)
  assert.match(handoff, /M7/)
  assert.match(handoff, /solo OBSERVA/)
})

test('evidenceJson exporta el envelope sanitizado con metadata', () => {
  const json = JSON.parse(evidenceJson(M5_API_LATEST_FIXTURE, { fixture: true }))
  assert.equal(json.exported_schema, 'kold.os.m5.export/1')
  assert.equal(json.export_meta.fixture, true)
  assert.equal(json.envelope.schema_version, 'kold.os.m5.api/1')
})

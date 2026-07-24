// KOLD OS · M7 — exports: sin PII, sin formula injection, por moneda, con linaje,
// y sin dejar object URLs vivos.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findingsToCsv, evidenceJson, capabilitiesText, exportFilename,
  csvCell, neutralizeCsvCell, sanitizeForExport, downloadTextFile,
  FORMULA_PREFIX_RE, M7_EXPORT_MAX_ROWS,
} from '../src/modules/rentabilidad-costos/m7/exporters.js'
import { scanPii, M7_PII_KEYS } from '../src/modules/rentabilidad-costos/m7/contract.js'
import { runContextFromLatest, runContextFromRunsItem } from '../src/modules/rentabilidad-costos/m7/runController.js'
import { M7_API_LATEST_FIXTURE } from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const F = M7_API_LATEST_FIXTURE

// ── formula injection ────────────────────────────────────────────────────────
test('neutraliza celdas que Excel ejecutaría', () => {
  for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) {
    assert.ok(neutralizeCsvCell(evil).startsWith("'"), `no neutralizado: ${evil}`)
    assert.ok(FORMULA_PREFIX_RE.test(evil))
  }
  assert.equal(neutralizeCsvCell('normal'), 'normal')
  // neutraliza ANTES de escapar comillas.
  assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"')
})

test('un título malicioso en un finding se neutraliza en el CSV', () => {
  const items = [{ ...F.findings[0], title: '=cmd|calc', rule_code: '@evil' }]
  const csv = findingsToCsv(items, F)
  assert.ok(csv.includes("'=cmd|calc") || csv.includes('"\'=cmd'), 'title sin neutralizar')
  assert.ok(csv.includes("'@evil"), 'rule_code sin neutralizar')
})

// ── PII ──────────────────────────────────────────────────────────────────────
test('sanitizeForExport elimina PII en cualquier nivel', () => {
  const dirty = { a: 1, partner_name: 'X', nested: { rfc: 'ABC', ok: 2 }, list: [{ clabe: '1' }] }
  const clean = sanitizeForExport(dirty)
  assert.deepEqual(scanPii(clean), [])
  assert.equal(clean.a, 1)
  assert.equal(clean.nested.ok, 2)
  assert.ok(!('partner_name' in clean))
})

test('CSV de findings sin ninguna columna PII', () => {
  const csv = findingsToCsv(F.findings, F)
  const header = csv.split('\n').find((l) => l.startsWith('rule_code'))
  assert.ok(header, 'debe haber cabecera de columnas')
  for (const k of M7_PII_KEYS) assert.ok(!header.split(',').includes(k), `columna PII: ${k}`)
})

test('evidenceJson exporta el envelope SANITIZADO y con linaje', () => {
  const parsed = JSON.parse(evidenceJson(F, { demo: true }))
  assert.equal(parsed._export.demo, true)
  assert.equal(parsed._export.lineage.reseal_required, true)
  assert.deepEqual(scanPii(parsed), [])
  assert.match(parsed._export.warning, /Multi-moneda sin consolidar/)
})

// ── por moneda, jamás consolidado ────────────────────────────────────────────
test('todo export declara MULTI-MONEDA SIN CONSOLIDAR y no suma MXN+USD', () => {
  const csv = findingsToCsv(F.findings, F)
  assert.match(csv, /MULTI-MONEDA SIN CONSOLIDAR/)
  // no debe existir una línea que sume ambos totales de moneda.
  const total = F.metrics.invoice_revenue_by_currency.reduce((a, r) => a + r.untaxed_total, 0)
  assert.ok(!csv.includes(String(total)), 'el CSV no debe portar un total consolidado')
})

test('el CSV declara evidencia NO formal y linaje pre-migración', () => {
  const csv = findingsToCsv(F.findings, F)
  assert.match(csv, /EVIDENCIA NO FORMAL/)
  assert.match(csv, /LINAJE PRE-MIGRACIÓN/)
  assert.ok(csv.includes(F.run.scope_key), 'sin scope_key')
  assert.ok(csv.includes(F.run.auditor_build_sha), 'sin auditor_build_sha')
})

test('el CSV incluye la nota de incidencias', () => {
  assert.match(findingsToCsv(F.findings, F), /No representa registros únicos, pesos ni pérdida económica/)
})

test('findingsToCsv respeta el tope de filas', () => {
  const muchos = Array.from({ length: M7_EXPORT_MAX_ROWS + 25 }, () => F.findings[0])
  const dataRows = findingsToCsv(muchos, F).split('\n').filter((l) => l.startsWith('M7-'))
  assert.equal(dataRows.length, M7_EXPORT_MAX_ROWS)
})

// ── nombre de archivo declara su naturaleza ──────────────────────────────────
test('el nombre del archivo DECLARA DEMO/NONFORMAL/STALE/UNCONSOLIDATED', () => {
  assert.equal(exportFilename('kold_os_m7_hallazgos', 'csv', {}), 'kold_os_m7_hallazgos.csv')
  assert.equal(
    exportFilename('kold_os_m7_hallazgos', 'csv', { demo: true, nonformal: true, unconsolidated: true }),
    'kold_os_m7_hallazgos_DEMO_NONFORMAL_UNCONSOLIDATED.csv')
  assert.equal(exportFilename('x', 'txt', { stale: true }), 'x_STALE.txt')
})

// ── capabilities: false no es 0 ──────────────────────────────────────────────
test('capabilitiesText enumera lo NO disponible con lo que falta', () => {
  const t = capabilitiesText(F)
  assert.match(t, /gross_margin_observable: NO disponible/)
  assert.match(t, /falta:/)
  assert.match(t, /Nivel económico alcanzado: L1_observable_revenue/)
})

// ── export ANCLADO a la corrida seleccionada (blocker Codex) ─────────────────
test('CSV de corrida histórica: linaje del run anclado, NO el de latest', () => {
  const anchor = runContextFromRunsItem({
    run_id: 'RUNAAAA1111', scope_key: 'SCOPEAAAA', finished_at: '2026-05-01T00:00:00Z',
    is_production_shell_run: false, measurement_method: 'xml_rpc_read_only',
    auditor_build_sha: 'auditAAAA',
  }, F.run.run_id)
  const csv = findingsToCsv(F.findings, F, { runContext: anchor })
  assert.match(csv, /CORRIDA HISTÓRICA/)
  assert.ok(csv.includes('RUNAAAA1111'), 'debe portar el run_id anclado (A)')
  assert.ok(!csv.includes(F.run.run_id), 'NO debe portar el run_id de latest (B)')
  // el scope económico NO se copia del latest: se declara no disponible.
  assert.match(csv, /no disponible por corrida histórica/)
  assert.ok(!csv.includes(F.run.scope.window_start), 'no debe filtrar la ventana de latest')
})

test('CSV de la corrida latest: linaje COMPLETO (comportamiento previo)', () => {
  const anchor = runContextFromLatest(F)
  const csv = findingsToCsv(F.findings, F, { runContext: anchor })
  assert.ok(csv.includes(F.run.run_id), 'porta el run_id de latest')
  assert.ok(csv.includes(F.run.scope_key), 'porta el scope_key de latest')
  assert.ok(!/CORRIDA HISTÓRICA/.test(csv), 'latest no es histórica')
})

// ── downloadTextFile: revoca el object URL ───────────────────────────────────
test('downloadTextFile crea y REVOCA el object URL (sin handles vivos)', async () => {
  const created = []
  const revoked = []
  const origBlob = globalThis.Blob
  const origURL = globalThis.URL
  const origDoc = globalThis.document
  globalThis.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts } }
  globalThis.URL = {
    createObjectURL: () => { const u = `blob:${created.length}`; created.push(u); return u },
    revokeObjectURL: (u) => revoked.push(u),
  }
  const clicks = []
  globalThis.document = {
    createElement: () => ({ href: '', download: '', click() { clicks.push(this.download) }, remove() {} }),
    body: { appendChild() {} },
  }
  try {
    downloadTextFile('contenido', 'kold_os_m7_evidencia_DEMO.json', 'application/json')
    await new Promise((r) => setTimeout(r, 5)) // el revoke va en setTimeout(…, 0)
    assert.equal(created.length, 1, 'debe crear un object URL')
    assert.deepEqual(revoked, created, 'debe revocar exactamente lo que creó')
    assert.deepEqual(clicks, ['kold_os_m7_evidencia_DEMO.json'])
  } finally {
    globalThis.Blob = origBlob
    globalThis.URL = origURL
    globalThis.document = origDoc
  }
})

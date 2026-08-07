// KOLD OS · M6 — exports: sin PII, sin formula injection, con linaje y wording honesto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, agingText, paymentsText,
  closuresText, capabilitiesText, exportFilename, csvCell, neutralizeCsvCell,
  sanitizeForExport, sanitizeCsvText, M6_CSV_COLUMNS, M6_EXPORT_MAX_ROWS,
} from '../src/modules/caja-conciliacion/m6/exporters.js'
import { scanPii } from '../src/modules/caja-conciliacion/m6/contract.js'
import { M6_API_LATEST_FIXTURE } from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

const F = M6_API_LATEST_FIXTURE
const TEXTS = () => ({
  ejecutivo: executiveSummaryText(F, { demo: true }),
  aging: agingText(F, { demo: true }),
  pagos: paymentsText(F, { demo: true }),
  cierres: closuresText(F, { demo: true }),
  capacidades: capabilitiesText(F, { demo: true }),
})

// Normaliza los saltos de línea: una frase partida en dos líneas sigue siendo la
// misma afirmación para quien la lee. Comparar sin esto da falsos fallos.
const flat = (t) => t.replace(/\s+/g, ' ')

const readScreen = () => readFileSync(
  new URL('../src/modules/caja-conciliacion/ScreenCajaConciliacionM6.jsx', import.meta.url), 'utf8')

test('formula injection neutralizada ANTES del escaping', () => {
  for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) {
    assert.ok(neutralizeCsvCell(evil).startsWith("'"), `no neutralizado: ${evil}`)
  }
  assert.equal(neutralizeCsvCell('normal'), 'normal')
  assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"')
})

test('CSV: columnas del contrato, sin PII', () => {
  assert.ok(M6_CSV_COLUMNS.includes('universe_id'))
  assert.ok(M6_CSV_COLUMNS.includes('scope_key'))
  assert.ok(M6_CSV_COLUMNS.includes('approved_threshold'))
  for (const banned of ['partner_name', 'customer_name', 'rfc', 'clabe', 'email',
    'phone', 'account_number', 'employee_name']) {
    assert.ok(!M6_CSV_COLUMNS.includes(banned), `columna PII: ${banned}`)
  }
})

test('CSV de hallazgos: cabecera + filas, respeta el tope', () => {
  const csv = findingsToCsv(F.findings)
  const lines = csv.split('\n')
  assert.equal(lines[0], M6_CSV_COLUMNS.join(','))
  assert.ok(F.findings.length > 0, 'debe haber hallazgos que exportar')
  assert.equal(lines.length, F.findings.length + 1)
  const muchos = Array.from({ length: M6_EXPORT_MAX_ROWS + 10 }, () => F.findings[0])
  assert.equal(findingsToCsv(muchos).split('\n').length, M6_EXPORT_MAX_ROWS + 1)
})

test('sanitizeForExport ELIMINA claves PII en cualquier nivel', () => {
  const dirty = { a: 1, partner_name: 'X', nested: { rfc: 'ABC', ok: 2 }, list: [{ clabe: '1' }] }
  const clean = sanitizeForExport(dirty)
  assert.deepEqual(scanPii(clean), [])
  assert.equal(clean.a, 1)
  assert.equal(clean.nested.ok, 2)
  assert.ok(!('partner_name' in clean))
})

test('sanitizeCsvText redacta PII textual', () => {
  const out = sanitizeCsvText('rfc: "AAA010101AAA" y clabe: 002180')
  assert.ok(!out.includes('AAA010101AAA'))
  assert.ok(out.includes('[REDACTED]'))
})

test('evidenceJson exporta el envelope SANITIZADO', () => {
  const parsed = JSON.parse(evidenceJson(F, { demo: true }))
  assert.equal(parsed.exported_schema, 'kold.os.m6.export/1')
  assert.equal(parsed.demo, true)
  assert.deepEqual(scanPii(parsed), [])
})

test('el nombre del archivo DECLARA DEMO / NONFORMAL / STALE', () => {
  assert.equal(exportFilename('kold_os_m6_hallazgos', 'csv', {}), 'kold_os_m6_hallazgos.csv')
  assert.equal(exportFilename('kold_os_m6_hallazgos', 'csv', { demo: true, nonformal: true }),
    'kold_os_m6_hallazgos_DEMO_NONFORMAL.csv')
  assert.equal(exportFilename('x', 'txt', { stale: true }), 'x_STALE.txt')
})

test('los 7 exports nombran su archivo como M6', () => {
  const bases = [...readScreen().matchAll(/doExport\('([a-z0-9_]+)'/g)].map((m) => m[1])
  assert.ok(bases.length >= 7, `deben existir los 7 exports; hay ${bases.length}`)
  for (const b of bases) assert.match(b, /^kold_os_m6_/, `export '${b}' no declara ser de M6`)
})

test('todo export declara su LINAJE y su estado de evidencia', () => {
  for (const [name, txt] of Object.entries(TEXTS())) {
    assert.match(txt, /EVIDENCIA NO FORMAL/, `${name}: no declara evidencia no formal`)
    assert.match(txt, /MODO DEMO/, `${name}: no declara demo`)
    assert.ok(txt.includes(F.run.auditor_build_sha), `${name}: sin auditor_build_sha`)
    assert.ok(txt.includes(F.run.scope_key), `${name}: sin scope_key`)
    assert.ok(txt.includes(F.run.run_id), `${name}: sin run_id`)
  }
})

test('los exports NO AFIRMAN un cuadre, un faltante ni un fraude', () => {
  // No se prohíbe la PALABRA: se prohíbe la AFIRMACIÓN. El texto dice "NO es un
  // faltante ni un pago perdido" — nombrar el término para negarlo es justo lo
  // que debe hacer. Se exige que TODA aparición esté negada.
  const NEGADO = /\b(no|jam[aá]s|sin|ni)\b[^.]{0,60}$/i
  for (const [name, txt] of Object.entries(TEXTS())) {
    const t = flat(txt)
    for (const term of ['faltante', 'p[eé]rdida', 'fraude', 'dinero desaparecido',
      'robo', 'todo cuadra']) {
      const rx = new RegExp(`\\b${term}\\b`, 'gi')
      let m
      while ((m = rx.exec(t)) !== null) {
        const antes = t.slice(Math.max(0, m.index - 70), m.index)
        assert.ok(NEGADO.test(antes),
          `${name}: "${m[0]}" aparece SIN negar → «…${antes.slice(-50)}[${m[0]}]…»`)
      }
    }
  }
})

test('el resumen ejecutivo publica los TRES ejes por separado', () => {
  const t = flat(TEXTS().ejecutivo)
  assert.match(t, /NIVEL 1 · ESTADO FINANCIERO REPORTADO/)
  assert.match(t, /NIVEL 3 · CAPACIDADES NO DISPONIBLES/)
  assert.match(t, /POR CLASIFICACIÓN/)
  assert.match(t, /POR SEVERIDAD/)
  assert.match(t, /"exploratory" es una CLASIFICACIÓN, no un veredicto/)
})

test('el resumen declara que NO hay total consolidado', () => {
  const t = flat(TEXTS().ejecutivo)
  assert.match(t, /Total consolidado global\s*:\s*NO DISPONIBLE/)
  assert.match(t, /varias monedas sin normalización/)
})

test('el resumen declara que las incidencias NO son importes ni entidades', () => {
  assert.match(flat(TEXTS().ejecutivo), /afectaciones POR REGLA, NO entidades únicas ni importes/i)
})

test('cartera: declara el snapshot como fuente canónica y NO recalcula', () => {
  const t = flat(TEXTS().aging)
  assert.match(t, /gf\.ar\.customer\.snapshot/)
  assert.match(t, /el aging lo computa el snapshot/i)
  assert.match(t, /NO lo recalcula/i)
  assert.match(t, /CONTEOS DE CLIENTES, no importes/i)
  assert.match(t, /Sin identidad del cliente/i)
})

test('pagos: sin conciliación es CAVEATED con sus limitaciones', () => {
  const t = flat(TEXTS().pagos)
  assert.match(t, /Sin conciliación identificada en la fuente/i)
  assert.match(t, /NO es un faltante ni un pago perdido/i)
  for (const causa of ['anticipo', 'pago no aplicado', 'conciliación parcial',
    'pago reversado', 'flujo contable alternativo', 'cobertura']) {
    assert.ok(t.toLowerCase().includes(causa.toLowerCase()), `falta la causa: ${causa}`)
  }
})

test('cierres: las cajas abiertas son CAVEATED, no incumplimiento', () => {
  const t = flat(TEXTS().cierres)
  assert.match(t, /Con estado ABIERTO en la fuente/i)
  assert.match(t, /caja operativa permanente o una sesión sin cierre/i)
  assert.match(t, /requiere validación funcional/i)
  // "abandonadas" sólo puede aparecer NEGADA ("NO son cajas abandonadas").
  const NEGADO = /\b(no|jam[aá]s|sin|ni)\b[^.]{0,60}$/i
  for (const term of ['abandonad\\w*', 'ilegal\\w*']) {
    const rx = new RegExp(`\\b${term}\\b`, 'gi')
    let m
    while ((m = rx.exec(t)) !== null) {
      const antes = t.slice(Math.max(0, m.index - 70), m.index)
      assert.ok(NEGADO.test(antes), `"${m[0]}" aparece SIN negar: «…${antes.slice(-50)}»`)
    }
  }
})

test('cierres: la diferencia financiera NO es la física de M5', () => {
  assert.match(flat(TEXTS().cierres), /distinta de la diferencia FÍSICA de M5/i)
})

test('capacidades: declara que false NO es cero', () => {
  const t = flat(TEXTS().capacidades)
  assert.match(t, /Una capability en false NO es un cero/i)
  assert.match(t, /consolidated_global_total\s+NO/)
  assert.match(t, /physical_to_financial_bridge\s+NO/)
})

test('ningún export porta PII', () => {
  for (const [name, txt] of Object.entries(TEXTS())) {
    for (const banned of ['partner_name', 'customer_name', 'rfc:', 'clabe', 'iban',
      'account_number', 'employee_name']) {
      assert.ok(!txt.toLowerCase().includes(banned.toLowerCase()), `${name}: PII "${banned}"`)
    }
  }
  assert.deepEqual(scanPii(JSON.parse(evidenceJson(F))), [])
})

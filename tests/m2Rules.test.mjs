import test from 'node:test'
import assert from 'node:assert/strict'

import { M2_RULES, M2_CATEGORIES, getRuleByCode } from '../src/modules/planeacion/m2/ruleCatalog.js'
import { deriveM2, evaluateRules, safePct } from '../src/modules/planeacion/m2/deriveFindings.js'
import { M2_FIXTURE_RUN } from '../src/modules/planeacion/m2/fixtures/realRun20260714.js'

const clone = () => JSON.parse(JSON.stringify(M2_FIXTURE_RUN))
const resultOf = (results, code) => results.find((r) => r.rule_code === code)

// ── Integridad del catálogo ──────────────────────────────────────────────────
test('catálogo: códigos únicos, 6 categorías, campos completos, auto_fix=false SIEMPRE', () => {
  assert.equal(M2_CATEGORIES.length, 6)
  const codes = M2_RULES.map((r) => r.code)
  assert.equal(new Set(codes).size, codes.length, 'códigos únicos')
  const categoryKeys = new Set(M2_CATEGORIES.map((c) => c.key))
  for (const rule of M2_RULES) {
    assert.match(rule.code, /^M2-[A-F]-\d{2}$/, rule.code)
    assert.ok(categoryKeys.has(rule.category), `${rule.code} categoría válida`)
    assert.ok(rule.name && rule.description && rule.expected_rule && rule.recommended_action, `${rule.code} completo`)
    assert.ok(['high', 'medium'].includes(rule.severity), `${rule.code} severidad`)
    assert.ok(rule.entity_type && rule.source_model, `${rule.code} entidad/fuente`)
    assert.ok(rule.responsible_area, `${rule.code} área responsable`)
    assert.equal(rule.auto_fix, false, `${rule.code} NUNCA autocorrige`)
    assert.ok(rule.threshold && rule.threshold.kind, `${rule.code} threshold`)
    assert.ok(Array.isArray(rule.evidence_fields), `${rule.code} evidencia`)
  }
  // cada categoría tiene al menos una regla
  for (const cat of M2_CATEGORIES) {
    assert.ok(M2_RULES.some((r) => r.category === cat.key), cat.key)
  }
})

// ── safePct: guardia de división entre cero y redondeo 2dp ──────────────────
test('safePct: división entre cero / nulls => null; redondeo a 2 decimales', () => {
  assert.equal(safePct(1, 0), null)
  assert.equal(safePct(1, null), null)
  assert.equal(safePct(null, 10), null)
  assert.equal(safePct('x', 10), null)
  assert.equal(safePct(293, 484), 60.54)
  assert.equal(safePct(424, 484), 87.6)
  assert.equal(safePct(0, 484), 0)
})

// ── El fixture reproduce EXACTAMENTE las cifras reportadas del run real ─────
test('REPORTADO: territorio 293/484 = 60.54% RED', () => {
  const r = resultOf(evaluateRules(M2_FIXTURE_RUN), 'M2-A-01')
  assert.equal(r.numerator, 293)
  assert.equal(r.denominator, 484)
  assert.equal(r.pct, 60.54)
  assert.equal(r.status, 'RED')
})

test('REPORTADO: solver sin evidencia 424/484 = 87.60% RED', () => {
  const r = resultOf(evaluateRules(M2_FIXTURE_RUN), 'M2-B-01')
  assert.equal(r.numerator, 424)
  assert.equal(r.denominator, 484)
  assert.equal(r.pct, 87.6)
  assert.equal(r.status, 'RED')
})

test('REPORTADO: sin capacidad 144/484 = 29.75% · sin vehículo 133/484 = 27.48% · 30 sobrecapacidad', () => {
  const results = evaluateRules(M2_FIXTURE_RUN)
  const capacity = resultOf(results, 'M2-C-02')
  assert.equal(capacity.numerator, 144); assert.equal(capacity.pct, 29.75); assert.equal(capacity.status, 'RED')
  const vehicle = resultOf(results, 'M2-C-01')
  assert.equal(vehicle.numerator, 133); assert.equal(vehicle.pct, 27.48); assert.equal(vehicle.status, 'RED')
  const over = resultOf(results, 'M2-C-03')
  assert.equal(over.numerator, 30); assert.equal(over.status, 'RED')
})

test('REPORTADO: publicados sin carga 37/39 = 94.87% RED', () => {
  const r = resultOf(evaluateRules(M2_FIXTURE_RUN), 'M2-D-01')
  assert.equal(r.numerator, 37)
  assert.equal(r.denominator, 39)
  assert.equal(r.pct, 94.87)
  assert.equal(r.status, 'RED')
})

test('REPORTADO: 46 diarios sin snapshot · 21 sin stops · 48 semanales sin almacén · 10 sin snapshot · 29 sobrecapacidad semanal', () => {
  const results = evaluateRules(M2_FIXTURE_RUN)
  assert.equal(resultOf(results, 'M2-D-02').numerator, 46)
  assert.equal(resultOf(results, 'M2-D-03').numerator, 21)
  assert.equal(resultOf(results, 'M2-D-04').numerator, 48)
  assert.equal(resultOf(results, 'M2-D-05').numerator, 10)
  assert.equal(resultOf(results, 'M2-C-04').numerator, 29)
})

test('REPORTADO: snapshots cobertura 56.82% RED · confianza 0.6667 RED · 2202 fallback · 192 warnings (AMBER)', () => {
  const results = evaluateRules(M2_FIXTURE_RUN)
  const coverage = resultOf(results, 'M2-E-01')
  assert.equal(coverage.pct, 56.82); assert.equal(coverage.status, 'RED') // < 70 (D-A 90/70)
  const confidence = resultOf(results, 'M2-E-02')
  assert.equal(confidence.pct, 0.6667); assert.equal(confidence.status, 'RED') // < 0.70
  const fallback = resultOf(results, 'M2-E-03')
  assert.equal(fallback.numerator, 2202); assert.equal(fallback.status, 'AMBER')
  const warnings = resultOf(results, 'M2-E-04')
  assert.equal(warnings.numerator, 192); assert.equal(warnings.status, 'AMBER')
})

test('REPORTADO: actual_kg 7026/42421 = 16.56% RED · forecast 41372/42372 final GREEN · 92 días cubren ventana 90', () => {
  const results = evaluateRules(M2_FIXTURE_RUN)
  const actual = resultOf(results, 'M2-F-01')
  assert.equal(actual.numerator, 7026); assert.equal(actual.denominator, 42421)
  assert.equal(actual.pct, 16.56); assert.equal(actual.status, 'RED')
  const final = resultOf(results, 'M2-F-02')
  assert.equal(final.pct, 97.64); assert.equal(final.status, 'GREEN')
  const days = resultOf(results, 'M2-F-03')
  assert.equal(days.numerator, 0); assert.equal(days.status, 'GREEN')
})

// ── Estados honestos ─────────────────────────────────────────────────────────
test('reglas sin datos en el contrato v1 => NOT_EVALUABLE (gris honesto, jamás 0% falso)', () => {
  const results = evaluateRules(M2_FIXTURE_RUN)
  for (const code of ['M2-A-02', 'M2-A-03', 'M2-C-05']) {
    const r = resultOf(results, code)
    assert.equal(r.status, 'NOT_EVALUABLE', code)
    assert.ok(r.not_evaluable_reason, `${code} explica por qué`)
  }
})

test('división entre cero => NOT_EVALUABLE (0 publicados no es "0% sin carga")', () => {
  const doc = clone()
  doc.metrics.territory_load_handoff_metrics = [{
    plan_count: 484, missing_territory_count: 293, published_count: 0, published_without_load_count: 0,
  }]
  const r = resultOf(evaluateRules(doc), 'M2-D-01')
  assert.equal(r.status, 'NOT_EVALUABLE')
})

test('métrica ausente o nula => NOT_EVALUABLE', () => {
  const doc = clone()
  delete doc.metrics.snapshot_metrics
  const results = evaluateRules(doc)
  for (const code of ['M2-E-01', 'M2-E-02', 'M2-E-03', 'M2-E-04', 'M2-E-05']) {
    assert.equal(resultOf(results, code).status, 'NOT_EVALUABLE', code)
  }
  const doc2 = clone()
  doc2.metrics.history_metrics = [{ row_count: null, actual_kg_count: null }]
  assert.equal(resultOf(evaluateRules(doc2), 'M2-F-01').status, 'NOT_EVALUABLE')
})

// ── Resumen y bloques ────────────────────────────────────────────────────────
test('summary: separa técnico/operativo — el fixture es RED operativo con auditor PASS', () => {
  const { summary } = deriveM2(M2_FIXTURE_RUN)
  assert.equal(M2_FIXTURE_RUN.status, 'PASS', 'técnico PASS')
  assert.equal(summary.overall_status, 'RED', 'operativo RED (incumplimientos reales)')
  assert.equal(summary.total_rules, M2_RULES.length)
  assert.equal(summary.rules_not_evaluable, 3)
  assert.ok(summary.rules_fail >= 8, `rojos ${summary.rules_fail}`)
  assert.ok(summary.rules_warning >= 2, `ámbar ${summary.rules_warning}`)
  assert.ok(summary.total_affected_records > 0)
  assert.equal(summary.companies_in_scope, 4)
  assert.equal(summary.branches_affected, null, 'v1 agregado: sin atribución por sucursal (honesto)')
})

test('bloques: 6 categorías ordenadas, estado por peor regla, no evaluable en gris', () => {
  const { blocks } = deriveM2(M2_FIXTURE_RUN)
  assert.equal(blocks.length, 6)
  assert.deepEqual(blocks.map((b) => b.order), [1, 2, 3, 4, 5, 6])
  const territorio = blocks.find((b) => b.category === 'territorio')
  assert.equal(territorio.status, 'RED')
  assert.equal(territorio.rules_not_evaluable, 2)
  const solver = blocks.find((b) => b.category === 'solver')
  assert.equal(solver.status, 'RED')
})

test('findings: solo RED/AMBER, con área responsable, evidencia y sin autocorrección', () => {
  const { findings } = deriveM2(M2_FIXTURE_RUN)
  assert.ok(findings.length >= 10)
  for (const f of findings) {
    assert.ok(['RED', 'AMBER'].includes(f.status))
    assert.ok(f.responsible_area, f.rule_code)
    assert.equal(f.owner_status, 'unassigned', 'sin dueño nominal inventado')
    assert.equal(f.responsible_employee_id, null, 'sin persona sin fuente autoritativa')
    assert.equal(f.auto_fix, false)
    assert.equal(f.drilldown_route, null, 'v1 sin detalle por registro')
    assert.equal(f.evidence_reference.evidence_sha256, M2_FIXTURE_RUN.evidence_sha256)
    assert.ok(getRuleByCode(f.rule_code), 'regla del catálogo')
    assert.deepEqual(f.company_scope, [1, 34, 35, 36])
  }
})

test('registros afectados: semántica honesta (conteos suman; promedios NO; ratios usan complemento)', () => {
  const { summary, blocks, results } = deriveM2(M2_FIXTURE_RUN)
  // Promedios (cobertura/confianza) NO son registros:
  assert.equal(results.find((r) => r.rule_code === 'M2-E-01').affected_records, null)
  assert.equal(results.find((r) => r.rule_code === 'M2-E-02').affected_records, null)
  // Ratio con denominador: afectados = complemento (historia SIN actual_kg)
  assert.equal(results.find((r) => r.rule_code === 'M2-F-01').affected_records, 42421 - 7026)
  // Conteos directos:
  assert.equal(results.find((r) => r.rule_code === 'M2-A-01').affected_records, 293)
  // Totales derivados (enteros, sin contaminación de scores):
  const zeroKinds = 293 + 424 + 133 + 144 + 30 + 29 + 37 + 46 + 21 + 48 + 10 + 2202 + 192
  assert.equal(summary.total_affected_records, zeroKinds + (42421 - 7026))
  assert.equal(Number.isInteger(summary.total_affected_records), true)
  const snapshots = blocks.find((b) => b.category === 'snapshots_forecast')
  assert.equal(snapshots.affected_records, 2202 + 192)
})

test('determinismo: misma entrada => misma salida (byte a byte)', () => {
  const a = JSON.stringify(deriveM2(M2_FIXTURE_RUN))
  const b = JSON.stringify(deriveM2(clone()))
  assert.equal(a, b)
})

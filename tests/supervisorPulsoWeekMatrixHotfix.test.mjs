import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  dayKey,
  dayLabel,
  MATRIX_STATE_LABELS,
  presentPulsePayload,
  presentWeekMatrix,
  resolveMatrixCellTone,
  matrixCellToneLabel,
} from '../src/modules/supervisor-ventas/v2/pulso/pulseModel.js'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

const weekMatrixPath = fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/pulso/WeekMatrix.jsx', import.meta.url))

const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'))

const canonicalDays = [
  { date: '2026-08-17', day_key: 'mon', label: 'Lun' },
  { date: '2026-08-18', day_key: 'tue', label: 'Mar' },
  { date: '2026-08-19', day_key: 'wed', label: 'Mié' },
  { date: '2026-08-20', day_key: 'thu', label: 'Jue' },
  { date: '2026-08-21', day_key: 'fri', label: 'Vie' },
  { date: '2026-08-22', day_key: 'sat', label: 'Sáb' },
  { date: '2026-08-23', day_key: 'sun', label: 'Dom' },
]

function matrixWithCells(cells) {
  return {
    available: true,
    title: 'Cobertura semanal',
    days: canonicalDays,
    rows: [{
      label: 'Norte A',
      operational_plan_key: 'SO:1',
      cells,
    }],
  }
}

test('dayLabel/dayKey soportan contrato canónico y legacy string', () => {
  assert.equal(dayLabel(canonicalDays[0]), 'Lun')
  assert.equal(dayKey(canonicalDays[0], 0), '2026-08-17')
  assert.equal(dayLabel('L'), 'L')
  assert.equal(dayKey('L', 3), 'L')
})

test('WeekMatrix renderiza días objeto sin React #31 ni [object Object]', async () => {
  const { Component: WeekMatrix, cleanup } = await loadJsxDefault(weekMatrixPath)
  try {
    const matrix = matrixWithCells(canonicalDays.map(() => ({
      state: 'not_scheduled',
      label: '—',
      tone: 'unknown',
      tone_label: MATRIX_STATE_LABELS.not_scheduled,
    })))
    const html = renderToStaticMarkup(createElement(WeekMatrix, { matrix }))
    for (const day of canonicalDays) {
      assert.match(html, new RegExp(day.label))
    }
    assert.doesNotMatch(html, /\[object Object\]/)
    assert.doesNotMatch(html, /object Object/)
  } finally {
    await cleanup()
  }
})

test('presentWeekMatrix preserva tone resuelto y tone_label coherente por estado', () => {
  const presented = presentWeekMatrix({
    available: true,
    days: canonicalDays,
    rows: [{
      operational_plan_name: 'Norte A',
      operational_plan_key: 'SO:1',
      cells: [
        { date: '2026-08-17', state: 'complete', label: '8/10', tone: 'good' },
        { date: '2026-08-18', state: 'incomplete', label: '3/10' },
        { date: '2026-08-19', state: 'not_scheduled', label: '' },
        { date: '2026-08-20', state: 'scheduled_no_data', label: '' },
        { date: '2026-08-21', state: 'unavailable', label: '', available: false },
        { date: '2026-08-22', state: 'complete', label: '10/10', accessible_label: 'Cobertura completa' },
        { date: '2026-08-23', available: false },
      ],
    }],
  })

  const cells = presented.rows[0].cells
  assert.equal(cells[0].label, '8/10')
  assert.equal(cells[0].tone, 'good')
  assert.equal(cells[0].tone_label, 'Completado')

  assert.equal(cells[1].label, '3/10')
  assert.equal(cells[1].tone, 'attention')
  assert.equal(cells[1].tone_label, MATRIX_STATE_LABELS.incomplete)

  assert.equal(cells[2].tone_label, MATRIX_STATE_LABELS.not_scheduled)
  assert.notEqual(cells[2].tone_label, 'Sin dato')

  assert.equal(cells[3].tone_label, MATRIX_STATE_LABELS.scheduled_no_data)
  assert.notEqual(cells[3].tone_label, 'Sin dato')

  assert.equal(cells[4].tone_label, MATRIX_STATE_LABELS.unavailable)
  assert.notEqual(cells[4].tone_label, 'Sin dato')

  assert.equal(cells[5].tone_label, 'Cobertura completa')
  assert.equal(cells[6].tone_label, MATRIX_STATE_LABELS.unavailable)
})

test('WeekMatrix muestra labels de estado canónicos en UI', async () => {
  const { Component: WeekMatrix, cleanup } = await loadJsxDefault(weekMatrixPath)
  try {
    const matrix = presentWeekMatrix({
      available: true,
      days: canonicalDays,
      rows: [{
        operational_plan_name: 'Norte A',
        operational_plan_key: 'SO:1',
        cells: [
          { date: '2026-08-17', state: 'complete', label: '8/10', tone: 'good' },
          { date: '2026-08-18', state: 'incomplete', label: '3/10' },
          { date: '2026-08-19', state: 'not_scheduled', label: '' },
          { date: '2026-08-20', state: 'scheduled_no_data', label: '' },
          { date: '2026-08-21', state: 'unavailable', label: '', available: false },
          { date: '2026-08-22', state: 'not_scheduled', label: '' },
          { date: '2026-08-23', state: 'not_scheduled', label: '' },
        ],
      }],
    })
    const html = renderToStaticMarkup(createElement(WeekMatrix, { matrix }))
    assert.match(html, />8\/10</)
    assert.match(html, />3\/10</)
    assert.match(html, />Completado</)
    assert.match(html, />Incompleto</)
    assert.match(html, />Sin ruta programada</)
    assert.match(html, />Programado sin datos</)
    assert.match(html, />No disponible</)
    assert.doesNotMatch(html, />\s*Sin dato\s*</)
  } finally {
    await cleanup()
  }
})

test('backend-shaped Semana fixture → presentPulsePayload → WeekMatrix no crashea', async () => {
  const raw = fixture('pulseBackendSemana.fixture.json')
  const presented = presentPulsePayload(raw)
  assert.ok(Array.isArray(presented.week_matrix.days))
  assert.equal(typeof presented.week_matrix.days[0], 'object')
  assert.equal(presented.week_matrix.days[0].label, 'Lun')

  const { Component: WeekMatrix, cleanup } = await loadJsxDefault(weekMatrixPath)
  try {
    const html = renderToStaticMarkup(createElement(WeekMatrix, { matrix: presented.week_matrix }))
    assert.match(html, />Lun</)
    assert.match(html, />Dom</)
    assert.match(html, />8\/10</)
    assert.match(html, />3\/10</)
    assert.match(html, />Completado</)
    assert.match(html, />Incompleto</)
    assert.match(html, />Sin ruta programada</)
    assert.doesNotMatch(html, /\[object Object\]/)
  } finally {
    await cleanup()
  }
})

test('resolveMatrixCellTone y matrixCellToneLabel usan estado cuando tone falta', () => {
  const incomplete = { state: 'incomplete', label: '3/10' }
  const tone = resolveMatrixCellTone(incomplete)
  assert.equal(tone, 'attention')
  assert.equal(matrixCellToneLabel(incomplete, tone), MATRIX_STATE_LABELS.incomplete)
  assert.notEqual(matrixCellToneLabel(incomplete, tone), 'Sin dato')
})

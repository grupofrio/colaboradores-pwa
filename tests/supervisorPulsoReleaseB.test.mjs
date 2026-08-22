import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ATTENTION_TYPES,
  matrixCellLabel,
  presentCustomerMovement,
  presentExecution,
  presentMonthTargets,
  presentPulsePayload,
  presentSameTranche,
  presentWeekMatrix,
  PULSE_HORIZONS,
  PULSE_HORIZON_KEYS,
  pulseFocusTarget,
  toneLabel,
} from '../src/modules/supervisor-ventas/v2/pulso/pulseModel.js'
import { normalizePulseResponse, PULSE_STATUS } from '../src/modules/supervisor-ventas/v2/pulso/usePulse.js'
import { buildPulseRequest } from '../src/modules/supervisor-ventas/v2/pulso/pulseApi.js'

const src = (relative) => readFileSync(fileURLToPath(new URL(`../src/${relative}`, import.meta.url)), 'utf8')
const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'))

test('Pulso expone exactamente Ahora, Ayer, Semana y Mes', () => {
  assert.deepEqual(PULSE_HORIZON_KEYS, ['ahora', 'ayer', 'semana', 'mes'])
  assert.deepEqual(PULSE_HORIZONS.map((item) => item.label), ['Ahora', 'Ayer', 'Semana', 'Mes'])

  const tab = src('modules/supervisor-ventas/v2/pulso/PulsoTab.jsx')
  assert.match(tab, /horizon === 'semana'/)
  assert.match(tab, /horizon === 'mes'/)
  assert.match(tab, /<SemanaView/)
  assert.match(tab, /<MesView/)
})

test('attention incluye tipos Release B', () => {
  const releaseB = [
    'first_visit_late',
    'km_deviation_high',
    'km_deviation_low',
    'customer_purchase_drop',
    'weekly_customer_missing',
    'execution_pattern',
    'capacity_over',
    'recurrent_issue',
    'persistent_issue',
  ]
  for (const type of releaseB) {
    assert.ok(ATTENTION_TYPES.includes(type), `missing ${type}`)
  }
  assert.equal(ATTENTION_TYPES.length, 17)
})

test('pulse_focus acepta semana y mes además de ayer', () => {
  assert.deepEqual(pulseFocusTarget({
    kind: 'pulse_focus',
    horizon: 'semana',
    block: 'matrix',
  }), {
    horizon: 'semana',
    block: 'matrix',
    entityId: null,
  })
  assert.deepEqual(pulseFocusTarget({
    kind: 'pulse_focus',
    horizon: 'mes',
    block: 'targets',
    entity_id: 7,
  }), {
    horizon: 'mes',
    block: 'targets',
    entityId: 7,
  })
  assert.equal(pulseFocusTarget({
    kind: 'pulse_focus',
    horizon: 'invalid',
    block: 'matrix',
  }), null)
})

test('presentPulsePayload proyecta bloques semana y mes sin confundir unavailable con cero', () => {
  const semana = presentPulsePayload({
    partial: true,
    attention: [{ id: 1, type: 'weekly_customer_missing', severity: 'warning', title: 'Faltante' }],
    blocks: {
      customer_movement: {
        available: true,
        cards: [
          { key: 'missing', label: 'Faltantes', count: 4, tone: 'attention' },
          { key: 'drops', label: 'Caídas', count: 2, tone: 'critical' },
        ],
      },
      week_matrix: {
        available: true,
        days: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
        rows: [{
          label: 'Cobertura',
          cells: [{ pct: 82, tone: 'good' }, { available: false }],
        }],
      },
      same_tranche: {
        available: true,
        delta_pct: 5,
        money: {
          available: true,
          consolidated: true,
          currency_status: 'known_single',
          currency: 'MXN',
          sales_total: 12000,
        },
      },
      execution: {
        available: false,
        summary: 'Ejecución no disponible.',
      },
    },
  })

  assert.equal(semana.customer_movement.cards[0].count, 4)
  assert.equal(semana.week_matrix.rows[0].cells[1].label, 'Sin dato')
  assert.equal(semana.same_tranche.money.sales_total, 12000)
  assert.equal(semana.execution.available, false)
  assert.doesNotMatch(semana.execution.summary || '', /\b0\b/)

  const mes = presentPulsePayload({
    blocks: {
      targets: {
        available: true,
        sales: { label: 'Venta', amount: 50000, currency: 'MXN' },
        frozen_demand: { available: false, label: 'Demanda congelada' },
        direct_target: { label: 'Meta directa', amount: 55000, currency: 'MXN' },
        pace: { pct: 91, tone: 'good', label: 'Ritmo' },
      },
      trend: { available: true, summary: 'Sube la venta', direction: 'up' },
      products: {
        available: true,
        items: [{ name: 'Helado 1L', change_pct: -8, tone: 'attention' }],
      },
      recurrent_execution: {
        available: true,
        items: [{ label: 'Puntualidad', count: 2, tone: 'watch' }],
      },
    },
  })

  assert.equal(presentMonthTargets(mes.targets).sales.amount, 50000)
  assert.equal(mes.targets.frozen_demand.available, false)
  assert.equal(mes.products.items[0].name, 'Helado 1L')
  assert.equal(mes.recurrent_execution.items[0].count, 2)
})

test('matrixCellLabel y toneLabel nunca dependen solo del color', () => {
  assert.equal(matrixCellLabel({ available: false }), 'Sin dato')
  assert.equal(matrixCellLabel({ pct: 75 }), '75%')
  assert.equal(toneLabel('critical'), 'Crítico')
  assert.equal(toneLabel('unknown'), 'Sin dato')
})

test('SemanaView compone movimiento, matriz, same-tranche y ejecución', () => {
  const semana = src('modules/supervisor-ventas/v2/pulso/SemanaView.jsx')
  assert.match(semana, /CustomerMovementBlock/)
  assert.match(semana, /WeekMatrix/)
  assert.match(semana, /SameTrancheSection|same_tranche/)
  assert.match(semana, /PurchaseDropList/)
  assert.match(semana, /focusPulseBlock/)
  assert.match(semana, /presentPulsePayload/)

  const movement = presentCustomerMovement({
    available: true,
    cards: [{ key: 'missing', label: 'Faltantes', count: 3, tone: 'attention' }],
  })
  assert.equal(movement.cards[0].label, 'Faltantes')

  const matrix = presentWeekMatrix({
    available: true,
    days: ['L', 'M'],
    rows: [{ label: 'Cobertura', cells: [{ pct: 80, tone: 'good' }, { available: false }] }],
  })
  assert.equal(matrix.rows[0].cells[1].label, 'Sin dato')
})

test('MesView compone objetivos, tendencia, productos y ejecución recurrente', () => {
  const mes = src('modules/supervisor-ventas/v2/pulso/MesView.jsx')
  assert.match(mes, /MonthTargets/)
  assert.match(mes, /CustomerMovementBlock/)
  assert.match(mes, /data-pulse-block="trend"/)
  assert.match(mes, /data-pulse-block="products"/)
  assert.match(mes, /data-pulse-block="recurrent_execution"/)
  assert.match(mes, /focusPulseBlock/)

  const targets = presentMonthTargets({
    available: true,
    sales: { label: 'Venta', amount: 40000, currency: 'MXN' },
    pace: { pct: 88, tone: 'watch', label: 'Ritmo' },
  })
  assert.equal(targets.sales.amount, 40000)
  assert.equal(targets.pace.tone_label, 'Vigilar')
})

test('buildPulseRequest acepta semana y mes', () => {
  assert.deepEqual(buildPulseRequest('semana').data, { horizon: 'semana' })
  assert.deepEqual(buildPulseRequest('mes').data, { horizon: 'mes' })
  assert.match(buildPulseRequest('semana').meta.request_id, /^pulse-/)
  assert.throws(() => buildPulseRequest('trimestre'), /Horizonte de pulso inválido/)
})

test('estados loading/ready/partial/unavailable/feature_disabled/auth_error/network_error', () => {
  assert.equal(normalizePulseResponse({ status: 'ok', data: {} }).status, PULSE_STATUS.READY)
  assert.equal(normalizePulseResponse({ status: 'ok', data: { partial: true } }).status, PULSE_STATUS.PARTIAL)
  assert.equal(normalizePulseResponse({ status: 'error', code: 'FEATURE_DISABLED' }).status, PULSE_STATUS.FEATURE_DISABLED)
  assert.equal(normalizePulseResponse({ status: 'error', code: 'UNAUTHORIZED' }).status, PULSE_STATUS.AUTH_ERROR)
  assert.equal(normalizePulseResponse({ status: 'error', code: 'NETWORK' }).status, PULSE_STATUS.NETWORK_ERROR)
  assert.equal(normalizePulseResponse(null).status, PULSE_STATUS.UNAVAILABLE)

  const tab = src('modules/supervisor-ventas/v2/pulso/PulsoTab.jsx')
  assert.match(tab, /PULSE_STATUS\.LOADING/)
  assert.match(tab, /PULSE_STATUS\.PARTIAL/)
  assert.match(tab, /PULSE_STATUS\.UNAVAILABLE/)
  assert.match(tab, /PULSE_STATUS\.FEATURE_DISABLED/)
  assert.match(tab, /PULSE_STATUS\.AUTH_ERROR/)
  assert.match(tab, /PULSE_STATUS\.NETWORK_ERROR/)
})

test('presentCustomerMovement no expone conteos cuando available=false', () => {
  const movement = presentCustomerMovement({
    available: false,
    summary: 'Movimiento de clientes no disponible.',
    cards: [{ key: 'missing', label: 'Faltantes', count: 0 }],
  })
  assert.equal(movement.available, false)
  assert.equal(movement.cards.length, 0)
  assert.match(movement.summary, /no disponible/i)
})

test('CSS mantiene 4 horizontes en desktop y tap targets >=44px', () => {
  const css = src('modules/supervisor-ventas/v2/pulso/pulso.css')
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /min-height: 44px/)
  assert.match(css, /\.pulse-movement-grid/)
  assert.match(css, /\.pulse-matrix-cell/)
})

test('PulsoTab handleCta usa horizon del focus CTA', () => {
  const tab = src('modules/supervisor-ventas/v2/pulso/PulsoTab.jsx')
  assert.match(tab, /setHorizon\(target\.horizon\)/)
  assert.doesNotMatch(tab, /setHorizon\('ayer'\)/)
})

test('backend-shaped Semana fixture → presentPulsePayload E2E', () => {
  const raw = fixture('pulseBackendSemana.fixture.json')
  assert.equal(raw.contract, 'gf.salesops.supervisor.pulse/2')
  const presented = presentPulsePayload(raw)
  assert.ok(presented.week_matrix.rows.length > 0)
  assert.ok(presented.week_matrix.rows[0].cells.length > 0)
  assert.equal(presented.week_matrix.rows[0].cells[0].label, '8/10')
  const movement = presented.customer_movement
  assert.equal(movement.cards.find((c) => c.key === 'recovered')?.count, 2)
  assert.equal(movement.cards.find((c) => c.key === 'prospects_converted')?.count, 1)
  assert.equal(movement.cards.find((c) => c.key === 'prospects_activated')?.count, 3)
  assert.equal(movement.cards.find((c) => c.key === 'pending_to_buy')?.count, 4)
  assert.equal(movement.cards.find((c) => c.key === 'opportunities')?.count, 5)
  assert.equal(presented.execution.punctuality.value, 1)
  assert.equal(presented.same_tranche.delta_pct, 20)
})

test('backend-shaped Mes fixture → targets/trend/products/recurrent E2E', () => {
  const raw = fixture('pulseBackendMes.fixture.json')
  const presented = presentPulsePayload(raw)
  assert.equal(presentMonthTargets(presented.targets).sales.amount, 50000)
  assert.equal(presented.targets.frozen_demand.amount, 48000)
  assert.equal(presented.targets.direct_target.amount, 55000)
  assert.equal(presented.trend.direction, 'up')
  assert.equal(presented.products.items[0].name, 'Helado 1L')
  assert.equal(presented.recurrent_execution.items[0].label, 'Puntualidad')
  assert.equal(presented.customer_movement.cards.find((c) => c.key === 'recovered')?.count, 6)
})

test('backend-shaped Ahora fixture → recovered today visible', () => {
  const raw = fixture('pulseBackendAhora.fixture.json')
  const presented = presentPulsePayload(raw)
  const recovered = presented.customer_movement.cards.find((c) => c.key === 'recovered')
  assert.equal(recovered?.count, 1)
  assert.equal(recovered?.label, 'Recuperados')
  const ahora = src('modules/supervisor-ventas/v2/pulso/AhoraView.jsx')
  assert.match(ahora, /CustomerMovementBlock/)
  assert.match(ahora, /Movimiento hoy/)
})

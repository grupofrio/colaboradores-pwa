import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'

import { buildSupervisorV2SessionProjection } from '../src/modules/supervisor-ventas/v2/sessionProjection.js'
import {
  computePulseFlag,
  readPulseFlagFrom,
} from '../src/modules/supervisor-ventas/v2/pulso/pulseFlag.js'
import {
  ATTENTION_TYPES,
  clearPulseSessionProjection,
  compactState,
  conversionState,
  diagnosis,
  formatCashCopy,
  presentMoney,
  presentPulsePayload,
  pulseFocusTarget,
  sliceAttention,
} from '../src/modules/supervisor-ventas/v2/pulso/pulseModel.js'
import {
  normalizePulseResponse,
  PULSE_STATUS,
  usePulse,
} from '../src/modules/supervisor-ventas/v2/pulso/usePulse.js'
import {
  buildPulseRequest,
  requestSupervisorPulse,
  SUPERVISOR_PULSE_PATH,
} from '../src/modules/supervisor-ventas/v2/pulso/pulseApi.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const src = (relative) => readFileSync(fileURLToPath(new URL(`../src/${relative}`, import.meta.url)), 'utf8')

test('dark launch: OFF conserva Hoy y ON habilita Pulso, siempre fail-closed', () => {
  assert.equal(computePulseFlag({ globalEnabled: true, branchEnabled: true }).enabled, true)
  assert.equal(computePulseFlag({ globalEnabled: true, branchEnabled: false }).enabled, false)
  assert.equal(computePulseFlag({ globalEnabled: false, branchEnabled: true }).enabled, false)
  assert.equal(computePulseFlag({}).enabled, false)

  const projected = buildSupervisorV2SessionProjection({
    capabilities: { supervisorPulse: true },
    branch: { supervisor_pulse_enabled: true },
  })
  assert.equal(readPulseFlagFrom(projected, projected.capabilities).enabled, true)
  assert.equal(readPulseFlagFrom({ branch: { supervisor_pulse_enabled: 'true' } }, { supervisorPulse: true }).enabled, false)

  const app = src('App.jsx')
  assert.match(app, /function EquipoHome\(\)/)
  assert.match(app, /pulseEnabled \? <PulsoTab \/> : <HoyTab \/>/)
  assert.doesNotMatch(src('modules/supervisor-ventas/v2/pulso/pulseFlag.js'), /localStorage\.getItem|supervisor_pulse=1/)
})

test('rail reemplaza únicamente Hoy por Pulso y conserva el filtro de Copiloto', () => {
  const shell = src('modules/supervisor-ventas/v2/SupervisorV2Shell.jsx')
  assert.match(shell, /const PULSE_TAB = Object\.freeze\(\{ key: 'pulso'/)
  assert.match(shell, /\[PULSE_TAB, \.\.\.V2_TABS\.slice\(1\)\]/)
  assert.match(shell, /available\.filter\(\(t\) => t\.key !== 'copiloto'\)/)
  for (const key of ['radar', 'rutas', 'clientes', 'prospectos', 'pendientes', 'copiloto', 'mas']) {
    assert.match(shell, new RegExp(`key: '${key}'`))
  }
})

test('Pulso conserva horizontes Ahora y Ayer de Release A', () => {
  const model = src('modules/supervisor-ventas/v2/pulso/pulseModel.js')
  const tab = src('modules/supervisor-ventas/v2/pulso/PulsoTab.jsx')
  assert.match(model, /\{ key: 'ahora', label: 'Ahora' \}/)
  assert.match(model, /\{ key: 'ayer', label: 'Ayer' \}/)
  assert.match(tab, /horizon === 'ahora'/)
  assert.match(tab, /horizon === 'ayer'/)
  assert.match(tab, /<AhoraView/)
  assert.match(tab, /<AyerView/)
})

test('attention acepta tipos Release A, limita la portada a 5 con Ver todas', () => {
  const releaseA = [
    'route_not_departed',
    'route_zero_visits',
    'close_cash_composed',
    'open_routes_over_7d',
    'load_pending_acceptance',
    'gps_stale',
    'coverage_gap',
    'conversion_watch',
  ]
  for (const type of releaseA) {
    assert.ok(ATTENTION_TYPES.includes(type), `missing ${type}`)
  }
  const items = releaseA.map((type, index) => ({
    id: index,
    type,
    severity: index < 2 ? 'critical' : 'warning',
  }))
  assert.equal(sliceAttention(items).length, 5)
  const list = src('modules/supervisor-ventas/v2/pulso/AttentionList.jsx')
  assert.match(list, /max = 5/)
  assert.match(list, />\s*Ver todas\s*</)
})

test('cash copy nunca usa símbolo desnudo y cubre moneda única, múltiple y desconocida', () => {
  assert.equal(formatCashCopy({
    available: true,
    pending: true,
    currency_status: 'known_single',
    amount: 1250,
    currency: 'MXN',
  }), 'Caja pendiente · 1,250 MXN')
  assert.equal(formatCashCopy({
    available: true,
    pending: true,
    currency_status: 'known_multiple',
    breakdown: [{ currency: 'MXN' }, { currency: 'USD' }],
  }), 'Caja pendiente en 2 monedas')
  assert.equal(formatCashCopy({
    available: true,
    pending: true,
    currency_status: 'unknown',
  }), 'Caja pendiente · moneda por confirmar')
  assert.doesNotMatch(formatCashCopy({
    available: true,
    pending: true,
    currency_status: 'known_single',
    amount: 10,
    currency: 'MXN',
  }), /(^|\s)\$(\s|$)/)
})

test('Ayer presenta Crédito otorgado, diagnóstico y calidad fuera de attention', () => {
  assert.deepEqual(diagnosis(70, 70), {
    kind: 'execution',
    summary: 'La principal desviación está en ejecución (cobertura).',
  })
  assert.equal(diagnosis(90, 45).kind, 'conversion')
  assert.equal(diagnosis(70, 45).kind, 'both')
  assert.equal(conversionState(82).label, 'En orden')
  assert.equal(conversionState(55).label, 'Vigilar')

  const ayer = src('modules/supervisor-ventas/v2/pulso/AyerView.jsx')
  const model = src('modules/supervisor-ventas/v2/pulso/pulseModel.js')
  assert.match(ayer, /Crédito otorgado/)
  assert.match(ayer, />Métrica de calidad</)
  assert.match(ayer, /presentPulsePayload/)
  assert.match(model, /raw\.attention \|\| raw\.attention_items/)
  assert.doesNotMatch(ayer, /attention\s*=\s*.*quality/)
  assert.match(ayer, /to="\/equipo\/recuperacion"/)
  assert.match(ayer, />Contado</)
  assert.match(ayer, />Ticket</)
})

test('pulse_focus expande rutas en Ayer y enfoca la fila sin navegar a Rutas', () => {
  assert.deepEqual(pulseFocusTarget({
    kind: 'pulse_focus',
    horizon: 'ayer',
    block: 'routes',
    entity_id: 42,
  }), {
    horizon: 'ayer',
    block: 'routes',
    entityId: 42,
  })
  const tab = src('modules/supervisor-ventas/v2/pulso/PulsoTab.jsx')
  const ayer = src('modules/supervisor-ventas/v2/pulso/AyerView.jsx')
  assert.match(tab, /setHorizon\(target\.horizon\)/)
  assert.doesNotMatch(`${tab}\n${ayer}`, /\/equipo\/rutas/)
  assert.match(ayer, /setRoutesOpen\(true\)/)
  assert.match(ayer, /focusPulseRoute/)
  assert.match(src('modules/supervisor-ventas/v2/pulso/pulseModel.js'), /scrollIntoView/)
})

function createControlledLoader() {
  const requests = []
  const loadPulse = (horizon) => new Promise((resolve, reject) => {
    requests.push({ horizon, resolve, reject })
  })
  return { loadPulse, requests }
}

function PulseHarness({ horizon, loadPulse, onState }) {
  onState(usePulse(horizon, { loadPulse }))
  return null
}

test('usePulse ignora una respuesta obsoleta al cambiar de horizonte', async () => {
  const { loadPulse, requests } = createControlledLoader()
  const states = []
  let renderer

  try {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(PulseHarness, {
        horizon: 'ahora',
        loadPulse,
        onState: (state) => states.push(state),
      }))
    })
    assert.equal(requests.length, 1)

    await act(async () => {
      renderer.update(React.createElement(PulseHarness, {
        horizon: 'ayer',
        loadPulse,
        onState: (state) => states.push(state),
      }))
    })
    assert.equal(requests.length, 2)

    await act(async () => {
      requests[0].resolve({ status: 'ok', data: { marker: 'stale' } })
      await Promise.resolve()
    })
    assert.notEqual(states.at(-1).data?.marker, 'stale')

    await act(async () => {
      requests[1].resolve({ status: 'ok', data: { marker: 'current' } })
      await Promise.resolve()
    })
    assert.equal(states.at(-1).status, PULSE_STATUS.READY)
    assert.equal(states.at(-1).data.marker, 'current')
  } finally {
    await act(async () => { renderer?.unmount() })
  }
})

test('normaliza estados parcial, feature, auth, red y no disponible', () => {
  assert.equal(normalizePulseResponse({ status: 'ok', data: { partial: true } }).status, PULSE_STATUS.PARTIAL)
  assert.equal(normalizePulseResponse({ status: 'error', code: 'FEATURE_DISABLED' }).status, PULSE_STATUS.FEATURE_DISABLED)
  assert.equal(normalizePulseResponse({ status: 'error', code: 'UNAUTHORIZED' }).status, PULSE_STATUS.AUTH_ERROR)
  assert.equal(normalizePulseResponse({ status: 'error', code: 'NETWORK' }).status, PULSE_STATUS.NETWORK_ERROR)
  assert.equal(normalizePulseResponse(null).status, PULSE_STATUS.UNAVAILABLE)
})

test('pulse API envía POST directo con horizon y request_id, sin scope forjable', async () => {
  const originalStorage = globalThis.localStorage
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  let captured
  globalThis.localStorage = {
    getItem: (key) => key === 'gf_session' ? JSON.stringify({
      session_token: 'session-test',
      gf_employee_token: 'employee-test',
      employee_id: 90,
      company_id: 35,
      warehouse_id: 18,
    }) : null,
    removeItem() {},
  }
  globalThis.window = { dispatchEvent() {} }
  globalThis.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: { status: 'ok', data: {} } }),
    }
  }

  try {
    const request = buildPulseRequest('ayer', 'pulse-test-id')
    assert.deepEqual(request, {
      meta: { request_id: 'pulse-test-id' },
      data: { horizon: 'ayer' },
    })
    await requestSupervisorPulse('ahora')
    assert.equal(captured.url, `/odoo-api${SUPERVISOR_PULSE_PATH}`)
    assert.equal(captured.options.method, 'POST')
    assert.equal(captured.body.params.data.horizon, 'ahora')
    assert.match(captured.body.params.meta.request_id, /^pulse-/)
    assert.deepEqual(Object.keys(captured.body.params.meta), ['request_id'])
  } finally {
    globalThis.localStorage = originalStorage
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('Ayer money: single / multi / unknown nunca muestran total cross-currency', () => {
  const single = presentMoney({
    available: true,
    consolidated: true,
    currency_status: 'known_single',
    currency: 'MXN',
    sales_total: 18450,
    cash: 10000,
    credit: 8450,
    orders: 10,
    avg_ticket: 1845,
    breakdown: [],
  })
  assert.equal(single.consolidated, true)
  assert.equal(single.sales_total, 18450)
  assert.equal(single.currency, 'MXN')

  const multi = presentMoney({
    available: true,
    consolidated: false,
    currency_status: 'known_multiple',
    currency: null,
    sales_total: 120,
    cash: 120,
    credit: 0,
    orders: 2,
    avg_ticket: 60,
    breakdown: [
      { currency: 'MXN', sales_total: 100 },
      { currency: 'USD', sales_total: 20 },
    ],
  })
  assert.equal(multi.consolidated, false)
  assert.equal(multi.sales_total, null)
  assert.equal(multi.cash, null)
  assert.equal(multi.avg_ticket, null)

  const unknown = presentMoney({
    available: true,
    consolidated: false,
    currency_status: 'unknown',
    sales_total: 99,
    currency: null,
    breakdown: [],
  })
  assert.equal(unknown.sales_total, null)

  const legacyCross = presentPulsePayload({
    blocks: {
      resultado: {
        sales: { total: 120, orders: 2, avg_ticket: 60, currency: null },
        collection: { cash: 100, credit: 20, currency: null },
      },
    },
  })
  assert.equal(legacyCross.resultado.sales_amount, null)
  assert.equal(legacyCross.resultado.currency, null)

  const ayer = src('modules/supervisor-ventas/v2/pulso/AyerView.jsx')
  assert.match(ayer, /moneyValue\(amount, currency\)/)
  assert.match(ayer, /if \(!currency\) return '—'/)
  assert.match(ayer, /Venta en .* monedas|Venta en \{/)
  assert.match(ayer, /Venta · moneda por confirmar/)
  assert.match(ayer, /Crédito otorgado/)
})

test('FEATURE_DISABLED limpia proyección Pulse; network/unavailable no', () => {
  const session = {
    capabilities: { supervisorPulse: true, supervisorV2: true },
    branch: { supervisor_pulse_enabled: true, supervisor_v2_enabled: true },
  }
  const cleared = clearPulseSessionProjection(session)
  assert.equal(cleared.capabilities.supervisorPulse, false)
  assert.equal(cleared.branch.supervisor_pulse_enabled, false)
  assert.equal(cleared.capabilities.supervisorV2, true)

  assert.equal(
    readPulseFlagFrom(cleared, cleared.capabilities).enabled,
    false,
  )

  const tab = src('modules/supervisor-ventas/v2/pulso/PulsoTab.jsx')
  assert.match(tab, /clearPulseSessionProjection/)
  assert.match(tab, /PULSE_STATUS\.FEATURE_DISABLED/)
  assert.match(tab, /navigate\('\/equipo'/)
  assert.doesNotMatch(tab, /SERVICE_UNAVAILABLE[\s\S]{0,80}clearPulseSessionProjection/)

  assert.equal(
    normalizePulseResponse({ status: 'error', code: 'SERVICE_UNAVAILABLE' }).status,
    PULSE_STATUS.UNAVAILABLE,
  )
  assert.equal(
    normalizePulseResponse({ status: 'error', code: 'FEATURE_DISABLED' }).status,
    PULSE_STATUS.FEATURE_DISABLED,
  )
})

test('AHORA partial + estado unavailable nunca renderiza ceros falsos', () => {
  const unavailable = compactState(
    presentPulsePayload({
      partial: true,
      capabilities: { day_control_available: false, routes_available: false },
      blocks: {
        estado_compacto: { available: false, reason: 'routes_unavailable' },
      },
    }),
  )
  assert.equal(unavailable.available, false)
  assert.equal(unavailable.value, null)
  assert.match(unavailable.summary, /no disponible/i)
  assert.doesNotMatch(unavailable.summary, /0 salieron/)
  assert.doesNotMatch(unavailable.summary, /0 sin salida/)
  assert.doesNotMatch(unavailable.summary, /0 rutas/)

  // Defensive zeros must not leak when available=false even if present.
  const withZeros = compactState({
    estado_compacto: {
      available: false,
      routes_total: 0,
      departed: 0,
      not_departed: 0,
    },
  })
  assert.equal(withZeros.available, false)
  assert.doesNotMatch(withZeros.summary || '', /0 salieron · 0 sin salida · 0 rutas/)

  const usable = compactState(
    presentPulsePayload({
      partial: false,
      blocks: {
        estado_compacto: {
          available: true,
          routes_total: 4,
          departed: 2,
          not_departed: 2,
        },
      },
    }),
  )
  assert.equal(usable.available, true)
  assert.equal(usable.summary, '2 salieron · 2 sin salida · 4 rutas')
})

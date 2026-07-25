import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { Children } from 'react'
import { MemoryRouter } from 'react-router-dom'
import {
  createElement,
  loadJsxDefault,
  renderToStaticMarkup,
} from './helpers/renderJsx.mjs'
import {
  DAY_CONTROL_FIXTURE,
  DAY_CONTROL_FIXTURE_DEGRADED,
} from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import {
  markerRenderKey,
  priorityRenderKey,
} from '../src/modules/supervisor-ventas/dayControl/renderKeys.js'
import { stateCopy } from '../src/modules/supervisor-ventas/dayControl/state.js'

const {
  Component: ScreenSupervisorToday,
  cleanup,
} = await loadJsxDefault(fileURLToPath(
  new URL('../src/modules/supervisor-ventas/ScreenSupervisorToday.jsx', import.meta.url),
))

after(cleanup)

const NOW_MS = Date.parse('2026-01-15T15:15:00Z')

function screenElement({
  todayState = { kind: 'valid', payload: DAY_CONTROL_FIXTURE },
  yesterdayState = null,
  activeDay = 'today',
  onSelectDay = () => {},
  onRefresh = () => {},
} = {}) {
  return createElement(
    MemoryRouter,
    { initialEntries: ['/equipo'] },
    createElement(ScreenSupervisorToday, {
      todayState,
      yesterdayState,
      activeDay,
      onSelectDay,
      onRefresh,
      nowMs: NOW_MS,
    }),
  )
}

function render(props) {
  const originalConsoleError = console.error
  console.error = (message, ...args) => {
    if (
      typeof message === 'string'
      && message.startsWith('Warning: useLayoutEffect does nothing on the server')
    ) return
    originalConsoleError(message, ...args)
  }
  try {
    return renderToStaticMarkup(screenElement(props))
  } finally {
    console.error = originalConsoleError
  }
}

function assertInOrder(html, texts) {
  let previous = -1
  for (const text of texts) {
    const current = html.indexOf(text)
    assert.ok(current > previous, `"${text}" debe aparecer después de la sección anterior`)
    previous = current
  }
}

function assertHeadingsInOrder(html, texts) {
  assertInOrder(
    html,
    texts.map((text) => `>${text}</h2>`),
  )
}

test('render válido muestra orden operativo exacto y solo el día activo', () => {
  const yesterdayPayload = structuredClone(DAY_CONTROL_FIXTURE)
  yesterdayPayload.routes[0].route_name = 'Ruta exclusiva de ayer'

  const html = render({
    yesterdayState: { kind: 'valid', payload: yesterdayPayload },
  })

  assertHeadingsInOrder(html, [
    'Estado de jornada',
    'Prioridades',
    'Rutas',
    'Resultado comercial',
    'Cierre y caja',
  ])
  assert.match(html, />Hoy</)
  assert.match(html, />Ayer</)
  assert.match(html, /aria-pressed="true"[^>]*>Hoy</)
  assert.match(html, /aria-pressed="false"[^>]*>Ayer</)
  assert.match(html, /Ruta Demo Uno/)
  assert.doesNotMatch(html, /Ruta exclusiva de ayer/)
  assert.doesNotMatch(html, /Mapa|Radar|tiempo real/i)
})

test('Ayer activo no mezcla ni sustituye su venta principal con la de Hoy', () => {
  const todayPayload = structuredClone(DAY_CONTROL_FIXTURE)
  const yesterdayPayload = structuredClone(DAY_CONTROL_FIXTURE)
  todayPayload.summary.sales_day_amount = 1234
  yesterdayPayload.summary.sales_day_amount = 9876

  const html = render({
    todayState: { kind: 'valid', payload: todayPayload },
    yesterdayState: { kind: 'valid', payload: yesterdayPayload },
    activeDay: 'yesterday',
  })
  const salesTotal = html.match(
    /data-testid="commercial-sales-total"[^>]*>([^<]*)</,
  )?.[1] || ''

  assert.match(salesTotal, /9[,.]876/)
  assert.doesNotMatch(salesTotal, /1[,.]234/)
  assert.match(html, /aria-pressed="true"[^>]*>Ayer</)
})

test('activeDay fuera de la allowlist usa Hoy y nunca selecciona otro payload', () => {
  const yesterdayPayload = structuredClone(DAY_CONTROL_FIXTURE)
  yesterdayPayload.routes[0].route_name = 'Ruta que no debe mostrarse'

  const html = render({
    yesterdayState: { kind: 'valid', payload: yesterdayPayload },
    activeDay: 'tomorrow',
  })

  assert.match(html, /Ruta Demo Uno/)
  assert.doesNotMatch(html, /Ruta que no debe mostrarse/)
  assert.match(html, /aria-pressed="true"[^>]*>Hoy</)
})

test('CSS SSR conserva selector aria-pressed sin entidades escapadas', () => {
  const html = render()
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''

  assert.match(css, /\[aria-pressed=true\]/)
  assert.doesNotMatch(css, /&quot;/)
})

test('capability apagada o dato null muestra ausencia honesta, nunca un cero monetario falso', () => {
  const capabilityOff = structuredClone(DAY_CONTROL_FIXTURE)
  capabilityOff.capabilities.sales_day_available = false
  capabilityOff.capabilities.closure_cash_available = false
  capabilityOff.summary.sales_day_available = false
  capabilityOff.summary.sales_day_amount = null
  capabilityOff.summary.close.cash_pending_amount = null
  capabilityOff.summary.close.cash_pending_currency = null

  const html = render({
    todayState: { kind: 'valid', payload: capabilityOff },
  })
  const salesTotal = html.match(
    /data-testid="commercial-sales-total"[^>]*>([^<]*)</,
  )?.[1] || ''

  assert.match(html, /Información no disponible|Sin dato/)
  assert.match(salesTotal, /Información no disponible|Sin dato/)
  assert.doesNotMatch(salesTotal, /\$0(?:[.,]00)?/)
  assert.doesNotMatch(html, /Moneda no disponible[^<]*\$0/)
})

test('salida desconocida queda separada de tarde', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.summary.departed_late = 0
  payload.summary.departure_unknown = 1

  const html = render({
    todayState: { kind: 'valid', payload },
  })

  assert.match(html, /Salieron tarde[\s\S]*>0</)
  assert.match(html, /Sin dato de salida[\s\S]*>1</)
})

test('muestra cinco etapas y aclara que validated es conciliación de sistema', () => {
  const html = render()
  const closureHtml = html.slice(html.indexOf('data-testid="supervisor-closure-overview"'))

  assertInOrder(closureHtml, [
    'Abierta',
    'Cerrada',
    'Corte hecho',
    'Liquidada',
    'Validada',
  ])
  assert.match(html, /Validada significa conciliación de sistema/)
  assert.doesNotMatch(html, /recepción física|devolución recibida|merma recibida/i)
})

test('prioridades conservan razón y ×N; todos los links provienen de allowlists internas', () => {
  const html = render()
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])

  assert.match(html, /2 refills pendientes de aceptación/)
  assert.match(html, /×2/)
  assert.ok(hrefs.length > 0)
  for (const href of hrefs) {
    assert.ok(
      href === '/equipo/cierre'
        || href === '/equipo/sin-visitar'
        || href === '/equipo/recuperacion'
        || href === '/equipo/pronostico'
        || href === '/equipo/clientes'
        || /^\/equipo\/vendedor\/\d+\?route_id=\d+$/.test(href.replaceAll('&amp;', '&')),
      `href no permitido: ${href}`,
    )
    assert.doesNotMatch(href, /^https?:|javascript:|\/gf\//i)
  }
})

test('keys de prioridades distinguen cierres contractuales de rutas distintas', () => {
  const first = {
    type: 'closure_pending',
    entityType: 'route',
    entityId: 5101,
    routeId: 5101,
    reason: 'Cierre pendiente',
  }
  const second = {
    ...first,
    entityId: 5102,
    routeId: 5102,
  }

  assert.notEqual(priorityRenderKey(first), priorityRenderKey(second))
  assert.notEqual(
    priorityRenderKey({ ...first, entityId: null, routeId: null, reason: 'Primera fila' }),
    priorityRenderKey({ ...first, entityId: null, routeId: null, reason: 'Segunda fila' }),
  )
})

test('keys de marcadores combinan tipo de incidencia y stop contractual', () => {
  const first = {
    id: 7101,
    stopId: 6201,
    name: 'Marcador Demo',
    recordedAt: 'registrado 14:40',
  }
  const second = {
    ...first,
    stopId: 6202,
  }

  assert.notEqual(markerRenderKey(first), markerRenderKey(second))
  assert.match(markerRenderKey(first), /7101/)
  assert.match(markerRenderKey(first), /6201/)
})

test('posición y cargas no disponibles se explican sin superficie de mapa ni promesa realtime', () => {
  const html = render({
    todayState: { kind: 'valid', payload: DAY_CONTROL_FIXTURE_DEGRADED },
  })

  assert.match(html, /Información de posición no disponible/)
  assert.match(html, /Información de cargas no disponible/)
  assert.doesNotMatch(html, /Mapa|Radar|tiempo real/i)
})

test('usa ModuleHeader y freshness neutral con la procedencia del servidor', () => {
  const html = render()

  assert.match(html, /data-testid="kold-module-header"/)
  assert.match(html, /Operación de hoy/)
  assert.match(html, /BR-DEMO Sucursal Demo/)
  assert.match(html, /Zona horaria por defecto del sistema/)
  assert.match(html, /data-testid="kold-freshness"/)
  assert.match(html, /Datos medidos hace 10 min/)
  assert.match(html, /Fuente: Control diario del servidor/)
})

test('todos los estados no válidos del día seleccionado usan StateScreen sin filtrar el otro día', () => {
  const states = [
    {
      state: stateCopy('idle'),
      copy: /Información no disponible/,
    },
    {
      state: stateCopy('loading'),
      copy: /Cargando la operación/,
    },
    {
      state: stateCopy('error'),
      copy: /No pudimos cargar la operación/,
    },
    {
      state: { kind: 'empty', payload: { date: '2026-01-14' } },
      copy: /No hay rutas para este día/,
    },
    {
      state: stateCopy('invalid_contract'),
      copy: /formato no compatible/,
    },
    {
      state: stateCopy('date_unavailable'),
      copy: /La fecha no está disponible/,
    },
    {
      state: stateCopy('unauthorized'),
      copy: /Tu sesión necesita renovarse/,
    },
    {
      state: stateCopy('forbidden'),
      copy: /No tienes permiso para ver esta operación/,
    },
    {
      state: stateCopy('no_scope'),
      copy: /No hay una sucursal operativa asignada/,
    },
    {
      state: stateCopy('ambiguous_scope'),
      copy: /más de una sucursal operativa/,
    },
  ]

  for (const { state, copy } of states) {
    const html = render({
      todayState: { kind: 'valid', payload: DAY_CONTROL_FIXTURE },
      yesterdayState: state,
      activeDay: 'yesterday',
    })
    assert.match(html, /data-testid="kold-state-screen"/)
    assert.match(html, copy)
    assert.doesNotMatch(html, /Ruta Demo Uno/)
  }
})

test('Reintentar del estado seleccionado llama onRefresh y los tabs llaman onSelectDay', () => {
  let refreshCount = 0
  const selected = []
  const screen = ScreenSupervisorToday({
    todayState: {
      kind: 'invalid_contract',
      title: 'La información llegó en un formato no compatible',
      detail: 'Intenta nuevamente.',
      retryable: true,
    },
    yesterdayState: { kind: 'valid', payload: DAY_CONTROL_FIXTURE },
    activeDay: 'today',
    onRefresh: () => { refreshCount += 1 },
    onSelectDay: (day) => { selected.push(day) },
    nowMs: NOW_MS,
  })
  const screenChildren = Children.toArray(screen.props.children)
  const tabsElement = Children.toArray(screenChildren[1].props.children)[0]
  const renderedTabs = tabsElement.type(tabsElement.props)
  const tabButtons = Children.toArray(renderedTabs.props.children)
  const selectedStateElement = screenChildren[2]
  const stateScreenElement = selectedStateElement.type(selectedStateElement.props)

  assert.equal(tabButtons[1].props.children, 'Ayer')
  assert.equal(stateScreenElement.props.actionLabel, 'Reintentar')
  stateScreenElement.props.onAction()
  tabButtons[1].props.onClick()
  assert.equal(refreshCount, 1)
  assert.deepEqual(selected, ['yesterday'])
})

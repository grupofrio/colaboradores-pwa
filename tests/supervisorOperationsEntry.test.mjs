import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

import {
  createElement,
  loadJsxDefault,
  renderToStaticMarkup,
} from './helpers/renderJsx.mjs'
import { DAY_CONTROL_FIXTURE } from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import { stateCopy } from '../src/modules/supervisor-ventas/dayControl/state.js'

const entryPath = resolve(
  'src/modules/supervisor-ventas/dayControl/SupervisorOperationsSwitch.jsx',
)
const loaded = await loadJsxDefault(entryPath)
const { SupervisorOperationsSwitch } = loaded.mod

after(async () => {
  await loaded.cleanup()
})

function Marker({ text }) {
  return createElement('div', null, text)
}

function renderSwitch(todayState) {
  return renderToStaticMarkup(createElement(SupervisorOperationsSwitch, {
    todayState,
    yesterdayState: { kind: 'idle' },
    activeDay: 'today',
    onSelectDay: () => {},
    onRefresh: () => {},
    LegacyComponent: () => createElement(Marker, { text: 'LEGACY_CONTROL' }),
    OperationsComponent: () => createElement(Marker, { text: 'NEW_OPERATIONS' }),
  }))
}

test('disabled monta exclusivamente el legado', () => {
  const html = renderSwitch({ kind: 'disabled' })
  assert.match(html, /LEGACY_CONTROL/)
  assert.ok(!html.includes('NEW_OPERATIONS'))
  assert.ok(!html.includes('kold-state-screen'))
})

test('valid y empty montan exclusivamente el workspace nuevo', () => {
  for (const todayState of [
    { kind: 'valid', payload: DAY_CONTROL_FIXTURE },
    { kind: 'empty', payload: { ...DAY_CONTROL_FIXTURE, routes: [] } },
  ]) {
    const html = renderSwitch(todayState)
    assert.match(html, /NEW_OPERATIONS/)
    assert.ok(!html.includes('LEGACY_CONTROL'))
  }
})

test('permiso, scope, fecha, red y contrato nunca caen al legado', () => {
  for (const kind of [
    'unauthorized',
    'forbidden',
    'no_scope',
    'ambiguous_scope',
    'date_unavailable',
    'invalid_contract',
    'error',
  ]) {
    const html = renderSwitch(stateCopy(kind))
    assert.ok(!html.includes('LEGACY_CONTROL'), kind)
    assert.ok(!html.includes('NEW_OPERATIONS'), kind)
    assert.match(html, /data-testid="kold-state-screen"/, kind)
  }
})

test('loading se presenta como estado seguro, no como legado', () => {
  const html = renderSwitch({
    kind: 'loading',
    title: 'Cargando la operación',
    detail: 'Estamos consultando la información del día.',
    retryable: false,
  })
  assert.match(html, /Cargando la operación/)
  assert.ok(!html.includes('LEGACY_CONTROL'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import {
  buildCustomerCreateDraft,
  buildSupervisorCustomerCreatePayload,
  getCustomerCreateValidationError,
} from '../src/modules/supervisor-ventas/customerCreateState.js'
import {
  buildCustomerEditorDraft,
  buildSupervisorCustomerUpdatePayload,
  normalizeSupervisorCustomer,
} from '../src/modules/supervisor-ventas/customerEditorState.js'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

const loadView = async (rel) => (
  await loadJsxDefault(fileURLToPath(new URL('../' + rel, import.meta.url)))
).Component

test('create: name requerido y payload allowlist', () => {
  assert.match(getCustomerCreateValidationError(buildCustomerCreateDraft({})), /obligatorio/)
  const ok = buildSupervisorCustomerCreatePayload({
    name: ' Farmacia Nueva ',
    phone: '7331112222',
    email: 'a@b.co',
    latitude: '18.3',
    longitude: '-99.5',
  })
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.values, {
    name: 'Farmacia Nueva',
    phone: '7331112222',
    email: 'a@b.co',
    latitude: 18.3,
    longitude: -99.5,
  })
})

test('create: lat sin lng rechazado', () => {
  assert.match(getCustomerCreateValidationError({
    name: 'X', latitude: '1', longitude: '',
  }), /juntos/)
})

test('edit payload never includes name; create payload requires name', () => {
  const original = normalizeSupervisorCustomer({ id: 9, name: 'A', phone: '1' })
  const payload = buildSupervisorCustomerUpdatePayload(9, original, {
    ...buildCustomerEditorDraft(original),
    name: 'B',
    phone: '2',
  })
  assert.equal('name' in payload.values, false)
  assert.equal(payload.values.phone, '2')
})

test('CustomerFormPanel create renders name editable; edit name read-only', async () => {
  const Form = await loadView('src/modules/supervisor-ventas/v2/clientes/CustomerFormPanel.jsx')
  const createHtml = renderToStaticMarkup(createElement(Form, {
    mode: 'create',
    draft: buildCustomerCreateDraft({ name: '' }),
    onChange: () => {},
    onSubmit: () => {},
    onCancel: () => {},
  }))
  assert.match(createHtml, /data-testid="clientes-create-panel"/)
  assert.match(createHtml, /Crear cliente/)
  assert.doesNotMatch(createHtml, /Eliminar cliente/)

  const editHtml = renderToStaticMarkup(createElement(Form, {
    mode: 'edit',
    draft: buildCustomerEditorDraft({ name: 'Fijo', phone: '' }),
    nameReadOnly: true,
    onChange: () => {},
    onSubmit: () => {},
    onCancel: () => {},
  }))
  assert.match(editHtml, /data-testid="clientes-edit-panel"/)
  assert.match(editHtml, /readOnly/)
  assert.doesNotMatch(editHtml, /Eliminar cliente/)
})

test('api surface exports create and list without auto-add-to-plan coupling', async () => {
  const api = await import('../src/modules/supervisor-ventas/api.js')
  assert.equal(typeof api.createSupervisorCustomer, 'function')
  assert.equal(typeof api.listSupervisorCustomersCatalog, 'function')
  assert.equal(typeof api.updateSupervisorCustomer, 'function')
  assert.equal(typeof api.removeCustomerFromRoutePlan, 'function')
  assert.equal(typeof api.addCustomerToRoutePlan, 'function')
  // create module source must not call addCustomerToRoutePlan
  const fs = await import('node:fs')
  const tab = fs.readFileSync(new URL('../src/modules/supervisor-ventas/v2/tabs/ClientesTab.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(tab, /localStorage\.getItem|localStorage\.setItem/)
  assert.match(tab, /createSupervisorCustomer/)
  assert.match(tab, /updateSupervisorCustomer/)
  assert.doesNotMatch(tab, /Eliminar cliente/)
  assert.doesNotMatch(tab, /addCustomerToRoutePlan/)
})

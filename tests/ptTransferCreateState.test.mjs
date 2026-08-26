import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveCreatedPtTransferState } from '../src/modules/almacen-pt/ptTransferCreateState.js'

test('resolveCreatedPtTransferState trusts orchestrate pending payload even when pending list is still empty', () => {
  const state = resolveCreatedPtTransferState({
    result: {
      transfer_id: 547,
      transfer_ref: 'PTT/00547',
      transfer_state: 'pending',
      en_picking_ids: [-547],
    },
    pendingTransfers: [],
    destinationName: 'CIGU/Existencias',
  })

  assert.equal(state.backendId, -547)
  assert.equal(state.syncState, 'backend_pending')
  assert.equal(state.publishedPending, true)
  assert.equal(state.warningMessage, '')
  assert.match(state.successMessage, /PTT\/00547/)
})

test('resolveCreatedPtTransferState falls back to local pending only when orchestrate gives no pending evidence', () => {
  const state = resolveCreatedPtTransferState({
    result: {},
    pendingTransfers: [],
    destinationName: 'CIGU/Existencias',
  })

  assert.equal(state.backendId, null)
  assert.equal(state.syncState, 'local_pending_only')
  assert.equal(state.publishedPending, false)
  assert.match(state.warningMessage, /Odoo no publico aun un pendiente visible/i)
})

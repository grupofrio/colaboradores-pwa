import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDeliveredTurnBackTarget } from '../src/modules/produccion/turnoEntregadoNavigation.js'

test('Turno entregado vuelve a Inicio cuando está embebido en la ruta base de producción', () => {
  assert.equal(
    resolveDeliveredTurnBackTarget({ pathname: '/produccion' }),
    '/',
  )
})

test('Turno entregado también vuelve a Inicio cuando vive en su subruta propia para evitar el bucle con /produccion', () => {
  assert.equal(
    resolveDeliveredTurnBackTarget({ pathname: '/produccion/turno-entregado' }),
    '/',
  )
})

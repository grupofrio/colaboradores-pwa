import test from 'node:test'
import assert from 'node:assert/strict'

let transientHistory = null
try {
  transientHistory = await import('../src/lib/transientHistory.js')
} catch {
  // RED: el contrato todavia no existe.
}

function createHistory(pathname = '/equipo') {
  const entries = [{ pathname, state: { idx: 7 } }]
  let index = 0

  return {
    get state() { return entries[index].state },
    get pathname() { return entries[index].pathname },
    get length() { return entries.length },
    pushState(state) {
      entries.splice(index + 1, entries.length, { pathname: entries[index].pathname, state })
      index += 1
    },
    back() {
      if (index > 0) index -= 1
    },
  }
}

test('historial efimero: Atrás consume el marcador sin cambiar de ruta', () => {
  assert.ok(transientHistory, 'falta implementar src/lib/transientHistory.js')

  const history = createHistory('/equipo')
  const {
    MORE_SHEET_HISTORY_KEY,
    pushTransientHistoryEntry,
    consumeTransientHistoryEntry,
  } = transientHistory

  pushTransientHistoryEntry(history, MORE_SHEET_HISTORY_KEY)

  assert.equal(history.length, 2, 'abrir el sheet agrega una entrada')
  assert.equal(history.pathname, '/equipo', 'la entrada conserva la ruta')
  assert.equal(history.state.idx, 7, 'preserva el estado existente de React Router')
  assert.equal(history.state[MORE_SHEET_HISTORY_KEY], true, 'marca la entrada como transitoria')

  assert.equal(consumeTransientHistoryEntry(history, MORE_SHEET_HISTORY_KEY), true)
  assert.equal(history.pathname, '/equipo', 'Atrás cierra el sheet sin navegar a otra ruta')
  assert.equal(history.state[MORE_SHEET_HISTORY_KEY], undefined, 'el marcador fue consumido')
})

test('historial efimero: cerrar sin marcador no navega', () => {
  assert.ok(transientHistory, 'falta implementar src/lib/transientHistory.js')

  const history = createHistory('/equipo')
  const { MORE_SHEET_HISTORY_KEY, consumeTransientHistoryEntry } = transientHistory

  assert.equal(consumeTransientHistoryEntry(history, MORE_SHEET_HISTORY_KEY), false)
  assert.equal(history.pathname, '/equipo')
  assert.equal(history.length, 1)
})

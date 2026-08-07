import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SUPERVISOR_DAY_CONTROL_BANNED,
  findSupervisorDayControlLeaks,
} from '../scripts/check_supervisor_day_control_leak.mjs'

test('detecta cada sentinel sintético o exclusivo de radar', () => {
  for (const sentinel of SUPERVISOR_DAY_CONTROL_BANNED) {
    assert.deepEqual(
      findSupervisorDayControlLeaks([
        { name: 'chunk.js', content: `prefix ${sentinel} suffix` },
      ]),
      [{ name: 'chunk.js', sentinel }],
    )
  }
})

test('un bundle sin fixtures supervisor queda limpio', () => {
  assert.deepEqual(
    findSupervisorDayControlLeaks([
      { name: 'screen.js', content: 'Operación de hoy' },
      { name: 'styles.css', content: '.supervisor-ops-grid{display:grid}' },
    ]),
    [],
  )
})

test('el reporte estructurado no conserva el contenido del asset', () => {
  const secretContent = 'private-prefix BR-DEMO private-suffix'
  const [leak] = findSupervisorDayControlLeaks([
    { name: 'screen.js', content: secretContent },
  ])

  assert.deepEqual(Object.keys(leak).sort(), ['name', 'sentinel'])
  assert.ok(!JSON.stringify(leak).includes(secretContent))
})

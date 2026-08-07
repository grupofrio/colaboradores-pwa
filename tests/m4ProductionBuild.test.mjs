import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { findM4FixtureLeaks } from '../scripts/check_m4_fixture_leak.mjs'

test('scanner detecta metadata exclusiva del fixture y acepta assets limpios', () => {
  assert.deepEqual(findM4FixtureLeaks([
    { name: 'index.js', content: 'runtime normal' },
  ]), [])
  const leaks = findM4FixtureLeaks([
    { name: 'fixture.js', content: '3eeffd889b5902fb31f88f6573589afde0b166bc' },
  ])
  assert.equal(leaks.length, 1)
  assert.equal(leaks[0].marker, '3eeffd889b5902fb31f88f6573589afde0b166bc')
})

test('scanner detecta conteos medidos incrustados en metadata de producción', () => {
  for (const marker of [
    '438 partners',
    '2,333',
    '1,620',
    '78 de 584 (13.36%)',
    '168 de 752 (22.34%)',
    '"total_incidences":12158',
    '"confirmed_count":12606',
    '"product_line_count":13778',
    '"warning_count":6537',
    '"exploratory_signal_count":5621',
  ]) {
    const leaks = findM4FixtureLeaks([{ name: 'index.js', content: `catálogo: ${marker}` }])
    assert.equal(leaks.length, 1, `no detectó ${marker}`)
    assert.equal(leaks[0].marker, marker)
  }
})

test('build productivo ejecuta el scanner y Vite usa loader productivo', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
  assert.match(pkg.scripts.build, /check_m4_fixture_leak\.mjs/)
  assert.match(vite, /demoFixtureLoader\.prod\.js/)
  assert.match(vite, /demoFixtureLoader\.dev\.js/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Contrato de la Fase 1 de Produccion: las escrituras nuevas (energia por
// periodos, compresores, aceite, salmuera) van SIEMPRE contra controladores de
// Odoo con validacion server-side. Nada de ORM ni `sudo` desde el navegador.
//
// Este test es el candado: si alguien vuelve a meter `createUpdate`/`readModel`
// en esta ruta, se cae aqui y no en produccion.

const API_SOURCE = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
const PLANT_ENERGY_SOURCE = readFileSync(
  new URL('../src/modules/shared/plantEnergyAPI.js', import.meta.url), 'utf8',
)
const SUPERVISION_HUB = readFileSync(
  new URL('../src/modules/supervision/ScreenSupervision.jsx', import.meta.url), 'utf8',
)
const MI_TURNO = readFileSync(
  new URL('../src/modules/produccion/ScreenMiTurno.jsx', import.meta.url), 'utf8',
)
const CONTROL_TURNO = readFileSync(
  new URL('../src/modules/supervision/ScreenControlTurno.jsx', import.meta.url), 'utf8',
)
const ENERGIA = readFileSync(
  new URL('../src/modules/supervision/ScreenEnergia.jsx', import.meta.url), 'utf8',
)

/** Quita comentarios: lo que se prohibe es CODIGO, no explicarlo por escrito. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const ROUTES = [
  '/api/production/energy/periods/create',
  '/api/production/energy/summary',
  '/api/production/compressor/status',
  '/api/production/compressor/toggle',
  '/api/production/compressor/oil',
  '/api/production/expected-vs-real',
  '/api/production/brine/reading',
]

test('las 7 rutas de la fase estan registradas en el router directo', () => {
  const block = API_SOURCE.split('const PLANT_ENERGY_ROUTES = new Set([')[1]
  assert.ok(block, 'PLANT_ENERGY_ROUTES no existe en src/lib/api.js')
  const registered = block.split('])')[0]
  ROUTES.forEach((route) => {
    assert.ok(registered.includes(route), `ruta no registrada: ${route}`)
  })
})

test('las rutas de la fase se llaman con envoltura JSON-RPC (odooJson)', () => {
  assert.match(
    API_SOURCE,
    /PLANT_ENERGY_ROUTES\.has\(cleanPath\)[\s\S]{0,120}odooJson\(cleanPath/,
    'las rutas nuevas deben resolverse con odooJson, no con ORM client-side',
  )
})

test('plantEnergyAPI no toca el ORM desde el navegador', () => {
  const code = stripComments(PLANT_ENERGY_SOURCE)
  ;['createUpdate', 'readModel', 'readModelSorted', 'sudo'].forEach((forbidden) => {
    assert.ok(!code.includes(forbidden), `plantEnergyAPI.js no debe usar ${forbidden}`)
  })
})

test('plantEnergyAPI no manda employee_id: la identidad va por token', () => {
  assert.ok(!stripComments(PLANT_ENERGY_SOURCE).includes('employee_id'))
})

test('la seccion de compresores vive en el hub Y en el turno de barra', () => {
  assert.match(SUPERVISION_HUB, /<CompresoresSection/)
  assert.match(MI_TURNO, /<CompresoresSection/)
})

test('la seccion de compresores en el turno exige turno abierto de barra', () => {
  assert.match(MI_TURNO, /isBarras && shift\.state === 'in_progress'[\s\S]{0,160}<CompresoresSection/)
})

test('el cierre de turno llama validateSupervisorPin', () => {
  assert.match(CONTROL_TURNO, /validateSupervisorPin\(closePin/)
})

test('la tarjeta de tanque del hub navega a una ruta que el supervisor puede abrir', () => {
  assert.ok(SUPERVISION_HUB.includes('/supervision/tanque/'))
  assert.ok(!SUPERVISION_HUB.includes('/produccion/tanque/'))
})

test('la salmuera se guarda por el endpoint con historico', () => {
  assert.match(SUPERVISION_HUB, /createBrineReadingWithHistory/)
  assert.ok(!SUPERVISION_HUB.includes('createBrineReading(buildBrineReadingPayload'))
})

test('la captura de energia tiene voz', () => {
  assert.match(ENERGIA, /VoiceInputButton/)
  assert.match(ENERGIA, /context_id="form_energy_reading"/)
})

test('la pantalla de energia no multiplica ni suma para decidir', () => {
  // El x1200 y el consumo por periodo los calcula Odoo. Si alguien reintroduce
  // el multiplicador en el cliente, este test se cae.
  const code = stripComments(ENERGIA)
  assert.ok(!code.includes('1200'))
  assert.ok(!/kwh_value\s*-\s*/.test(code))
})

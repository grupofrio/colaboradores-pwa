// Encuestas — comportamiento REAL de los shims con `fetch` simulado (Codex P2).
// Los otros tests de encuestas son source-scan (regex sobre el archivo); estos
// ejercitan `api()` de verdad: la traducción de envelope, la señal de éxito y el
// no-fingir-éxito. Cubre lo que un source-scan no vería: que ante `ok:false` o un
// payload sin URL, el shim devuelva `success:false` y no una lista/URL fantasma.
import test from 'node:test'
import assert from 'node:assert/strict'

import { api } from '../src/lib/api.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

function localStorageMock() {
  let store = {}
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
  }
}

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(payload) } }
}

function setSession() {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test', employee_id: 718, company_id: 34, warehouse_id: 29,
  }))
}

test.beforeEach(() => {
  globalThis.localStorage = localStorageMock()
  globalThis.window = { dispatchEvent() {} }
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

// ── /pwa-survey-start ────────────────────────────────────────────────────────

test('survey-start: con survey_url del servidor devuelve success y la URL', async () => {
  setSession()
  globalThis.fetch = async () => jsonResponse(200, {
    ok: true, message: 'OK',
    data: {
      survey_id: 2, user_input_id: 9,
      survey_access_token: 'SURV', answer_access_token: 'ANS', state: 'new',
      survey_url: '/survey/start/SURV?answer_token=ANS',
    },
  })
  const res = await api('POST', '/pwa-survey-start', { survey_id: 2 })
  assert.equal(res.success, true)
  assert.equal(res.data.survey_url, '/survey/start/SURV?answer_token=ANS',
    'la URL la arma el servidor con el token de la ENCUESTA + answer_token')
})

test('survey-start: sin survey_url NO finge éxito (aunque venga answer token)', async () => {
  setSession()
  // Payload "casi bueno": trae token de respuesta pero NO la survey_url. Un
  // source-scan no lo notaría; aquí el shim debe rechazarlo, no abrir una URL rota.
  globalThis.fetch = async () => jsonResponse(200, {
    ok: true, data: { user_input_id: 9, answer_access_token: 'ANS' },
  })
  const res = await api('POST', '/pwa-survey-start', { survey_id: 2 })
  assert.equal(res.success, false, 'sin survey_url del servidor no hay éxito')
  assert.equal(res.data, null)
})

test('survey-start: ok:false se propaga como fallo con su motivo', async () => {
  setSession()
  globalThis.fetch = async () => jsonResponse(200, {
    ok: false, code: 'no_disponible', user_message: 'Esa encuesta no está disponible para ti.',
  })
  const res = await api('POST', '/pwa-survey-start', { survey_id: 2 })
  assert.equal(res.success, false)
  assert.equal(res.code, 'no_disponible')
  assert.match(res.message, /no está disponible/)
})

// ── /pwa-surveys (listado) ──────────────────────────────────────────────────

test('surveys: ok:true con lista la entrega; ok:false NO se disfraza de vacío', async () => {
  setSession()
  globalThis.fetch = async () => jsonResponse(200, { ok: true, data: [{ id: 1, survey_id: 2, survey_title: 'X', state: 'new' }] })
  const okRes = await api('GET', '/pwa-surveys')
  assert.equal(okRes.success, true)
  assert.ok(Array.isArray(okRes.data) && okRes.data.length === 1)

  globalThis.fetch = async () => jsonResponse(200, { ok: false, code: 'forbidden' })
  const failRes = await api('GET', '/pwa-surveys')
  assert.equal(failRes.success, false, 'un 403 no es "no tienes encuestas"')
  assert.equal(failRes.code, 'forbidden')
})

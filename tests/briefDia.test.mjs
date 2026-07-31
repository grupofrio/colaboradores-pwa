import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  fetchBriefHtml, readEmployeeToken, isBypassSession,
  BRIEF_PATH, BRIEF_STATE, MAX_BRIEF_BYTES,
} from '../src/modules/brief/briefApi.js'
import { getModulesForRole, getModuleById } from '../src/modules/registry.js'
import { getNavModules } from '../src/lib/navModel.js'

const HTML_HEADERS = { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) }
const JSON_HEADERS = { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'application/json' : null) }

const SESSION = { employee_id: 718, session_token: 'h.p.s', role: 'supervisor_ventas', odoo_employee_token: 'tok-real-abc' }

function okResponse(body = '<html><body>brief</body></html>', headers = HTML_HEADERS) {
  return { ok: true, status: 200, headers, text: async () => body }
}

// ── El contrato con n8n: qué se manda y qué NO ───────────────────────────────

test('manda el gf_employee_token en el header X-GF-Employee-Token', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return okResponse() }

  const result = await fetchBriefHtml({ session: SESSION, fetchImpl })

  assert.equal(result.state, BRIEF_STATE.OK)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, BRIEF_PATH)
  assert.equal(calls[0].opts.method, 'GET')
  assert.equal(calls[0].opts.headers['X-GF-Employee-Token'], 'tok-real-abc')
})

test('NO manda el session_token (JWT alg:none) ni identidad en la URL ni en el body', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return okResponse() }

  await fetchBriefHtml({
    session: { ...SESSION, session_token: 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoiZGlyZWNjaW9uX2dlbmVyYWwifQ.odoo' },
    fetchImpl,
  })

  const { url, opts } = calls[0]
  const serialized = JSON.stringify(opts.headers)
  assert.ok(!url.includes('?'), 'la URL no lleva query params')
  assert.ok(!url.includes('token'), 'ninguna credencial viaja en la URL')
  assert.equal(opts.body, undefined, 'un GET de lectura no lleva body')
  assert.ok(!serialized.includes('Authorization'), 'no se manda el Bearer forjado en el cliente')
  assert.ok(!serialized.includes('employee_id'), 'la identidad NO la declara el cliente')
  assert.ok(!serialized.includes('supervisor_ventas'), 'el rol NO lo declara el cliente')
})

// ── Fail-closed: cada rechazo tiene su estado propio ─────────────────────────

test('sesión de bypass admin: no llama al endpoint (no tiene credencial real)', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return okResponse() }

  const result = await fetchBriefHtml({
    session: { employee_id: 1, session_token: 'h.p.bypass', role: 'direccion_general', _bypass: true },
    fetchImpl,
  })

  assert.equal(result.state, BRIEF_STATE.BYPASS)
  assert.equal(called, false, 'ni siquiera se intenta: el bypass nunca tuvo gf_employee_token')
})

test('sesión sin gf_employee_token: no llama al endpoint', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return okResponse() }

  const result = await fetchBriefHtml({ session: { employee_id: 718, session_token: 'h.p.s' }, fetchImpl })

  assert.equal(result.state, BRIEF_STATE.NO_SESSION)
  assert.equal(called, false)
})

test('401 → unauthorized · 403 → forbidden (no se colapsan en un error genérico)', async () => {
  const r401 = await fetchBriefHtml({
    session: SESSION,
    fetchImpl: async () => ({ ok: false, status: 401, headers: JSON_HEADERS, text: async () => '' }),
  })
  const r403 = await fetchBriefHtml({
    session: SESSION,
    fetchImpl: async () => ({ ok: false, status: 403, headers: JSON_HEADERS, text: async () => '' }),
  })

  assert.equal(r401.state, BRIEF_STATE.UNAUTHORIZED)
  assert.equal(r403.state, BRIEF_STATE.FORBIDDEN)
  assert.equal(r401.html, '')
  assert.equal(r403.html, '')
})

test('200 con JSON (error disfrazado de n8n) NO se monta como brief', async () => {
  const result = await fetchBriefHtml({
    session: SESSION,
    fetchImpl: async () => ({ ok: true, status: 200, headers: JSON_HEADERS, text: async () => '{"code":"UNAUTHORIZED"}' }),
  })

  assert.equal(result.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(result.reason, 'bad_content_type')
  assert.equal(result.html, '')
})

test('200 con cuerpo vacío o desmedido no se monta', async () => {
  const vacio = await fetchBriefHtml({ session: SESSION, fetchImpl: async () => okResponse('   ') })
  assert.equal(vacio.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(vacio.reason, 'empty_body')

  const enorme = await fetchBriefHtml({
    session: SESSION,
    fetchImpl: async () => okResponse('x'.repeat(MAX_BRIEF_BYTES + 1)),
  })
  assert.equal(enorme.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(enorme.reason, 'too_large')
})

test('la red caída no lanza: devuelve estado, nunca revienta la pantalla', async () => {
  const result = await fetchBriefHtml({
    session: SESSION,
    fetchImpl: async () => { throw new Error('Failed to fetch') },
  })

  assert.equal(result.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(result.reason, 'network')
})

test('readEmployeeToken / isBypassSession son fail-closed ante basura', () => {
  for (const bad of [null, undefined, 'texto', 42, [], { odoo_employee_token: 123 }]) {
    assert.equal(readEmployeeToken(bad), '')
  }
  assert.equal(readEmployeeToken({ gf_employee_token: '  tok  ' }), 'tok')
  assert.equal(isBypassSession({ _bypass: 'true' }), false, 'solo el booleano exacto cuenta')
  assert.equal(isBypassSession(null), false)
})

// ── El embed: aislamiento del iframe (no negociable) ─────────────────────────

test('el iframe usa srcDoc con sandbox allow-scripts y SIN allow-same-origin', () => {
  const src = readFileSync(new URL('../src/modules/brief/ScreenBriefDia.jsx', import.meta.url), 'utf8')

  assert.ok(src.includes('srcDoc={html}'), 'el HTML se monta por srcDoc, no por src (un src no puede llevar headers)')

  // Se inspecciona el ATRIBUTO real, no el texto del archivo: los comentarios
  // que explican por qué NO va allow-same-origin mencionan la cadena.
  const sandboxes = [...src.matchAll(/sandbox="([^"]*)"/g)].map((m) => m[1])
  assert.ok(sandboxes.length > 0, 'el iframe declara sandbox')
  assert.deepEqual(
    [...new Set(sandboxes)],
    ['allow-scripts'],
    'todo sandbox declarado en el archivo vale exactamente allow-scripts',
  )
  assert.ok(!/<iframe[^>]*\ssrc=/.test(src), 'nada de <iframe src>: choca con X-Frame-Options: DENY de vercel.json')
})

// ── Visibilidad de la pestaña ────────────────────────────────────────────────

test('solo supervisor_ventas ve el módulo del brief', () => {
  assert.ok(getModulesForRole('supervisor_ventas').some((m) => m.id === 'brief_dia'))

  for (const role of ['direccion_general', 'jefe_ruta', 'gerente_sucursal', 'auxiliar_admin', 'operador_barra', '']) {
    assert.ok(
      !getModulesForRole(role).some((m) => m.id === 'brief_dia'),
      `${role || '(sin rol)'} NO debe ver la pestaña del brief`,
    )
  }
})

test('el módulo apunta a /brief y sale en la nav de Aida junto a Equipo', () => {
  const module = getModuleById('brief_dia')
  assert.equal(module.route, '/brief')
  assert.equal(module.status, 'live')

  const nav = getNavModules({ employee_id: 718, session_token: 'h.p.s', role: 'supervisor_ventas' })
  assert.deepEqual(nav.slice(0, 2).map((m) => m.id), ['supervisor_ventas', 'brief_dia'])
})

test('la ruta /brief está montada detrás de ModuleRoleRoute', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.ok(
    /path="\/brief"\s+element=\{<ModuleRoleRoute moduleId="brief_dia">/.test(app),
    '/brief no puede quedar sin guard de rol',
  )
})

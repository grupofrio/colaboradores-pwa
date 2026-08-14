import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  fetchBriefHtml, readEmployeeToken, isBypassSession, isValidBriefDate, buildBriefUrl,
  BRIEF_STATE, MAX_BRIEF_BYTES,
} from '../src/modules/brief/briefApi.js'
import { BRIEFS, getBriefById, briefSupportsDate } from '../src/modules/brief/briefCatalog.js'
import { getModulesForRole, getModuleById } from '../src/modules/registry.js'
import { getNavModules, getVisibleModulesForSession } from '../src/lib/navModel.js'

const HTML_HEADERS = { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) }
const JSON_HEADERS = { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'application/json' : null) }

const VENTAS = getBriefById('ventas')
const PRODUCCION = getBriefById('produccion')
const GERENCIA = getBriefById('gerencia')

const SESSION = { employee_id: 718, session_token: 'h.p.s', role: 'supervisor_ventas', odoo_employee_token: 'tok-real-abc' }

function okResponse(body = '<html><body>brief</body></html>', headers = HTML_HEADERS) {
  return { ok: true, status: 200, headers, text: async () => body }
}

// ── El contrato con n8n: qué se manda y qué NO ───────────────────────────────

test('cada variante manda el gf_employee_token a SU endpoint', async () => {
  for (const brief of BRIEFS) {
    const calls = []
    const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return okResponse() }

    const result = await fetchBriefHtml({ session: SESSION, brief, fetchImpl })

    assert.equal(result.state, BRIEF_STATE.OK, brief.id)
    assert.equal(calls[0].url, brief.endpoint, `${brief.id} pega a su propio endpoint`)
    assert.equal(calls[0].opts.method, 'GET')
    assert.equal(calls[0].opts.headers['X-GF-Employee-Token'], 'tok-real-abc')
    assert.equal(calls[0].opts.cache, 'no-store')
    assert.equal(calls[0].opts.credentials, 'omit')
  }
})

test('NO manda el session_token (JWT alg:none) ni identidad en la URL ni en el body', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return okResponse() }

  await fetchBriefHtml({
    session: { ...SESSION, session_token: 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoiZGlyZWNjaW9uX2dlbmVyYWwifQ.odoo' },
    brief: VENTAS,
    fetchImpl,
  })

  const { url, opts } = calls[0]
  const serialized = JSON.stringify(opts.headers)
  assert.ok(!url.includes('?'), 'la URL de ventas no lleva query params')
  assert.ok(!url.includes('token'), 'ninguna credencial viaja en la URL')
  assert.equal(opts.body, undefined, 'un GET de lectura no lleva body')
  assert.ok(!serialized.includes('Authorization'), 'no se manda el Bearer forjado en el cliente')
  assert.ok(!serialized.includes('employee_id'), 'la identidad NO la declara el cliente')
  assert.ok(!serialized.includes('supervisor_'), 'el rol NO lo declara el cliente')
})

// ── El parámetro de fecha (solo producción) ──────────────────────────────────

test('solo producción acepta ?d=YYYY-MM-DD; ventas y gerencia no', () => {
  assert.equal(briefSupportsDate(PRODUCCION), true)
  assert.equal(briefSupportsDate(VENTAS), false)
  assert.equal(briefSupportsDate(GERENCIA), false)
  assert.equal(buildBriefUrl(GERENCIA, '2026-07-29'), '/api-n8n/brief-gerencia', 'gerencia ignora la fecha')

  assert.equal(buildBriefUrl(PRODUCCION, '2026-07-29'), '/api-n8n/brief-produccion?d=2026-07-29')
  assert.equal(buildBriefUrl(PRODUCCION, ''), '/api-n8n/brief-produccion', 'sin fecha ⇒ default del endpoint ("ayer")')
  assert.equal(buildBriefUrl(VENTAS, '2026-07-29'), '/api-n8n/brief-aida', 'ventas ignora la fecha')
})

test('una fecha inválida NUNCA llega a la URL (fail-closed, sin concatenar entrada cruda)', () => {
  const basura = [
    '2026-13-01', '2026-02-31', '2026-7-9', 'ayer', '', null, undefined, 42,
    "2026-07-29' OR 1=1", '2026-07-29&admin=1', '../../etc/passwd', '2026-07-29#x',
  ]
  for (const value of basura) {
    assert.equal(isValidBriefDate(value), false, `${String(value)} no es fecha válida`)
    assert.equal(
      buildBriefUrl(PRODUCCION, value),
      '/api-n8n/brief-produccion',
      `${String(value)} se omite en vez de viajar en la URL`,
    )
  }
  assert.equal(isValidBriefDate('2026-02-28'), true)
  assert.equal(isValidBriefDate('2024-02-29'), true, 'bisiesto real')
  assert.equal(isValidBriefDate('2026-02-29'), false, 'no bisiesto')
})

test('la fecha llega al fetch de producción', async () => {
  const calls = []
  const fetchImpl = async (url) => { calls.push(url); return okResponse() }

  await fetchBriefHtml({ session: SESSION, brief: PRODUCCION, date: '2026-07-29', fetchImpl })

  assert.equal(calls[0], '/api-n8n/brief-produccion?d=2026-07-29')
})

// ── Fail-closed: cada rechazo tiene su estado propio ─────────────────────────

test('brief desconocido: no se llama a nada', async () => {
  let called = false
  const result = await fetchBriefHtml({ session: SESSION, brief: null, fetchImpl: async () => { called = true } })

  assert.equal(result.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(result.reason, 'unknown_brief')
  assert.equal(called, false)
})

test('sesión de bypass admin: no llama al endpoint (no tiene credencial real)', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return okResponse() }

  const result = await fetchBriefHtml({
    session: { employee_id: 1, session_token: 'h.p.bypass', role: 'direccion_general', _bypass: true },
    brief: PRODUCCION,
    fetchImpl,
  })

  assert.equal(result.state, BRIEF_STATE.BYPASS)
  assert.equal(called, false, 'ni siquiera se intenta: el bypass nunca tuvo gf_employee_token')
})

test('sesión sin gf_employee_token: no llama al endpoint', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return okResponse() }

  const result = await fetchBriefHtml({
    session: { employee_id: 577, session_token: 'h.p.s' },
    brief: PRODUCCION,
    fetchImpl,
  })

  assert.equal(result.state, BRIEF_STATE.NO_SESSION)
  assert.equal(called, false)
})

test('401 → unauthorized · 403 → forbidden (no se colapsan en un error genérico)', async () => {
  const r401 = await fetchBriefHtml({
    session: SESSION, brief: PRODUCCION,
    fetchImpl: async () => ({ ok: false, status: 401, headers: JSON_HEADERS, text: async () => '' }),
  })
  const r403 = await fetchBriefHtml({
    session: SESSION, brief: PRODUCCION,
    fetchImpl: async () => ({ ok: false, status: 403, headers: JSON_HEADERS, text: async () => '' }),
  })

  assert.equal(r401.state, BRIEF_STATE.UNAUTHORIZED)
  assert.equal(r403.state, BRIEF_STATE.FORBIDDEN)
  assert.equal(r401.html, '')
  assert.equal(r403.html, '')
})

test('un 401/403 se pide UNA vez: sin reintento en bucle', async () => {
  for (const status of [401, 403]) {
    let calls = 0
    const fetchImpl = async () => { calls += 1; return { ok: false, status, headers: JSON_HEADERS, text: async () => '' } }

    await fetchBriefHtml({ session: SESSION, brief: GERENCIA, fetchImpl })

    assert.equal(calls, 1, `${status}: una sola petición`)
  }
})

test('la denegación no ofrece reintentar; el fallo de red sí', () => {
  const src = readFileSync(new URL('../src/modules/brief/BriefEmbedScreen.jsx', import.meta.url), 'utf8')

  assert.ok(src.includes("title: 'No tienes acceso a este brief'"), 'copy de denegación explícita para 403')
  // El botón de reintento se ata SOLO a UNAVAILABLE (red/5xx). Si alguien lo
  // amarra a un estado de denegación, esto truena.
  const retryBindings = [...src.matchAll(/status === BRIEF_STATE\.(\w+) \? '?Reintentar'?/g)].map((m) => m[1])
  const retryHandlers = [...src.matchAll(/status === BRIEF_STATE\.(\w+) \? reload/g)].map((m) => m[1])
  assert.deepEqual([...new Set([...retryBindings, ...retryHandlers])], ['UNAVAILABLE'])
})

test('200 con JSON (error disfrazado de n8n) NO se monta como brief', async () => {
  const result = await fetchBriefHtml({
    session: SESSION, brief: PRODUCCION,
    fetchImpl: async () => ({ ok: true, status: 200, headers: JSON_HEADERS, text: async () => '{"code":"UNAUTHORIZED"}' }),
  })

  assert.equal(result.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(result.reason, 'bad_content_type')
  assert.equal(result.html, '')
})

test('200 con cuerpo vacío o desmedido no se monta', async () => {
  const vacio = await fetchBriefHtml({ session: SESSION, brief: VENTAS, fetchImpl: async () => okResponse('   ') })
  assert.equal(vacio.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(vacio.reason, 'empty_body')

  const enorme = await fetchBriefHtml({
    session: SESSION, brief: VENTAS,
    fetchImpl: async () => okResponse('x'.repeat(MAX_BRIEF_BYTES + 1)),
  })
  assert.equal(enorme.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(enorme.reason, 'too_large')
})

test('un cuerpo multibyte mayor a 2 MiB no se monta aunque tenga menos caracteres', async () => {
  const multibyte = '€'.repeat(Math.floor(MAX_BRIEF_BYTES / 2) + 1)
  assert.ok(multibyte.length < MAX_BRIEF_BYTES)
  assert.ok(new TextEncoder().encode(multibyte).byteLength > MAX_BRIEF_BYTES)

  const result = await fetchBriefHtml({
    session: SESSION,
    brief: VENTAS,
    fetchImpl: async () => okResponse(multibyte),
  })

  assert.equal(result.state, BRIEF_STATE.UNAVAILABLE)
  assert.equal(result.reason, 'too_large')
})

test('la red caída no lanza: devuelve estado, nunca revienta la pantalla', async () => {
  const result = await fetchBriefHtml({
    session: SESSION, brief: PRODUCCION,
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

// ── El embed: un solo componente, aislamiento no negociable ──────────────────

test('las variantes comparten UNA sola pantalla (no se duplica el componente)', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

  for (const brief of BRIEFS) {
    const route = new RegExp(
      `path="${brief.route}"\\s+element=\\{<ModuleRoleRoute moduleId="${brief.moduleId}"><BriefEmbedScreen briefId="${brief.id}" />`,
    )
    assert.match(app, route, `${brief.id} se monta sobre BriefEmbedScreen y detrás de su guard`)
  }

  const mounts = [...app.matchAll(/<BriefEmbedScreen briefId="/g)]
  assert.equal(mounts.length, BRIEFS.length, 'un montaje por variante, ni más ni menos')
  assert.ok(!app.includes('ScreenBriefDia'), 'la pantalla por-variante ya no existe')
})

test('el iframe usa srcDoc con sandbox allow-scripts y SIN allow-same-origin', () => {
  const src = readFileSync(new URL('../src/modules/brief/BriefEmbedScreen.jsx', import.meta.url), 'utf8')

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

// ── Catálogo ⇄ registry: no pueden divergir ─────────────────────────────────

test('cada brief del catálogo tiene su módulo con EXACTAMENTE los mismos viewerRoles', () => {
  for (const brief of BRIEFS) {
    const module = getModuleById(brief.moduleId)
    assert.ok(module, `${brief.id} tiene módulo en el registry`)
    assert.equal(module.route, brief.route, `${brief.id}: misma ruta en catálogo y registry`)
    assert.deepEqual(module.roles, brief.viewerRoles, `${brief.id}: catálogo y registry no pueden divergir`)
    assert.equal(module.status, 'live')
    assert.ok(brief.endpoint.startsWith('/api-n8n/'), `${brief.id} pasa por el rewrite, no por el host directo`)
    assert.ok(!module.accessPolicy, `${brief.id}: sin accessPolicy — se gatea por rol, y una política ocultaría el módulo`)
  }
})

test('dirección ve la entrada de TODOS los briefs (es quien revisa el piloto)', () => {
  for (const brief of BRIEFS) {
    assert.ok(
      brief.viewerRoles.includes('direccion_general'),
      `${brief.id}: dirección revisa el piloto y debe ver la entrada`,
    )
    assert.ok(
      getModulesForRole('direccion_general').some((m) => m.id === brief.moduleId),
      `${brief.moduleId} debe verse con rol direccion_general`,
    )
  }
})

test('el brief de gerencia conserva a su dueño y también es visible para dirección', () => {
  const gerencia = getBriefById('gerencia')
  const module = getModuleById('brief_gerencia')

  assert.deepEqual(gerencia?.viewerRoles, ['gerente_sucursal', 'direccion_general'])
  assert.deepEqual(module?.roles, ['gerente_sucursal', 'direccion_general'])
})

test('cada brief lo ven SOLO los roles que declara; el resto no', () => {
  const roles = ['supervisor_ventas', 'supervisor_produccion', 'direccion_general', 'jefe_ruta',
    'gerente_sucursal', 'auxiliar_admin', 'operador_barra', 'almacenista_pt', 'auxiliar_ruta', '']

  for (const brief of BRIEFS) {
    for (const role of roles) {
      const visible = getModulesForRole(role).some((m) => m.id === brief.moduleId)
      const esperado = brief.viewerRoles.includes(role)
      assert.equal(
        visible, esperado,
        `${brief.moduleId} ${esperado ? 'debe' : 'NO debe'} verse con rol ${role || '(sin rol)'}`,
      )
    }
  }
})

// Regresión del reporte "a Aida no le aparece la pestaña" (2026-08-01): el gate
// del cliente sale de session.role / additional_job_keys, exactamente igual que
// el módulo "Equipo" que Aida sí veía. Si un día el brief deja de aparecer para
// una sesión que sí ve Equipo, el problema está fuera de este código.
test('la sesión REAL de Aida (rol tal como lo guarda el login) ve Equipo y su brief', () => {
  const aida = {
    employee_id: 718, session_token: 'h.p.odoo', name: 'Aida Sugey Landa Jaimes',
    role: 'supervisor_ventas', job_key: 'supervisor_ventas', additional_job_keys: [],
  }
  const ids = getVisibleModulesForSession(aida).map((m) => m.id)

  assert.ok(ids.includes('supervisor_ventas'), 'Equipo')
  assert.ok(ids.includes('brief_dia'), 'el brief se gatea igual que Equipo: si uno se ve, el otro también')
  assert.ok(!ids.includes('brief_produccion'), 'no ve el brief de planta')
})

test('cada quien ve su brief en la barra sin perder su superficie operativa', () => {
  const nav = (role, employee_id) => getNavModules({ employee_id, session_token: 'h.p.s', role }).map((m) => m.id)

  assert.deepEqual(nav('supervisor_ventas', 718).slice(0, 2), ['supervisor_ventas', 'brief_dia'])
  assert.deepEqual(nav('supervisor_produccion', 577).slice(0, 2), ['supervision_produccion', 'brief_produccion'])

  // Gerencia: Admin(10) y Gerente(12) conservan la barra; el brief entra después.
  const gerente = nav('gerente_sucursal', 699)
  assert.deepEqual(gerente.slice(0, 4), ['admin_sucursal', 'gerente', 'copiloto_gerencial', 'brief_gerencia'])
})

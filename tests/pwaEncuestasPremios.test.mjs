// Encuestas y Premios — las dos pantallas de TODOS los colaboradores que llevaban
// tiempo mostrando "Error al cargar".
//
// Causa real: `/pwa-surveys` y `/pwa-badges` nunca tuvieron handler y caían al
// fallback de n8n, cuyo workflow W16 está desactivado. Se reponen contra Odoo con
// la credencial real. Y de paso se retira de la pantalla de Encuestas una
// simulación que llevaba dentro: prometía puntos y se marcaba como contestada en
// memoria del navegador, sin que el servidor supiera nada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── Las rutas ya no caen al fallback de n8n ─────────────────────────────────

test('encuestas y premios se resuelven en Odoo, no en n8n', () => {
  const s = src('lib/api.js')
  assert.match(s, /cleanPath === '\/pwa-surveys'/, 'hay handler propio de encuestas')
  assert.match(s, /cleanPath === '\/pwa-badges'/, 'hay handler propio de premios')
  // Se inspecciona el tramo que va del primer handler al final del de premios,
  // porque entre ambos vive ahora el de iniciar encuesta.
  const i = s.indexOf("cleanPath === '/pwa-surveys'")
  const j = s.indexOf("cleanPath === '/pwa-admin/pos-products'", i)
  const block = s.slice(i, j)
  assert.match(block, /odooJson\('\/pwa-surveys'/, 'va directo a Odoo')
  assert.match(block, /odooJson\('\/pwa-badges'/)
  assert.match(block, /odooJson\('\/pwa-survey-start'/)
  assert.doesNotMatch(block, /api-n8n/, 'sin fallback a n8n')
  assert.doesNotMatch(block, /sudo:\s*1/, 'sin lectura privilegiada desde el cliente')
})

test('el shim traduce el envelope de Odoo al que espera la pantalla', () => {
  const s = src('lib/api.js')
  const i = s.indexOf("cleanPath === '/pwa-surveys'")
  const j = s.indexOf("cleanPath === '/pwa-admin/pos-products'", i)
  const block = s.slice(i, j)
  // Las pantallas leen `success`, el backend responde `ok`. Y se exige ok===true:
  // `ok !== false` daba por bueno un envelope ausente o malformado y convertía un
  // 401/403 en "no tienes encuestas". (Mi test anterior fijaba esa condición
  // defectuosa: lo señaló Codex y aquí se prueba justo lo contrario.)
  assert.match(block, /res\?\.ok !== true/)
  assert.doesNotMatch(block, /ok !== false/, 'el envelope manda: nada de éxito por omisión')
  assert.match(block, /success: false/, 'el fallo se propaga con su motivo')
  // Forma defensiva: incluso al fallar se devuelve la forma que la pantalla
  // espera (lista vacía / bloque de logros), nunca undefined.
  assert.match(block, /data: \[\],/)
  assert.match(block, /earned: \[\], locked: \[\], total_points: 0/)
  assert.match(block, /earned: Array\.isArray\(d\.earned\)/)
})

// ── La pantalla de Encuestas ya no finge ────────────────────────────────────

test('la encuesta NO se marca como contestada en el navegador', () => {
  const s = src('screens/ScreenSurveys.jsx')
  assert.doesNotMatch(s, /completedIds/, 'sin lista local de "contestadas"')
  assert.match(s, /const displaySurveys = surveys/, 'el estado viene del servidor')
  // Tras responder se RECARGA del servidor en vez de asumir el resultado.
  assert.match(s, /apiGet\("\/pwa-surveys"\)/)
})

test('no se prometen puntos que nadie otorga', () => {
  const s = src('screens/ScreenSurveys.jsx')
  assert.doesNotMatch(s, /points: 80/, 'sin los 80 puntos hardcodeados')
  assert.match(s, /points: null/, 'sin dato ⇒ null, no un número inventado')
  assert.match(s, /survey\.points != null &&/, 'el chip solo se pinta si hay puntos reales')
  assert.doesNotMatch(s, /Puntos ganados/, 'el acuse ya no anuncia puntos')
  assert.doesNotMatch(s, /reflejarán en tu balance/, 'ni promete un balance')
  assert.doesNotMatch(s, /acumular puntos/, 'ni invita a acumularlos')
})

// ── Un fallo NO se disfraza de "no tienes nada" (Codex P1-3) ────────────────

test('las pantallas distinguen error de vacío', () => {
  for (const f of ['screens/ScreenSurveys.jsx', 'screens/ScreenBadges.jsx']) {
    const s = src(f)
    assert.match(s, /if \(!res\.success\) \{ setLoadState\("error"\); return; \}/,
      `${f}: un envelope fallido pinta error, no lista vacía`)
    assert.doesNotMatch(s, /res\.success && Array\.isArray/, `${f}: sin la condición que fundía error y vacío`)
  }
})

test('ya no hay botón que dé por contestada una encuesta (Codex P1-4)', () => {
  const s = src('screens/ScreenSurveys.jsx')
  assert.doesNotMatch(s, /Completar ✓/, 'el botón que fingía el envío se retiró')
  assert.match(s, /Ya terminé/, 'ahora solo reconsulta al servidor')
  assert.doesNotMatch(s, /Respuesta enviada/, 'el acuse ya no afirma un envío que no puede conocer')
  assert.match(s, /onComplete\(\)/, 'sin id: no marca nada, solo recarga')
})

test('Premios no promete una mecánica que no existe (Codex P2-2)', () => {
  const s = src('screens/ScreenBadges.jsx')
  assert.doesNotMatch(s, /Completa encuestas y metas para ganar logros/)
  assert.match(s, /aparecerán aquí/, 'texto neutral mientras no haya motor que otorgue')
})

// ── El flujo funciona de punta a punta (Codex P1-2) ────────────────────────

test('la encuesta se abre con un token REAL pedido al servidor', () => {
  const s = src('screens/ScreenSurveys.jsx')
  assert.match(s, /apiPost\("\/pwa-survey-start", \{ survey_id: survey\.survey_id \}\)/,
    'el servidor crea/recupera la respuesta ligada al empleado del token')
  assert.match(s, /survey_url: s\.access_token \? /,
    'sin token no se fabrica una URL: antes salía /survey/start/ vacío')
  assert.match(s, /needs_start/, 'el DTO declara si hay que iniciarla')
  assert.match(s, /setStartError/, 'si no se puede abrir, se dice')
})

test('el shim de inicio exige token usable, no éxito por omisión', () => {
  const s = src('lib/api.js')
  const i = s.indexOf("cleanPath === '/pwa-survey-start'")
  assert.ok(i > 0, 'existe el shim')
  const block = s.slice(i, i + 800)
  assert.match(block, /res\?\.ok !== true \|\| !d\?\.access_token/,
    'sin token no hay éxito: abrir una URL rota es peor que fallar')
  assert.match(block, /success: false/)
})

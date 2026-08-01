import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { isBrandLightSession, resolvePalette } from '../src/theme/useBrandPalette.js'
import { BRAND_LIGHT, BRAND_HEADER_GRADIENT, BRAND_LOGO, BRAND_LOGO_MARK } from '../src/theme/brandLight.js'
import { TOKENS } from '../src/tokens.js'

const sess = (role, extra = {}) => ({ employee_id: 718, session_token: 'h.p.s', role, ...extra })

// ── El tema claro es EXCLUSIVO de supervisor_ventas ─────────────────────────

test('solo supervisor_ventas recibe la identidad clara', () => {
  assert.equal(isBrandLightSession(sess('supervisor_ventas')), true)

  for (const role of ['supervisor_produccion', 'gerente_sucursal', 'direccion_general', 'jefe_ruta',
    'almacenista_pt', 'auxiliar_admin', 'operador_barra', 'almacenista_entregas', 'operador_torres', '']) {
    assert.equal(isBrandLightSession(sess(role)), false, `${role || '(sin rol)'} sigue en oscuro`)
  }
})

test('supervisor_ventas como rol ADICIONAL también cuenta', () => {
  assert.equal(isBrandLightSession(sess('jefe_ruta', { additional_roles: ['supervisor_ventas'] })), true)
})

test('fail-closed ante basura: cualquier duda ⇒ oscuro', () => {
  for (const bad of [null, undefined, 'texto', 42, [], {}]) {
    assert.equal(isBrandLightSession(bad), false)
  }
})

test('resolvePalette entrega la paleta clara solo a ventas; el resto conserva TOKENS', () => {
  const ventas = resolvePalette(sess('supervisor_ventas'), TOKENS.colors)
  assert.equal(ventas.light, true)
  assert.equal(ventas.c, BRAND_LIGHT)

  const planta = resolvePalette(sess('supervisor_produccion'), TOKENS.colors)
  assert.equal(planta.light, false)
  assert.equal(planta.c, TOKENS.colors)
})

// ── La paleta es la institucional verificada, no una aproximación ───────────

test('los valores son los del repo de clientes (verificados contra grupofrio.mx)', () => {
  assert.equal(BRAND_LIGHT.primary, '#0077BB')
  assert.equal(BRAND_LIGHT.ice, '#00B8D4')
  assert.equal(BRAND_LIGHT.headerFrom, '#005A8D')
  assert.equal(BRAND_LIGHT.headerTo, '#00B8D4')
  assert.equal(BRAND_LIGHT.bg, '#F0F9FF')
  assert.equal(BRAND_LIGHT.text, '#0F2A3D')
  assert.equal(BRAND_LIGHT.textMuted, '#5B7285')
  assert.equal(BRAND_LIGHT.border, '#DBEFF9')
  assert.match(BRAND_HEADER_GRADIENT, /#005A8D.*#00B8D4/)
})

test('el tema oscuro global NO se tocó', () => {
  assert.equal(TOKENS.colors.bg0, '#030811')
  assert.equal(TOKENS.colors.blue, '#15499B')
  assert.equal(TOKENS.colors.text, '#FFFFFF')
})

// ── Assets oficiales presentes (no redibujados) ─────────────────────────────

test('los PNG oficiales existen y son los del repo de clientes', () => {
  const logo = readFileSync(new URL('../public/brand/grupo-frio-logo.png', import.meta.url))
  const mark = readFileSync(new URL('../public/brand/grupo-frio-logo-mark.png', import.meta.url))

  // Firma PNG: los archivos son imágenes reales, no placeholders de texto.
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  assert.ok(logo.subarray(0, 4).equals(PNG), 'logo horizontal es PNG')
  assert.ok(mark.subarray(0, 4).equals(PNG), 'mark es PNG')
  assert.equal(logo.length, 49752, 'mismo byte-size que el original del repo de clientes')
  assert.equal(mark.length, 32090, 'mismo byte-size que el original del repo de clientes')

  assert.equal(BRAND_LOGO, '/brand/grupo-frio-logo.png')
  assert.equal(BRAND_LOGO_MARK, '/brand/grupo-frio-logo-mark.png')
})

// ── La portada clara no se cuela a otros roles ──────────────────────────────

test('ScreenHome hace early-return SOLO tras isBrandLightSession', () => {
  const src = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')

  assert.match(src, /if \(isBrandLightSession\(session\)\) \{[\s\S]*?<SupervisorVentasHome/,
    'la portada clara vive detrás del gate de rol')
  // El render oscuro sigue existiendo tal cual para los demás roles.
  assert.ok(src.includes('linear-gradient(160deg, ${TOKENS.colors.bg0}'), 'la portada oscura se conserva')
})

test('la portada clara usa el logo oficial y el gradiente institucional', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/brand/SupervisorVentasHome.jsx', import.meta.url), 'utf8')

  assert.ok(src.includes('BRAND_HEADER_GRADIENT'), 'header con el gradiente institucional')
  assert.ok(src.includes('BRAND_LOGO'), 'logo oficial, no un redibujo')
  assert.ok(!/#15499B|#030811/.test(src), 'sin colores del tema oscuro')
})

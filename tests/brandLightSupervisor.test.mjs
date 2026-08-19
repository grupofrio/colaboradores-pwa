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

// ── PR marca 2026-08-03: login claro, un solo logo, rail y brief ─────────────

function sinComentarios(src) {
  // Los comentarios EXPLICAN lo que se quitó, así que citan lo prohibido. Se
  // escanea el código sin ellos: si no, el test se caza a sí mismo.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const LOGIN = () => readFileSync(new URL('../src/screens/ScreenLogin.jsx', import.meta.url), 'utf8')

test('el login usa la identidad clara y ya no el fondo navy', () => {
  const src = sinComentarios(LOGIN())

  assert.ok(src.includes("from \"../theme/brandLight\""), 'toma la paleta de la fuente de verdad')
  assert.ok(src.includes('BRAND_LOGO'), 'logo oficial')
  assert.ok(src.includes('BRAND_HEADER_GRADIENT'), 'acento con el gradiente institucional')

  // Los colores del tema oscuro viejo desaparecen de la pantalla.
  for (const viejo of ['#050D1A', '#091628', '#050E1F', '#15499B', '#2B8FE0']) {
    assert.ok(!src.includes(viejo), `el login conserva el color oscuro ${viejo}`)
  }
  assert.ok(!/text-white\/\d/.test(src), 'sin textos blancos translúcidos sobre fondo claro')
})

test('el login NO toca la lógica de autenticación', () => {
  const src = LOGIN()

  // La piel cambia; el contrato con Odoo no.
  assert.ok(src.includes('/api-odoo/employee-sign-in'), 'mismo endpoint')
  assert.ok(src.includes('buildSessionFromOdoo'), 'misma construcción de sesión')
  assert.doesNotMatch(src, /gf_salesops_token|salesops_api_token|x_gf_token/, 'el login no persiste el token global de SalesOps')
  assert.ok(src.includes('handleAdminTap'), 'el bypass de 5 taps sigue ahí')
  assert.match(src, /pin|barcode/i, 'PIN y barcode siguen siendo la entrada')
})

test('el login respeta AA y el touch target', () => {
  const src = LOGIN()

  // Texto principal e input sobre superficie clara: #0F2A3D ~12.9:1, #5B7285 ~4.9:1.
  assert.ok(src.includes('C.text'), 'texto con el color de alto contraste')
  assert.ok(src.includes('C.textMuted'), 'secundarios con el muted AA, no un gris claro')
  assert.match(src, /minHeight: 52/, 'el botón principal se mantiene ≥44px')
  assert.match(src, /minHeight: 44/, 'las filas del bypass llegan al mínimo táctil')
})

test('el login es el MISMO para todos los roles: no ramifica por rol', () => {
  const src = LOGIN()
  // Al autenticar todavía no hay rol; si alguien mete una rama aquí, se rompe.
  assert.ok(!src.includes('isBrandLightSession'), 'sin conmutador de tema por rol')
  assert.ok(!src.includes('BRAND_LIGHT_ROLE'), 'sin gate de rol en la puerta')
})

test('la portada del supervisor pinta UN solo logo', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/brand/SupervisorVentasHome.jsx', import.meta.url), 'utf8')
  const code = sinComentarios(src)

  // El hexágono suelto salía además del logo completo, que ya lo incluye.
  assert.ok(!code.includes('BRAND_LOGO_MARK'), 'la marca suelta ya no se pinta')
  const imgs = code.match(/<img/g) || []
  assert.equal(imgs.length, 1, `la portada pinta ${imgs.length} imágenes; debe ser 1`)
  assert.ok(code.includes('BRAND_LOGO'), 'y la que queda es el logo oficial completo')
})

test('el rail desktop usa la marca oficial en claro y conserva el icono en oscuro', () => {
  const src = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')
  const code = sinComentarios(src)

  assert.match(code, /light \? BRAND_LOGO_MARK : '\/icons\/icon-grupo-frio\.svg'/,
    'la marca oficial entra SOLO en la superficie clara')
  assert.ok(code.includes("import { BRAND_LOGO_MARK }"), 'sale de la fuente de verdad')
  // El resto de los roles no cambia de icono: es el alcance acordado.
  assert.ok(code.includes('/icons/icon-grupo-frio.svg'), 'el rail oscuro conserva el suyo')
})

test('el brief pinta el fondo claro de extremo a extremo, sin franjas', () => {
  const src = readFileSync(new URL('../src/modules/brief/BriefEmbedScreen.jsx', import.meta.url), 'utf8')
  const code = sinComentarios(src)

  // El nodo que limita el ancho y el que pinta el fondo son DISTINTOS: si vuelven
  // a ser el mismo, en escritorio reaparecen las franjas oscuras a los lados.
  const surface = code.slice(code.indexOf('data-testid="brief-surface"'), code.indexOf('data-testid="brief-content"'))
  assert.ok(surface.includes("width: '100%'"), 'la capa de color ocupa todo el ancho')
  assert.ok(surface.includes('background: C.bg'), 'y es la que lleva el fondo claro')
  assert.ok(!surface.includes('maxWidth'), 'la capa de color NO limita el ancho')

  const content = code.slice(code.indexOf('data-testid="brief-content"'))
  assert.match(content, /maxWidth: 1180/, 'el contenido sigue centrado y acotado')
})

test('los estados del brief se leen en la cáscara clara', () => {
  // Medido en el navegador ANTES: el detalle salía en blanco translúcido sobre
  // el fondo claro con 1.07:1 — invisible. `StateScreen` ya aceptaba tokens;
  // el brief simplemente no se los pasaba.
  const src = readFileSync(new URL('../src/modules/brief/BriefEmbedScreen.jsx', import.meta.url), 'utf8')
  assert.match(src, /const stateTokens = light \? BRAND_TOKENS : TOKENS/)
  const usos = (src.match(/tokens=\{stateTokens\}/g) || []).length
  const estados = (src.match(/<StateScreen/g) || []).length
  assert.equal(usos, estados, `${estados} StateScreen y solo ${usos} reciben tokens`)
})

test('la portada clara pone el logo sobre superficie blanca, no sobre el gradiente', () => {
  // El artwork oficial lleva la palabra en azul marino: sobre el gradiente
  // institucional quedaba casi invisible (visto en pantalla). No se recolorea
  // el logo — se le da el fondo que necesita.
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/brand/SupervisorVentasHome.jsx', import.meta.url), 'utf8')
  const header = src.slice(src.indexOf('<header'), src.indexOf('</header>'))
  const chip = header.slice(header.indexOf('<span'), header.indexOf('</span>'))
  assert.ok(chip.includes('background: C.surface'), 'el logo va sobre blanco')
  assert.ok(chip.includes('BRAND_LOGO'), 'y es el logo oficial')
})

// ─── Invariante del tema claro: NO puede filtrarse a otro rol ────────────────
// Los archivos de la superficie de supervisión importan BRAND_TOKENS a nivel de
// módulo (no por hook) porque declaran `const C = TOKENS.colors` fuera del
// componente. Eso es seguro SOLO mientras esos archivos se monten únicamente
// bajo rutas `moduleId="supervisor_ventas"`. Este test convierte esa condición
// en un invariante verificado: si alguien monta una de estas vistas en otra
// ruta, o le pone tema claro a un archivo compartido, truena aquí — antes de que
// un operador de planta vea texto claro sobre fondo claro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const APP = readFileSync(path.join(SRC, 'App.jsx'), 'utf8')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.jsx?$/.test(entry)) acc.push(full)
  }
  return acc
}

const FILES = walk(SRC)
const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/')

// Archivos que adoptan el tema claro a nivel de módulo (import directo).
const LIGHT_FILES = FILES
  .filter((f) => /from '[^']*theme\/brandTokens'/.test(readFileSync(f, 'utf8')))
  .map(rel)
  .sort()

test('el tema claro solo se adopta INCONDICIONALMENTE en la superficie de supervisión', () => {
  assert.ok(LIGHT_FILES.length > 0, 'hay archivos con tema claro')

  for (const f of LIGHT_FILES) {
    // modules/gerente/v2/**, modules/gerente/ScreenCopilotoGerencial.jsx y
    // modules/ventas-iguala/ScreenVentasIguala.jsx: superficies exclusivas de
    // un árbol de rutas protegido. El shell "Mi Sucursal" (MGR-05) se monta
    // SOLO bajo ModuleRoleRoute moduleId="gerente"
    // (gerente_sucursal/direccion_general) y detrás del flag gerente_v2
    // (fail-closed, default OFF). El Copiloto Gerencial histórico se monta
    // SOLO bajo ModuleRoleRoute moduleId="copiloto_gerencial". Ventas Iguala
    // se monta SOLO bajo VentasIgualaRoute, que revalida sesión y visibilidad
    // del módulo `ventas_iguala`. Mismo patrón que supervisor-ventas/v2: un
    // árbol de rutas exclusivo del rol puede adoptar el tema claro sin
    // conmutar por sesión.
    //
    // modules/admin/**: Admin Sucursal (ModuleRoleRoute moduleId="admin_sucursal",
    // roles auxiliar_admin/gerente_sucursal/direccion_general) — mismo patrón:
    // árbol de rutas exclusivo de esos 3 roles, tema claro incondicional desde
    // 2026-08-19 (reemplaza el hack de filter:invert() que causaba el bug de
    // texto ilegible). Ver ADMIN_THEME_SCOPE_STYLE en adminTheme.js.
    //
    // modules/produccion/**: superficie operativa exclusiva del módulo
    // `registro_produccion`. Desde 2026-08-26 varias vistas de operación
    // (Rolito/Barra/materiales del turno) adoptan la identidad clara de forma
    // intencional. Siguen detrás de rutas protegidas del módulo de producción,
    // así que no exponen el tema claro a superficies compartidas.
    if (
      f.startsWith('modules/supervisor-ventas/')
      || f.startsWith('modules/gerente/v2/')
      || f === 'modules/gerente/ScreenCopilotoGerencial.jsx'
      || f === 'modules/ventas-iguala/ScreenVentasIguala.jsx'
      || f.startsWith('modules/admin/')
      || f.startsWith('modules/produccion/')
      || f.startsWith('theme/')
    ) continue

    // Un archivo COMPARTIDO puede usar el tema claro, pero solo si lo elige por
    // ROL en tiempo de ejecución (la nav global es el caso: la ve todo mundo).
    // Importarlo a secas dejaría a producción/almacén con la paleta equivocada.
    const src = readFileSync(path.join(SRC, f), 'utf8')
    // Vale preguntar por el rol directamente (`isBrandLightSession`) o a través
    // de helpers que envuelven esa decisión (`resolvePalette(session, …)`,
    // `isGerenteBrandSurface`, `resolveMaterialesSurfaceTheme`). Lo que NO vale
    // es importar el tema claro a secas: eso dejaría a producción/almacén con
    // la paleta equivocada.
    assert.match(
      src, /isBrandLightSession|resolvePalette\(session|isGerenteBrandSurface|resolveMaterialesSurfaceTheme/,
      `${f} es compartido y adopta el tema claro sin conmutar por rol`,
    )
    assert.match(
      src, /DARK_TOKENS|TOKENS as DARK_TOKENS|: TOKENS\b/,
      `${f} debe conservar el tema oscuro como la otra rama`,
    )
  }
})

test('la navegación global conmuta por rol, no por import fijo', () => {
  const nav = readFileSync(path.join(SRC, 'components/AppNav.jsx'), 'utf8')
  // La decisión sale de `isGerenteBrandSurface(session)` (envuelve
  // isBrandLightSession OR isGerenteSucursalPilotSession) desde que Gerente de
  // sucursal también adoptó la identidad clara; ese booleano se nombra
  // `light` porque también decide el logo del rail. Se comprueba la CADENA.
  assert.match(nav, /const\s+light\s*=\s*isGerenteBrandSurface\(session\)/)
  assert.match(nav, /light\s*\?\s*BRAND_TOKENS\s*:\s*DARK_TOKENS/)
})

test('las navegaciones móviles de supervisión usan fondos del tema claro', () => {
  const nav = readFileSync(path.join(SRC, 'components/AppNav.jsx'), 'utf8')
  const shell = readFileSync(path.join(SRC, 'modules/supervisor-ventas/v2/SupervisorV2Shell.jsx'), 'utf8')

  assert.match(nav, /background: t\.colors\.moreSheetBg/)
  assert.doesNotMatch(nav, /background: 'rgba\(6,12,22,0\.98\)'/)
  // El shell ya no usa barra inferior propia (chocaba con AppNav); el rail
  // superior toma sus fondos de tokens del tema claro: pastilla activa
  // C.surfaceStrong y el degradado del contenedor C.bg0. Nada hardcodeado oscuro.
  assert.match(shell, /background: on \? C\.surfaceStrong/)
  assert.match(shell, /\$\{C\.bg0\}/)
  assert.doesNotMatch(shell, /background: 'rgba\(3,8,17,0\.92\)'/)
})

test('ningún componente COMPARTIDO importa el tema claro (se inyecta por prop)', () => {
  // Estos los usan otros roles: su tema debe llegar por prop con default
  // oscuro, nunca por import directo.
  for (const shared of [
    'components/kold/StateScreen.jsx',
    'components/Loader.jsx',
    'modules/entregas/components/ScreenShell.jsx',
    'modules/entregas/components/EmptyState.jsx',
    'modules/entregas/components/StatusBadge.jsx',
  ]) {
    assert.ok(!LIGHT_FILES.includes(shared), `${shared} es compartido: no puede importar BRAND_TOKENS`)
    const src = readFileSync(path.join(SRC, shared), 'utf8')
    assert.match(src, /tokens\s*=\s*(TOKENS|DARK_TOKENS)/, `${shared} conserva el tema oscuro por default`)
  }
})

test('las rutas que montan vistas con tema claro son de supervisor_ventas', () => {
  // Pantallas de entrada (las que App.jsx monta directamente) que llevan tema claro.
  const mounted = ['ScreenOperacionesHoy']
  for (const screen of mounted) {
    const routes = APP.split('\n').filter((l) => l.includes(`<${screen} `) || l.includes(`<${screen}/`) || l.includes(`<${screen}>`))
    assert.ok(routes.length > 0, `${screen} está montada`)
    for (const line of routes) {
      assert.match(line, /moduleId="supervisor_ventas"/, `${screen} montada fuera de supervisor_ventas: ${line.trim().slice(0, 120)}`)
    }
  }
})

test('el tema oscuro global sigue intacto y es el default de todo lo demás', async () => {
  const { TOKENS } = await import('../src/tokens.js')
  assert.equal(TOKENS.colors.bg0, '#030811')
  assert.equal(TOKENS.colors.text, '#FFFFFF')
  assert.equal(TOKENS.colors.surface, 'rgba(255,255,255,0.05)')
})

// Tokenizar literales que estaban incrustados NO puede cambiar el aspecto de
// quien ya los usaba. Los valores oscuros son EXACTAMENTE los que StatusBadge
// tenía escritos a mano antes de la tanda 3.
test('los tokens de chip conservan pixel a pixel el valor oscuro original', async () => {
  const { TOKENS } = await import('../src/tokens.js')
  assert.equal(TOKENS.colors.chipNeutralBg, 'rgba(255,255,255,0.06)')
  assert.equal(TOKENS.colors.chipInfoBg, 'rgba(43,143,224,0.12)')
  assert.equal(TOKENS.colors.chipInfoFg, '#2B8FE0')
})

test('el aro del loader sale del tema activo y conserva contraste en claro', async () => {
  const src = readFileSync(path.join(SRC, 'components/Loader.jsx'), 'utf8')
  const { TOKENS } = await import('../src/tokens.js')
  const { BRAND_TOKENS } = await import('../src/theme/brandTokens.js')

  assert.match(src, /border: `2px solid \$\{TOKENS\.colors\.spinnerTrack\}`/)
  assert.equal(TOKENS.colors.spinnerTrack, 'rgba(255,255,255,0.12)')
  assert.notEqual(BRAND_TOKENS.colors.spinnerTrack, TOKENS.colors.spinnerTrack)
})

test('los círculos de cumplimiento se pintan con tokens, no con literales', () => {
  const src = readFileSync(path.join(SRC, 'modules/supervisor-ventas/ScreenScoreSemanal.jsx'), 'utf8')

  // getComplianceColor sigue siendo la ÚNICA fuente de los umbrales…
  assert.match(src, /COMPLIANCE_FILL\[getComplianceColor\(pct\)\]/)
  // …pero el color que se pinta sale del tema activo.
  assert.ok(!/background: getComplianceColor\(/.test(src), 'el relleno ya no usa el literal')
  assert.ok(!/color: getComplianceColor\(/.test(src), 'el texto ya no usa el literal')
})

test('BRAND_TOKENS tiene la MISMA forma que TOKENS (intercambiable)', async () => {
  const { TOKENS } = await import('../src/tokens.js')
  const { BRAND_TOKENS } = await import('../src/theme/brandTokens.js')

  assert.deepEqual(Object.keys(BRAND_TOKENS).sort(), Object.keys(TOKENS).sort())
  for (const group of Object.keys(TOKENS)) {
    assert.deepEqual(
      Object.keys(BRAND_TOKENS[group]).sort(),
      Object.keys(TOKENS[group]).sort(),
      `grupo ${group}: mismas llaves`,
    )
  }
  // Los estados conservan glyph y palabra: la distinción no es solo color.
  for (const key of Object.keys(TOKENS.state)) {
    assert.equal(BRAND_TOKENS.state[key].glyph, TOKENS.state[key].glyph, `state.${key}.glyph`)
    assert.equal(BRAND_TOKENS.state[key].word, TOKENS.state[key].word, `state.${key}.word`)
  }
})

// ── Contraste AA sobre fondo claro ──────────────────────────────────────────

function luminance(hex) {
  const v = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

test('el texto del tema claro cumple AA sobre tarjeta blanca y sobre la página', async () => {
  const { BRAND_TOKENS } = await import('../src/theme/brandTokens.js')
  const C = BRAND_TOKENS.colors

  for (const bg of [C.surface, C.bg0]) {
    for (const key of ['text', 'textSoft', 'textMuted', 'textLow', 'blue', 'blue3', 'success', 'warning', 'error']) {
      const ratio = contrast(C[key], bg)
      assert.ok(ratio >= 4.5, `${key} sobre ${bg}: ${ratio.toFixed(2)}:1 (AA exige 4.5)`)
    }
  }
})

test('el texto blanco sobre relleno de semáforo cumple AA en el tema claro', async () => {
  const { BRAND_TOKENS } = await import('../src/theme/brandTokens.js')
  // Los círculos de cumplimiento y los contadores llevan blanco encima del
  // relleno: si alguien aclara estos tonos, el número deja de leerse.
  for (const key of ['success', 'warning', 'error']) {
    const ratio = contrast('#FFFFFF', BRAND_TOKENS.colors[key])
    assert.ok(ratio >= 4.5, `blanco sobre ${key} (${BRAND_TOKENS.colors[key]}): ${ratio.toFixed(2)}:1`)
  }
  // El chip informativo es texto sobre fondo pálido, no blanco sobre relleno.
  const chip = contrast(BRAND_TOKENS.colors.chipInfoFg, BRAND_TOKENS.colors.surface)
  assert.ok(chip >= 4.5, `chipInfoFg sobre tarjeta: ${chip.toFixed(2)}:1`)
})

test('los estados del semáforo son legibles sobre claro', async () => {
  const { BRAND_TOKENS } = await import('../src/theme/brandTokens.js')
  for (const [key, s] of Object.entries(BRAND_TOKENS.state)) {
    if (!/^#/.test(s.fg)) continue
    const ratio = contrast(s.fg, BRAND_TOKENS.colors.surface)
    assert.ok(ratio >= 4.5, `state.${key}.fg sobre tarjeta: ${ratio.toFixed(2)}:1`)
  }
})

test('no quedan restos del tema oscuro en las vistas convertidas', () => {
  const OSCUROS = /#c084fc|rgba\(255,\s*255,\s*255,\s*0\.(3|5)/
  // Excepción angosta: el aro del spinner DENTRO de un botón con degradado azul
  // (ScreenPOS.jsx / ScreenRequisiciones.jsx, botón "Confirmar"/"Crear
  // Requisicion") es blanco a propósito en cualquier tema — el fondo del botón
  // sigue siendo azul, no la página. No es un resto del tema oscuro.
  const BUTTON_SPINNER = /border: '2px solid rgba\(255,255,255,0\.3\)', borderTop: '2px solid white'/g
  for (const f of LIGHT_FILES) {
    if (f.startsWith('theme/')) continue
    const src = readFileSync(path.join(SRC, f), 'utf8')
      .replace(BUTTON_SPINNER, '')
    assert.ok(!OSCUROS.test(src), `${f} conserva colores pensados para fondo oscuro`)
  }
})

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
    if (f.startsWith('modules/supervisor-ventas/') || f.startsWith('theme/')) continue

    // Un archivo COMPARTIDO puede usar el tema claro, pero solo si lo elige por
    // ROL en tiempo de ejecución (la nav global es el caso: la ve todo mundo).
    // Importarlo a secas dejaría a producción/almacén con la paleta equivocada.
    const src = readFileSync(path.join(SRC, f), 'utf8')
    assert.match(
      src, /isBrandLightSession/,
      `${f} es compartido y adopta el tema claro sin conmutar por rol`,
    )
    assert.match(
      src, /DARK_TOKENS|TOKENS as DARK_TOKENS/,
      `${f} debe conservar el tema oscuro como la otra rama`,
    )
  }
})

test('la navegación global conmuta por rol, no por import fijo', () => {
  const nav = readFileSync(path.join(SRC, 'components/AppNav.jsx'), 'utf8')
  assert.match(nav, /isBrandLightSession\(session\)\s*\?\s*BRAND_TOKENS\s*:\s*DARK_TOKENS/)
})

test('ningún componente COMPARTIDO importa el tema claro (se inyecta por prop)', () => {
  // StateScreen y ScreenShell los usan otros roles: su tema debe llegar por
  // prop con default oscuro, nunca por import directo.
  for (const shared of ['components/kold/StateScreen.jsx', 'modules/entregas/components/ScreenShell.jsx']) {
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
  for (const f of LIGHT_FILES) {
    if (f.startsWith('theme/')) continue
    const src = readFileSync(path.join(SRC, f), 'utf8')
    assert.ok(!OSCUROS.test(src), `${f} conserva colores pensados para fondo oscuro`)
  }
})

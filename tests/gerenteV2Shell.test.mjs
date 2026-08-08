// Fase 2 de Gerente — shell "Mi Sucursal": flag, pestañas y cableado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  computeGerenteV2Flag,
  readGerenteV2FlagFrom,
  isGerenteV2Active,
} from '../src/modules/gerente/v2/gerenteV2Flag.js'
import { GERENTE_V2_TABS } from '../src/modules/gerente/v2/gerenteV2Tabs.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// ── Flag fail-closed ─────────────────────────────────────────────────────────

test('el flag es fail-closed: ambos candados deben estar en true', () => {
  assert.equal(computeGerenteV2Flag({ globalEnabled: true, branchEnabled: true }).enabled, true)
  assert.equal(computeGerenteV2Flag({ globalEnabled: true, branchEnabled: false }).enabled, false)
  assert.equal(computeGerenteV2Flag({ globalEnabled: false, branchEnabled: true }).enabled, false)
  assert.equal(computeGerenteV2Flag({}).enabled, false)
  // Estado desconocido ⇒ apagado.
  assert.equal(computeGerenteV2Flag({ globalEnabled: undefined, branchEnabled: undefined }).source, 'unknown')
})

test('lee el candado global de capabilities y el de sucursal del branch', () => {
  const on = readGerenteV2FlagFrom(
    { branch: { gerente_v2_enabled: true } },
    { gerenteV2: true },
  )
  assert.equal(on.enabled, true)
  assert.equal(on.source, 'both')
  // Solo global (sin candado de sucursal) ⇒ apagado, branch-off.
  const soloGlobal = readGerenteV2FlagFrom({}, { gerenteV2: true })
  assert.equal(soloGlobal.enabled, false)
  assert.equal(soloGlobal.source, 'branch-off')
})

test('isGerenteV2Active default-off sin flags (el hub legacy sigue)', () => {
  assert.equal(isGerenteV2Active({}), false)
  assert.equal(isGerenteV2Active({ capabilities: {}, branch: {} }), false)
})

// ── Las 6 pestañas ───────────────────────────────────────────────────────────

test('el shell declara exactamente las 6 pestañas del puesto, en orden', () => {
  assert.deepEqual(
    GERENTE_V2_TABS.map((t) => t.key),
    ['hoy', 'equipo', 'admin', 'produccion', 'inventario', 'mas'],
  )
  // Cada pestaña tiene ruta y etiqueta.
  for (const t of GERENTE_V2_TABS) {
    assert.ok(t.route.startsWith('/gerente'), `${t.key} ruta bajo /gerente`)
    assert.ok(t.label && t.glyph, `${t.key} etiqueta + glifo`)
  }
})

test('el rail es superior siempre-visible, sin barra inferior propia (fix #147)', () => {
  const shell = src('../src/modules/gerente/v2/GerenteV2Shell.jsx')
  // role tablist accesible + touch targets.
  assert.match(shell, /role="tablist"/)
  assert.match(shell, /minHeight: 44/)
  // NO barra inferior fija propia (la lección del #147: chocaba con AppNav).
  assert.doesNotMatch(shell, /position: 'fixed'[^}]*bottom: 0/)
  // Overflow horizontal cuando no caben las 6.
  assert.match(shell, /overflowX: 'auto'/)
})

test('el shell usa el tema claro BRAND_TOKENS, como el de supervisor', () => {
  const shell = src('../src/modules/gerente/v2/GerenteV2Shell.jsx')
  assert.match(shell, /BRAND_TOKENS as TOKENS/)
})

// ── Cableado de rutas ────────────────────────────────────────────────────────

test('App.jsx monta las 6 pestañas del gerente detrás del gate V2', () => {
  const app = src('../src/App.jsx')
  for (const [route, tab] of [
    ['/gerente', 'HoyGerenteTab'],
    ['/gerente/equipo', 'EquipoGerenteTab'],
    ['/gerente/admin', 'AdminGerenteTab'],
    ['/gerente/produccion', 'ProduccionGerenteTab'],
    ['/gerente/inventario', 'InventarioGerenteTab'],
    ['/gerente/mas', 'MasGerenteTab'],
  ]) {
    const re = new RegExp(`path="${route}"[^]*?${tab}`)
    assert.match(app, re, `${route} monta ${tab}`)
  }
  // Todas pasan por el gate (fail-closed) y por el rol.
  assert.match(app, /path="\/gerente"[^]*?GerenteV2Gate active="hoy" legacy=\{<ScreenGerente/,
    '/gerente cae al hub legacy con el flag OFF')
})

test('las pestañas nuevas se montan solo para el módulo gerente', () => {
  const app = src('../src/App.jsx')
  const lines = app.split('\n').filter((l) => /path="\/gerente\/(equipo|admin|produccion|inventario|mas)"/.test(l))
  assert.equal(lines.length, 5, 'las 5 pestañas nuevas están montadas')
  for (const l of lines) {
    assert.match(l, /moduleId="gerente"/, `pestaña fuera del módulo gerente: ${l.trim().slice(0, 80)}`)
  }
})

test('el iframe Metabase sin scope NO reaparece en el shell', () => {
  // La pestaña Hoy es el tablero nativo; el dashboard viejo (iframe) no se monta
  // en ninguna pestaña del shell.
  for (const f of [
    '../src/modules/gerente/v2/tabs/HoyGerenteTab.jsx',
    '../src/modules/gerente/v2/hoy/HoyGerenteView.jsx',
  ]) {
    // Se ignoran los comentarios (un // … puede mencionar "sin iframe Metabase");
    // lo que importa es que no haya un <iframe> real ni la env var del dashboard.
    const code = src(f).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    assert.doesNotMatch(code, /<iframe|VITE_METABASE_URL/i, `${f} sin iframe Metabase`)
  }
})

// ── Read-only e integridad de las vistas ─────────────────────────────────────

test('las vistas del gerente son read-only: sin escrituras', () => {
  for (const f of [
    '../src/modules/gerente/v2/tabs/InventarioGerenteTab.jsx',
    '../src/modules/gerente/v2/tabs/ProduccionGerenteTab.jsx',
    '../src/modules/gerente/v2/hoy/HoyGerenteView.jsx',
  ]) {
    const code = src(f)
    assert.doesNotMatch(code, /api\('POST'|api\('PUT'|api\('DELETE'/, `${f} no debe escribir`)
  }
})

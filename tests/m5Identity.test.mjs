// KOLD OS · M5 — INVARIANTES DE IDENTIDAD del módulo (frontend).
//
// Por qué existe: M5 se construyó adaptando la arquitectura de M4, y la
// identidad de M4 sobrevivió en lugares que ningún scan miraba. Codex los
// encontró en dos rondas seguidas:
//   · el módulo estaba registrado con el id 'ventas-clientes' — y como
//     getModuleById resuelve POR id, el día que M4 (#72) mergeara, dos módulos
//     distintos habrían reclamado el mismo id en el registry canónico;
//   · el export ejecutivo se titulaba "VENTAS, CLIENTES Y CANALES";
//   · el cliente API citaba el PR de M4 como si fuera el backend de M5;
//   · tests filtraban por la categoría 'recurrencia', inexistente en M5, y
//     PASABAN en vacío (every() sobre [] es true).
//
// Un residuo de identidad no es cosmético: es este módulo declarando que es otro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getModuleById, MODULES } from '../src/modules/registry.js'
import { M5_API_LATEST_FIXTURE } from '../src/modules/inventario/m5/fixtures/apiLatestFixture.js'
import {
  executiveSummaryText, differencesText, handoffM5M6M7Text, exportFilename,
} from '../src/modules/inventario/m5/exporters.js'
import { M5_GRANULARITIES } from '../src/modules/inventario/m5/contract.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

// Marcas de IDENTIDAD de M4. NO son vocabulario de dominio: 'route'/'plan'/
// 'stop' son EL DOMINIO de M5 y jamás se prohíben aquí — copiar el scan de M4,
// donde eran residuo, habría prohibido justo lo que M5 mide.
const M4_IDENTITY = [
  /ventas-clientes/i,
  /VENTAS,\s*CLIENTES\s*Y\s*CANALES/i,
  /Sales,\s*customers\s*and\s*channels/i,
  /#205\b/,
  /\brecurrenc(ia|e)\b/i,
  /\brecompra/i,
  /\bpedidos_ventas\b/i,
  /qa-m4/i,
  /reporte_m4/i,
]

const RUNTIME_FILES = [
  '../src/lib/koldOsM5Route.js',
  '../src/modules/inventario/ScreenInventarioM5.jsx',
  '../src/modules/inventario/m5/exporters.js',
  '../src/modules/inventario/m5/contract.js',
  '../src/modules/inventario/m5/m5Meta.js',
  '../src/modules/inventario/m5/m5Api.js',
  '../src/modules/inventario/m5/access.js',
  '../src/modules/inventario/m5/demoGate.js',
  '../src/modules/inventario/m5/filters.js',
]

test('registry: el módulo M5 tiene identidad propia, no la de M4', () => {
  const m5 = getModuleById('inventario-flujo')
  assert.ok(m5, "el id canónico es 'inventario-flujo'")
  assert.equal(m5.route, '/inventario-flujo')
  assert.equal(m5.accessPolicy, 'm5')
  assert.equal(m5.label, 'Inventario y flujo')
  // M4 ya forma parte de main y conserva su identidad. M5 no puede reutilizarla.
  const m4 = getModuleById('ventas-clientes')
  assert.ok(m4, "'ventas-clientes' pertenece a M4")
  assert.notEqual(m5.id, m4.id, 'M5 no reutiliza la identidad de M4')
  const ids = MODULES.map((m) => m.id)
  assert.equal(new Set(ids).size, ids.length, 'ningún id duplicado en el registry')
})

test('runtime: cero marcas de identidad de M4', () => {
  const bad = []
  for (const rel of RUNTIME_FILES) {
    const src = read(rel)
    src.split('\n').forEach((line, i) => {
      for (const rx of M4_IDENTITY) {
        // api.js documenta POR QUÉ se quitó el número de PR: nombrar el residuo
        // para explicar su remoción no es portarlo.
        if (rx.test(line) && !/decía #205|era 'ventas-clientes'|identidad de M4/.test(line)) {
          bad.push(`${rel}:${i + 1} -> ${rx} | ${line.trim().slice(0, 56)}`)
        }
      }
    })
  }
  assert.deepEqual(bad, [], `identidad de M4 en runtime M5:\n${bad.join('\n')}`)
})

test('el cliente API no fija un número de PR en runtime', () => {
  const api = read('../src/lib/api.js')
  const bloque = api.slice(api.indexOf('KOLD OS M5 (gf_kold_os_m5)'), api.indexOf('directKoldOsM5') + 400)
  assert.ok(/KOLD OS M5 backend/i.test(bloque), 'debe declarar de qué backend es cliente')
  // Un número de PR en runtime envejece y miente: el de M5 no es #205 (ese es
  // el de M4). Su lugar son las release notes.
  assert.ok(!/PR #\d+/.test(bloque.replace(/decía #205[^\n]*/g, '')),
    'los números de PR viven en release notes, no en el código')
})

test('exports: títulos de inventario y flujo, jamás de ventas', () => {
  const payload = M5_API_LATEST_FIXTURE
  const textos = {
    ejecutivo: executiveSummaryText(payload, { demo: true }),
    diferencias: differencesText(payload, { demo: true }),
    handoff: handoffM5M6M7Text(payload, { demo: true }),
  }
  for (const [nombre, txt] of Object.entries(textos)) {
    assert.ok(txt.length > 0, nombre)
    for (const rx of M4_IDENTITY) {
      assert.ok(!rx.test(txt), `export ${nombre}: identidad de M4 (${rx})`)
    }
  }
  assert.match(textos.ejecutivo, /INVENTARIO Y FLUJO DE PRODUCTO/)
  assert.match(textos.diferencias, /DIFERENCIAS REPORTADAS EN CONCILIACIÓN/)
  assert.ok(!/RECURRENCIA/i.test(textos.diferencias), 'el export de RECURRENCIA era de M4')
})

test('los archivos exportados se nombran como M5', () => {
  // Los `base` los pasa la pantalla, no exportFilename: se leen del código real
  // en vez de asumirlos. Un nombre de archivo es lo único que sobrevive fuera
  // de la app -- si dice "ventas", el residuo viaja al escritorio de dirección.
  const screen = read('../src/modules/inventario/ScreenInventarioM5.jsx')
  const bases = [...screen.matchAll(/exportFilename\('([a-z0-9_]+)'/g)].map((m) => m[1])
  assert.ok(bases.length >= 5, `deben existir los exports; encontrados: ${bases.length}`)
  for (const base of bases) {
    assert.match(base, /^kold_os_m5_/, `export '${base}' no declara ser de M5`)
    for (const rx of M4_IDENTITY) assert.ok(!rx.test(base), `export '${base}': identidad de M4`)
  }
  assert.match(exportFilename(bases[0], 'csv', { demo: true, nonformal: true }),
    /kold_os_m5_.*_DEMO_NONFORMAL\.csv/, 'el nombre debe declarar DEMO y NO FORMAL')
})

test('el envelope y sus capabilities son de M5', () => {
  const blob = JSON.stringify(M5_API_LATEST_FIXTURE)
  for (const rx of M4_IDENTITY) {
    assert.ok(!rx.test(blob), `envelope con identidad de M4 (${rx})`)
  }
  assert.equal(M5_API_LATEST_FIXTURE.schema_version, 'kold.os.m5.api/1')
  // M5 v1 es AGREGADO: las granularidades canal/segmento/cliente/pedido eran de M4.
  assert.deepEqual([...M5_GRANULARITIES], ['aggregate'])
  assert.deepEqual(M5_API_LATEST_FIXTURE.capabilities.granularities, ['aggregate'])
})

test('las categorías servidas son del catálogo de M5, no de M4', () => {
  const cats = new Set(M5_API_LATEST_FIXTURE.findings.map((f) => f.category))
  assert.ok(cats.size > 0, 'debe haber hallazgos con categoría')
  for (const banned of ['recurrencia', 'pedidos_ventas', 'clientes', 'canales', 'portafolio']) {
    assert.ok(!cats.has(banned), `categoría de M4 servida por M5: ${banned}`)
  }
  // Las categorías de M5 son las del flujo físico.
  for (const c of cats) {
    assert.match(c, /catalogo_pesos|carga|stock_unidad|salidas|refill|devoluciones|mermas_diferencias|kilogramos|consignacion|handoffs/,
      `categoría fuera del catálogo de M5: ${c}`)
  }
})

test('ningún test de M5 filtra por una categoría inexistente', () => {
  // El bug: `filter(category:'recurrencia').every(...)` devolvía [] y every()
  // sobre [] es true => el test PASABA sin verificar nada.
  const cats = new Set(M5_API_LATEST_FIXTURE.findings.map((f) => f.category))
  const suites = ['./m5AccessFilters.test.mjs', './m5Api.test.mjs', './m5Contract.test.mjs']
  for (const rel of suites) {
    const src = read(rel)
    for (const m of src.matchAll(/category:\s*'([a-z_]+)'/g)) {
      const cat = m[1]
      // Se permite nombrar una categoría ajena SOLO para fijar que devuelve vacío.
      const linea = src.slice(0, m.index).split('\n').length
      const contexto = src.split('\n').slice(linea - 3, linea + 2).join(' ')
      if (/length,\s*0|no filtra|devuelve vacío|categoría de otro módulo/.test(contexto)) continue
      assert.ok(cats.has(cat),
        `${rel}:${linea} filtra por '${cat}', que no existe en M5: el test pasaría en vacío`)
    }
  }
})

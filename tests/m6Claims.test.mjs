// KOLD OS · M6 — las afirmaciones vigentes, verificadas contra el árbol.
//
// Los docs de M6 se escribieron cuando el backend vivía solo en disco. Al abrir
// el PR temporal #210, media docena de frases pasaron a ser falsas ("el backend
// no existe", "no hay PR", "local only") y NADA las detectaba: la suite seguía
// verde. Documentación que contradice el estado real es exactamente lo que le
// costó un RED a M5.
//
// Este test barre AFIRMACIONES en los docs, no palabras: las frases que explican
// por qué algo NO se soporta deben poder nombrarlo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DOCS = 'docs/m6'
const archivos = readdirSync(DOCS).filter((f) => f.endsWith('.md'))

const leer = (f) => readFileSync(join(DOCS, f), 'utf8')

// Quita citas en bloque y comillas: ahí es donde se cita el estado viejo para
// explicar que cambió. Prohibir la cadena a secas prohibiría su propia historia.
const soloAfirmaciones = (s) => s
  .split('\n')
  .filter((l) => !l.trim().startsWith('>'))
  .join('\n')
  .replace(/`[^`]*`/g, '')

test('los docs existen (si no, el test sería vacuo)', () => {
  assert.ok(archivos.length >= 10, `sólo ${archivos.length} docs`)
})

// ─── afirmaciones que YA NO son ciertas ──────────────────────────────────────
//
// `salvo`: el doc que DEFINE un estado tiene que poder nombrarlo para negarlo.
// M6_LINEAGE_GATE.md es la autoridad del linaje: dice "36/36" cinco veces, todas
// para negarlo hoy o describir el estado futuro post-portado. Prohibirle la
// cadena obligaría a borrar la explicación — que es como se pierde el porqué y
// vuelve el error. La allowlist exige razón escrita.
const PROHIBIDAS = [
  { re: /el backend no existe/i, por: 'existe #210 (DRAFT temporal)' },
  { re: /no (hay|tiene) PR\b/i, por: 'el PR temporal #210 existe' },
  { re: /LOCAL_ONLY_NOT_PUBLISHED/, por: 'ahora es TEMP_PR_OPEN_NOT_DEPLOYED' },
  {
    re: /\b36\/36\b/,
    por: 'el contrato es 35/36 hasta el re-sellado post-portado',
    salvo: { 'M6_LINEAGE_GATE.md': 'es la autoridad del linaje: nombra 36/36 para negarlo hoy y para describir el estado post-portado' },
  },
  { re: /backend GREEN/i, por: 'el backend NO es GREEN formal' },
  { re: /\bSQL ejecutado\b/i, por: 'el SQL del manifiesto nunca ha corrido' },
  { re: /TransactionCase ejecutad/i, por: 'está PREPARADO, no ejecutado' },
  { re: /HttpCase ejecutad/i, por: 'está PREPARADO, no ejecutado' },
  { re: /linaje sincronizado/i, por: 'el linaje diverge (esperado y declarado)' },
]

for (const { re, por, salvo = {} } of PROHIBIDAS) {
  test(`ningún doc afirma ${re.source} — ${por}`, () => {
    const culpables = archivos
      .filter((f) => !(f in salvo))
      .filter((f) => re.test(soloAfirmaciones(leer(f))))
    assert.deepEqual(culpables, [], `${culpables.join(', ')}: ${por}`)
  })
}

test('toda excepción de la allowlist declara su razón y sigue existiendo', () => {
  const excepciones = PROHIBIDAS.flatMap(({ salvo = {} }) => Object.entries(salvo))
  assert.ok(excepciones.length > 0, 'sin excepciones el test sería vacuo')
  for (const [archivo, razon] of excepciones) {
    assert.ok(archivos.includes(archivo), `${archivo}: allowlist obsoleta`)
    assert.ok(razon.length > 40, `${archivo}: la razón debe explicar, no etiquetar`)
  }
})

// ─── afirmaciones que DEBEN estar ────────────────────────────────────────────
// Busca AFIRMACIONES de despliegue, no la palabra: "sin backend desplegado el
// fixture es la única fuente" es correcto y debe pasar. Sólo se prohíbe afirmar
// que SÍ lo está.
test('ningún doc afirma que el backend está desplegado', () => {
  const afirma = /(?<!sin |no (?:esta|está) |NO )backend\s+(?:ya\s+)?(?:esta|está)\s+desplegado/i
  const culpables = archivos.filter((f) => afirma.test(soloAfirmaciones(leer(f))))
  assert.deepEqual(culpables, [], `${culpables.join(', ')}: el backend NO está desplegado`)
})

// Acepta prosa ("no esta desplegado") o tabla ("| Backend desplegado | **NO** |"):
// lo que importa es que la afirmación esté, no cómo se maquetó.
test('los docs que hablan del backend declaran que NO está desplegado', () => {
  const declara = /no est[aá] desplegado|desplegado\s*\|?\s*\*\*NO\*\*/i
  const clave = ['M6_KNOWN_LIMITATIONS.md', 'M6_RELEASE_NOTES.md']
  for (const f of clave) {
    assert.ok(archivos.includes(f), `${f}: falta`)
    assert.match(leer(f), declara,
      `${f}: debe declarar que el backend no está desplegado`)
  }
})

test('el gate del linaje está documentado en UN solo lugar y se referencia', () => {
  assert.ok(archivos.includes('M6_LINEAGE_GATE.md'))
  const gate = leer('M6_LINEAGE_GATE.md')
  assert.match(gate, /expected_pre_migration_lineage_mismatch/)
  assert.match(gate, /35\/36/)
  assert.match(gate, /9c23d5d2/, 'debe nombrar el sello actual del backend')
  assert.match(gate, /fe53d564/, 'debe nombrar el sello del fixture')
  assert.match(gate, /Ready/, 'debe declarar que bloquea Ready final')
})

test('el eje lifecycle no ofrece corrected como disponible', () => {
  for (const f of archivos) {
    if (f === 'M6_LINEAGE_GATE.md') continue
    const txt = soloAfirmaciones(leer(f))
    assert.ok(!/new · persistent · corrected/i.test(txt),
      `${f}: corrected no es un estado emitido por v1`)
  }
})

test('el PR temporal se declara como NO mergeable donde se menciona', () => {
  const mencionan = archivos.filter((f) => /#210/.test(leer(f)))
  assert.ok(mencionan.length > 0, 'algún doc debe mencionar el PR temporal')
  for (const f of mencionan) {
    assert.match(leer(f), /no se mergea|NO MERGEAR|se cierra sin merge|no entra en la cola/i,
      `${f}: menciona #210 sin decir que no se mergea`)
  }
})

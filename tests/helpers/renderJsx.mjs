// Harness SSR para renderizar componentes REALES (.jsx) dentro de `node --test`.
//
// SUPERSET reconciliado (integración #78 Etapa 0A + #79 hardening M4): el repo no
// transpila JSX en `node --test`, así que empaquetamos el .jsx con esbuild (JSX
// automático) y lo importamos como ESM, dejando React/react-dom/router EXTERNOS para
// reusar la copia instalada (una sola instancia de React). No se usa jsdom ni RTL.
//
// Acepta DOS estilos de llamada:
//   · #78 → ruta RELATIVA A LA RAÍZ del repo (p.ej. 'src/components/kold/ModuleHeader.jsx');
//     el valor devuelto ES el componente (función) → `createElement(C, props)`.
//   · #79 → ruta ABSOLUTA o file:URL; se destructura `{ Component, cleanup }`.
// El valor devuelto es la función-componente con `.Component`, `.mod` y `.cleanup`
// adjuntos, de modo que ambos estilos funcionan sin ramificar. El módulo virtual de
// Vite `virtual:m4-demo-fixture` se stubbea a un módulo inerte (igual que Vite sin la
// fixture de demo).
import { build } from 'esbuild'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const EXTERNAL = [
  'react',
  'react-dom',
  'react-dom/server',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-router-dom',
]

// Stub del módulo virtual de demo (M4): en tests no hay fixture de demostración.
const virtualDemoStub = {
  name: 'virtual-m4-demo-stub',
  setup(b) {
    b.onResolve({ filter: /^virtual:m4-demo-fixture$/ }, (a) => ({ path: a.path, namespace: 'vdemo' }))
    b.onLoad({ filter: /.*/, namespace: 'vdemo' }, () => ({
      contents:
        'export const demoFixtureAvailable = false;\n'
        + 'export async function loadM4DemoFixture() { return null }\n',
      loader: 'js',
    }))
  },
}

// Carpeta dentro del árbol del repo para que `import 'react'` resuelva por node.
const CACHE_ROOT = join(process.cwd(), 'node_modules', '.cache', 'ssr-jsx-tests')

// Resuelve el entry: file:URL / ruta absoluta se usan tal cual (estilo #79); en otro
// caso se trata como ruta RELATIVA A LA RAÍZ del repo (estilo #78).
function resolveEntry(entry) {
  if (typeof entry === 'string' && entry.startsWith('file:')) return fileURLToPath(entry)
  if (isAbsolute(entry)) return entry
  return fileURLToPath(new URL('../../' + entry, import.meta.url))
}

/**
 * Empaqueta y carga el export default de un componente .jsx real.
 * @param {string} entry ruta relativa-a-raíz (#78) o absoluta/file:URL (#79)
 * @returns {Function & { Component: Function, mod: object, cleanup: () => Promise<void> }}
 */
export async function loadJsxDefault(entry) {
  const absEntry = resolveEntry(entry)
  const out = await build({
    entryPoints: [absEntry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: false,
    external: EXTERNAL,
    plugins: [virtualDemoStub],
    logLevel: 'silent',
  })
  const code = out.outputFiles[0].text
  await mkdir(CACHE_ROOT, { recursive: true })
  const dir = await mkdtemp(join(CACHE_ROOT, 'b-'))
  const file = join(dir, 'bundle.mjs')
  await writeFile(file, code, 'utf8')
  let mod
  try {
    mod = await import(pathToFileURL(file).href)
  } catch (err) {
    await rm(dir, { recursive: true, force: true })
    throw err
  }
  // el módulo ya vive en memoria ⇒ limpiar el bundle temporal de una vez.
  await rm(dir, { recursive: true, force: true })
  const Component = mod.default
  const cleanup = async () => {} // no-op idempotente (compat con el estilo destructurado)
  if (typeof Component === 'function') {
    // el resultado ES el componente (estilo #78) y además expone Component/mod/cleanup (#79)
    Component.Component = Component
    Component.mod = mod
    Component.cleanup = cleanup
    return Component
  }
  return { Component, mod, cleanup }
}

export { createElement, renderToStaticMarkup }

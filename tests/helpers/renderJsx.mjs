// Harness SSR para renderizar componentes REALES (.jsx) dentro de `node --test`.
//
// El repo no transpila JSX en `node --test`, así que empaquetamos el .jsx con
// esbuild (JSX automático) y lo importamos como ESM. React / react-dom / router
// se dejan EXTERNOS para reusar la copia instalada del proyecto (una sola
// instancia de React entre el componente y este harness). El bundle temporal se
// escribe dentro de node_modules/.cache para que la resolución de los externos
// (`import 'react'`) funcione al importarlo. El módulo virtual de Vite
// `virtual:m4-demo-fixture` se stubbea a un módulo inerte (sin demo), igual que
// haría Vite en un entorno sin la fixture. No se usa jsdom ni RTL (menor
// superficie de dependencias, en línea con el resto de la suite).
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const EXTERNAL = [
  'react',
  'react-dom',
  'react-dom/server',
  'react/jsx-runtime',
  'react-router-dom',
]

// Stub del módulo virtual de demo: en tests no hay fixture de demostración.
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

// Leaflet necesita DOM al inicializarse. Esbuild sigue imports dinámicos aun si
// el SSR no los ejecuta, así que este stub sólo cubre los tres imports concretos
// que usa el límite cliente de PositionMap; Vite de producción no lo recibe.
const leafletSsrStub = {
  name: 'leaflet-ssr-stub',
  setup(b) {
    // Las hojas de estilo son efectos de Vite; el SSR de pruebas sólo necesita
    // verificar la estructura React, no emitir un archivo CSS independiente.
    b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'css-ssr' }))
    b.onResolve({ filter: /^react-leaflet$/ }, (a) => ({ path: a.path, namespace: 'leaflet-ssr' }))
    b.onResolve({ filter: /^leaflet$/ }, (a) => ({ path: a.path, namespace: 'leaflet-ssr' }))
    b.onResolve({ filter: /^leaflet\/dist\/leaflet\.css$/ }, (a) => ({ path: a.path, namespace: 'leaflet-ssr' }))
    b.onLoad({ filter: /^react-leaflet$/, namespace: 'leaflet-ssr' }, () => ({
      contents:
        "import { createElement } from 'react';\n"
        + 'const inert = ({ children }) => createElement(\'div\', null, children);\n'
        + 'export const MapContainer = inert; export const TileLayer = inert; export const CircleMarker = inert; export const Marker = inert; export const Polyline = inert; export const Polygon = inert; export const Tooltip = inert;\n'
        + 'export const useMap = () => ({ invalidateSize() {}, fitBounds() {}, setView() {} });\n',
      loader: 'js',
    }))
    b.onLoad({ filter: /^leaflet$/, namespace: 'leaflet-ssr' }, () => ({
      contents: 'export const divIcon = (options) => options;\n',
      loader: 'js',
    }))
    b.onLoad({ filter: /^leaflet\/dist\/leaflet\.css$/, namespace: 'leaflet-ssr' }, () => ({
      contents: '', loader: 'js',
    }))
    b.onLoad({ filter: /.*/, namespace: 'css-ssr' }, () => ({ contents: '', loader: 'js' }))
  },
}

// Carpeta dentro del árbol del repo para que `import 'react'` resuelva por node.
const CACHE_ROOT = join(process.cwd(), 'node_modules', '.cache', 'ssr-jsx-tests')

/**
 * Empaqueta y carga el export default de un componente .jsx real.
 * @param {string} absEntry ruta absoluta al .jsx
 * @returns {{ Component: Function, mod: object, cleanup: () => Promise<void> }}
 */
export async function loadJsxDefault(absEntry) {
  const out = await build({
    entryPoints: [absEntry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: false,
    external: EXTERNAL,
    plugins: [virtualDemoStub, leafletSsrStub],
    logLevel: 'silent',
  })
  const code = out.outputFiles[0].text
  await mkdir(CACHE_ROOT, { recursive: true })
  const dir = await mkdtemp(join(CACHE_ROOT, 'b-'))
  const file = join(dir, 'bundle.mjs')
  await writeFile(file, code, 'utf8')
  try {
    const mod = await import(pathToFileURL(file).href)
    return { Component: mod.default, mod, cleanup: () => rm(dir, { recursive: true, force: true }) }
  } catch (err) {
    await rm(dir, { recursive: true, force: true })
    throw err
  }
}

export { createElement, renderToStaticMarkup }

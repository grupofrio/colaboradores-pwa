// Helper de render SSR para tests (Etapa 0A). Bundlea un .jsx real con esbuild
// (dep transitiva de Vite) y lo renderiza con react-dom/server, dejando React
// externo. Evita jsdom/RTL (que ampliarían la superficie de npm audit).
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as esbuild from 'esbuild'

let counter = 0

/** Compila (bundle) y carga el `default export` de un componente .jsx real. */
export async function loadJsxDefault(relFromRepoRoot) {
  const abs = fileURLToPath(new URL('../../' + relFromRepoRoot, import.meta.url))
  counter += 1
  const tmp = fileURLToPath(new URL(`../../.jsxssr_${process.pid}_${counter}.mjs`, import.meta.url))
  const built = await esbuild.build({
    entryPoints: [abs], bundle: true, write: false, format: 'esm', jsx: 'automatic',
    platform: 'node', logLevel: 'silent',
    external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime',
      'react/jsx-dev-runtime', 'react-router-dom'],
  })
  writeFileSync(tmp, built.outputFiles[0].text)
  try {
    return (await import('file://' + tmp)).default
  } finally {
    try { rmSync(tmp) } catch { /* noop */ }
  }
}

export { createElement, renderToStaticMarkup }

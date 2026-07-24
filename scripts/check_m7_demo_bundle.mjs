// KOLD OS · M7 — verificación de bundle: el fixture demo NO viaja en producción.
//
// Codex (auditoría final) clasificó como MAJOR que el fixture financiero agregado
// pudiera entrar al bundle productivo. En build de producción `virtual:m7-demo-
// fixture` resuelve al loader stub (demoFixtureLoader.prod.js), que NO importa el
// fixture; por tanto el módulo del fixture queda FUERA del grafo de producción.
//
// Este script escanea dist/ y falla si cualquier sentinel del fixture aparece en
// CUALQUIER asset productivo (main, vendor, chunk de la pantalla o cualquier otro).
// Sentinels = cadenas que SÓLO existen dentro del fixture (run_id, scope_key,
// content commit, un importe distintivo): no se apoya sólo en el nombre de archivo.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Cadenas presentes ÚNICAMENTE en el fixture demo (derivado del core del backend).
export const M7_DEMO_FIXTURE_SENTINELS = Object.freeze([
  'ad6c1f36409a1861b868bfab597a048701b24c6d413f8e5b24c423a4e66de93a', // run.run_id
  '3dd721df5f072f8f642cda4f7aeda5f9e71cb41ac56fa1755f0da08991089014', // run.scope_key
  '88c09f49f916c1596aa0f4b1ab62c5625a41c981',                         // provenance backend_content_commit
  'M7-A-01::confirmed_sales_orders_in_scope',                         // finding_key distintivo
  '297459.3',                                                         // invoice_revenue MXN untaxed_total
])

// Estas cadenas NO deben viajar en un chunk INICIAL/normal de navegación. Como en
// producción el fixture se excluye del todo, la política es: ausencia total en dist.
export function findM7DemoFixtureLeaks(assets) {
  const leaks = []
  for (const asset of assets) {
    for (const sentinel of M7_DEMO_FIXTURE_SENTINELS) {
      if (asset.content.includes(sentinel)) leaks.push({ name: asset.name, sentinel })
    }
  }
  return leaks
}

function readAssets(directory, root = directory) {
  const assets = []
  for (const entry of readdirSync(directory)) {
    const absolute = resolve(directory, entry)
    if (statSync(absolute).isDirectory()) assets.push(...readAssets(absolute, root))
    else assets.push({ name: absolute.slice(root.length + 1), content: readFileSync(absolute).toString('utf8') })
  }
  return assets
}

function main() {
  const dist = resolve(process.cwd(), 'dist')
  if (!existsSync(dist)) throw new Error(`Directorio de build no encontrado: ${dist}`)
  const leaks = findM7DemoFixtureLeaks(readAssets(dist))
  if (leaks.length) {
    for (const leak of leaks) {
      console.error(`M7 demo fixture leak: ${leak.name} contiene sentinel "${leak.sentinel}"`)
    }
    console.error('El fixture demo NO debe viajar en el bundle productivo (usa el import dinámico gated).')
    process.exitCode = 1
    return
  }
  console.log('M7 demo bundle check: OK (fixture ausente en dist productivo)')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) main()

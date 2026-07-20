// Verifica que los fixtures SINTÉTICOS de la home de operaciones del supervisor
// (day_control/1 + radar/1, módulo virtual `virtual:supervisor-daycontrol-demo`)
// NO se filtren al bundle de PRODUCCIÓN. En prod el alias resuelve al stub
// `demoLoader.prod.js`; este check falla el build si algún marcador del fixture
// aparece en dist. Espeja scripts/check_m4_fixture_leak.mjs.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DAYCONTROL_FIXTURE_MARKERS = Object.freeze([
  'BR-DEMO Sucursal Demo',
  'Chofer Demo Uno',
  'Ruta Demo Dos',
  'Unidad Demo A',
  'Datos de DEMOSTRACIÓN sintéticos (BR-DEMO). NO son operación real.',
])

export function findDayControlFixtureLeaks(assets) {
  const leaks = []
  for (const asset of assets) {
    for (const marker of DAYCONTROL_FIXTURE_MARKERS) {
      if (asset.content.includes(marker)) leaks.push({ name: asset.name, marker })
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
  const leaks = findDayControlFixtureLeaks(readAssets(dist))
  if (leaks.length) {
    for (const leak of leaks) console.error(`Supervisor day-control fixture leak: ${leak.name} contiene ${leak.marker}`)
    process.exitCode = 1
    return
  }
  console.log('Supervisor day-control fixture leak check: OK')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) main()

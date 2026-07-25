import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SUPERVISOR_DAY_CONTROL_BANNED = Object.freeze([
  'BR-DEMO',
  'Ruta Demo Uno',
  'gf.salesops.supervisor.radar/1',
  '10.5001',
  '-35.5001',
])

export function findSupervisorDayControlLeaks(assets) {
  const leaks = []
  for (const asset of assets) {
    for (const sentinel of SUPERVISOR_DAY_CONTROL_BANNED) {
      if (asset.content.includes(sentinel)) {
        leaks.push({ name: asset.name, sentinel })
      }
    }
  }
  return leaks
}

function readAssets(directory, root = directory) {
  const assets = []
  for (const entry of readdirSync(directory)) {
    const absolute = resolve(directory, entry)
    if (statSync(absolute).isDirectory()) {
      assets.push(...readAssets(absolute, root))
      continue
    }
    assets.push({
      name: relative(root, absolute),
      content: readFileSync(absolute).toString('utf8'),
    })
  }
  return assets
}

function main() {
  const assetsDirectory = resolve(process.cwd(), 'dist/assets')
  if (!existsSync(assetsDirectory)) {
    throw new Error(`Directorio de assets no encontrado: ${assetsDirectory}`)
  }

  const assets = readAssets(assetsDirectory)
  const leaks = findSupervisorDayControlLeaks(assets)
  if (leaks.length > 0) {
    for (const leak of leaks) {
      console.error(
        `Supervisor day control leak: ${leak.name} contiene sentinel "${leak.sentinel}"`,
      )
    }
    console.error(
      `Supervisor day control leak check: FAIL (${leaks.length} hallazgos en ${assets.length} assets)`,
    )
    process.exitCode = 1
    return
  }

  console.log(
    `Supervisor day control leak check: OK (${assets.length} assets revisados)`,
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (import.meta.url === invokedPath) main()

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const M4_FIXTURE_MARKERS = Object.freeze([
  '3eeffd889b5902fb31f88f6573589afde0b166bc',
  '978994c49baefac9da010580667ae89a8f7251d5',
  '438 partners',
  '2,333',
  '1,620',
  '78 de 584 (13.36%)',
  '168 de 752 (22.34%)',
  '"total_incidences":12158',
  '"confirmed_count":12606',
  '"product_line_count":13778',
  '"warning_count":6537',
  '"exploratory_signal_count":5621',
])

export function findM4FixtureLeaks(assets) {
  const leaks = []
  for (const asset of assets) {
    for (const marker of M4_FIXTURE_MARKERS) {
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
  const leaks = findM4FixtureLeaks(readAssets(dist))
  if (leaks.length) {
    for (const leak of leaks) console.error(`M4 fixture leak: ${leak.name} contiene ${leak.marker}`)
    process.exitCode = 1
    return
  }
  console.log('M4 fixture leak check: OK')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) main()

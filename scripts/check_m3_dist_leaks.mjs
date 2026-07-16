import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  M3_API_FIXTURE_PROVENANCE, M3_API_LATEST_FIXTURE,
} from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'

const escapePattern = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const MARKERS = Object.freeze([
  ['demo_run_id', new RegExp(escapePattern(M3_API_LATEST_FIXTURE.run.run_id))],
  ['auditor_sha', new RegExp(escapePattern(M3_API_LATEST_FIXTURE.run.auditor_build_sha))],
  ['manifest_sha', new RegExp(escapePattern(M3_API_LATEST_FIXTURE.run.manifest_sha256))],
  ['fixture_provenance', new RegExp(escapePattern(M3_API_FIXTURE_PROVENANCE.kind))],
  ['measured_total_incidences', new RegExp(
    `total_incidences["']?\\s*[:=]\\s*${M3_API_LATEST_FIXTURE.summary.total_incidences}`,
  )],
])

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.map', '.txt'])

function walkTextFiles(root, output = []) {
  for (const entry of readdirSync(root)) {
    const file = path.join(root, entry)
    if (statSync(file).isDirectory()) walkTextFiles(file, output)
    else if (TEXT_EXTENSIONS.has(path.extname(file))) output.push(file)
  }
  return output
}

export function scanM3DistLeaks(distDir) {
  if (!existsSync(distDir)) throw new Error(`dist no existe: ${distDir}`)
  const leaks = []
  for (const file of walkTextFiles(distDir)) {
    const source = readFileSync(file, 'utf8')
    for (const [marker, pattern] of MARKERS) {
      if (pattern.test(source)) leaks.push({ file: path.relative(distDir, file), marker })
    }
  }
  return leaks
}

const invokedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (invokedAsScript) {
  const distDir = path.resolve(process.argv[2] || fileURLToPath(new URL('../dist', import.meta.url)))
  const leaks = scanM3DistLeaks(distDir)
  if (leaks.length > 0) {
    console.error(`M3 fixture leak detectado:\n${JSON.stringify(leaks, null, 2)}`)
    process.exitCode = 1
  } else {
    console.log('M3 dist leak scan: OK')
  }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const componentUrl = new URL('../src/modules/supervisor-ventas/UnitTrackMap.jsx', import.meta.url)
const packageUrl = new URL('../package.json', import.meta.url)
const packageLockUrl = new URL('../package-lock.json', import.meta.url)

function stripComments(source) {
  let cleaned = ''
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (character === '\n') {
        lineComment = false
        cleaned += character
      }
      continue
    }

    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      cleaned += character
      if (character === '\\') {
        cleaned += next ?? ''
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (character === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (character === '\'' || character === '"' || character === '`') quote = character
    cleaned += character
  }

  return cleaned
}

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'))
}

async function readComponent() {
  return stripComments(await readFile(componentUrl, 'utf8'))
}

test('UnitTrackMap is a read-only Leaflet view with the required operational geometry', async () => {
  const source = await readComponent()
  const reactLeafletImports = [...source.matchAll(/import\s*\{([^{}]*)\}\s*from\s*['"]react-leaflet['"]/g)]

  assert.equal(reactLeafletImports.length, 1)
  assert.deepEqual(
    reactLeafletImports[0][1].split(',').map((name) => name.trim()).filter(Boolean).sort(),
    ['CircleMarker', 'MapContainer', 'Polyline', 'TileLayer', 'Tooltip', 'useMap'].sort(),
  )
  assert.match(source, /import\s+['"]leaflet\/dist\/leaflet\.css['"]/)
  assert.match(source, /import\s*{\s*buildUnitTrackBounds\s*}\s*from\s*['"]\.\/unitTrackState\.js['"]/)
  assert.match(source, /export function UnitTrackMap\(\{ track, typo \}\)/)
  assert.match(source, /const bounds = buildUnitTrackBounds\(track\)/)
  assert.match(source, /if \(bounds\.length === 0\) return null/)
  assert.equal((source.match(/<MapContainer\b/g) ?? []).length, 1)
  assert.ok(source.indexOf('if (bounds.length === 0) return null') < source.indexOf('<MapContainer'))
  assert.match(source, /<div\s+style=\{\{\s*height:\s*280,\s*minHeight:\s*280,\s*width:\s*['"]100%['"]/)
  assert.match(source, /<MapContainer[\s\S]*?style=\{\{\s*height:\s*['"]100%['"],\s*minHeight:\s*280/)
  assert.match(source, /url=['"]https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png['"]/)
  assert.match(source, /attribution=/)
  assert.match(source, /\{trailPositions\.length >= 2 && \(\s*<Polyline\s+positions=\{trailPositions\}\s+color="#2563eb"/)
  assert.match(source, /\{plannedPosition && \(\s*<CircleMarker\s+center=\{plannedPosition\}[^>]*color="#d97706"/)
  assert.match(source, /\{checkinPosition && \(\s*<CircleMarker\s+center=\{checkinPosition\}[^>]*color="#15803d"/)
  assert.match(source, /\{currentPosition && \(\s*<CircleMarker\s+center=\{currentPosition\}[^>]*color="#2563eb"[\s\S]*?<Tooltip[^>]*>[\s\S]*?Hora:[\s\S]*?Velocidad:/)
  assert.match(source, /function MapViewport\(\{ bounds \}\)[\s\S]*?const map = useMap\(\)/)
  assert.match(source, /if \(bounds\.length >= 2\)[\s\S]*map\.fitBounds/)
  assert.match(source, /map\.setView\(bounds\[0\], SINGLE_POINT_ZOOM\)/)
  assert.match(source, /map\.invalidateSize\(\)/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /\b(?:axios|XMLHttpRequest|sendBeacon)\b/)
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|removeItem|clear)\s*\(/)
  assert.doesNotMatch(source, /\b(?:indexedDB|caches)\s*\.\s*\w+\s*\(/)
  assert.doesNotMatch(source, /\b(?:POST|PUT|PATCH|DELETE)\b/)
})

test('UnitTrackMap locks the React 18-compatible Leaflet dependency pair', async () => {
  const packageJson = await readJson(packageUrl)
  const packageLock = await readJson(packageLockUrl)

  assert.equal(packageJson.dependencies.leaflet, '^1.9.4')
  assert.equal(packageJson.dependencies['react-leaflet'], '^4.2.1')
  assert.equal(packageLock.packages[''].dependencies.leaflet, '^1.9.4')
  assert.equal(packageLock.packages[''].dependencies['react-leaflet'], '^4.2.1')
  assert.equal(packageLock.packages['node_modules/leaflet'].version, '1.9.4')
  assert.equal(packageLock.packages['node_modules/react-leaflet'].version, '4.2.1')
  assert.equal(packageLock.packages['node_modules/react-leaflet'].peerDependencies.react, '^18.0.0')
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const rootUrl = new URL('../', import.meta.url)
const packageJson = JSON.parse(
  await readFile(new URL('package.json', rootUrl), 'utf8'),
)
const packageLock = JSON.parse(
  await readFile(new URL('package-lock.json', rootUrl), 'utf8'),
)

function releaseLine(versionRange) {
  if (typeof versionRange !== 'string') return ''

  const match = versionRange.match(/^\^?(\d+)\.(\d+)\.\d+$/)
  return match ? `${match[1]}.${match[2]}` : ''
}

async function readOptionalRootNpmrc() {
  try {
    return await readFile(new URL('.npmrc', rootUrl), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

test('declares the React family on the 19.2 release line without install bypasses', async () => {
  const declared = {
    react: packageJson.dependencies?.react,
    'react-dom': packageJson.dependencies?.['react-dom'],
    '@types/react': packageJson.devDependencies?.['@types/react'],
    '@types/react-dom': packageJson.devDependencies?.['@types/react-dom'],
    'react-test-renderer':
      packageJson.devDependencies?.['react-test-renderer'],
  }

  for (const dependency of [
    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
    'react-test-renderer',
  ]) {
    assert.equal(
      releaseLine(declared[dependency]),
      '19.2',
      `${dependency} must declare React 19.2.x`,
    )
  }

  assert.equal(
    packageJson.overrides,
    undefined,
    'React alignment must not rely on package.json overrides',
  )

  const npmrc = await readOptionalRootNpmrc()
  assert.doesNotMatch(
    npmrc,
    /^\s*(legacy-peer-deps|force)\s*=\s*true\s*$/im,
    'React alignment must not rely on npm install bypasses',
  )
})

test('locks the React runtime and type packages to one 19.2 release line', () => {
  const lockedReact = packageLock.packages?.['node_modules/react']?.version
  const lockedReactDom =
    packageLock.packages?.['node_modules/react-dom']?.version
  const lockedRenderer =
    packageLock.packages?.['node_modules/react-test-renderer']?.version
  const lockedReactTypes =
    packageLock.packages?.['node_modules/@types/react']?.version
  const lockedReactDomTypes =
    packageLock.packages?.['node_modules/@types/react-dom']?.version

  assert.equal(releaseLine(lockedReact), '19.2', 'react must lock React 19.2.x')
  assert.equal(
    releaseLine(lockedReactDom),
    '19.2',
    'react-dom must lock React 19.2.x',
  )
  assert.equal(
    releaseLine(lockedRenderer),
    '19.2',
    'react-test-renderer must lock React 19.2.x',
  )
  assert.equal(
    releaseLine(lockedReactTypes),
    '19.2',
    '@types/react must lock React 19.2.x',
  )
  assert.equal(
    releaseLine(lockedReactDomTypes),
    '19.2',
    '@types/react-dom must lock React 19.2.x',
  )
  assert.equal(
    lockedReactDom,
    lockedReact,
    'react-dom must lock exactly the same version as react',
  )
  assert.equal(
    lockedRenderer,
    lockedReact,
    'react-test-renderer must lock exactly the same version as react',
  )
})

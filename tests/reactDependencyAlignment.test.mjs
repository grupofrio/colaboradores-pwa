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
const reactFamilyPackages = [
  'react',
  'react-dom',
  'react-test-renderer',
  '@types/react',
  '@types/react-dom',
]
const exactVersionReactPackages = [
  'react',
  'react-dom',
  'react-test-renderer',
]

function releaseLine(versionRange) {
  if (typeof versionRange !== 'string') return ''

  const match = versionRange.match(/^\^?(\d+)\.(\d+)\.\d+$/)
  return match ? `${match[1]}.${match[2]}` : ''
}

function stripInlineNpmrcComment(line) {
  let quote = ''

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (quote) {
      if (character === quote && line[index - 1] !== '\\') quote = ''
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
    } else if (character === '#' || character === ';') {
      return line.slice(0, index)
    }
  }

  return line
}

function hasEnabledInstallBypass(npmrc) {
  for (const logicalLine of npmrc.split(/\r?\n/)) {
    const assignment = stripInlineNpmrcComment(logicalLine).trim()
    if (!assignment) continue

    const match = assignment.match(/^(legacy-peer-deps|force)\s*=\s*(.*?)\s*$/i)
    if (!match) continue

    let value = match[2].trim()
    const quote = value[0]
    if (
      value.length >= 2 &&
      (quote === '"' || quote === "'") &&
      value.at(-1) === quote
    ) {
      value = value.slice(1, -1).trim()
    }

    if (value.toLowerCase() === 'true') return true
  }

  return false
}

async function readOptionalRootNpmrc() {
  try {
    return await readFile(new URL('.npmrc', rootUrl), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

function assertReactFamilyLockAlignment(candidatePackageLock) {
  const collected = Object.fromEntries(
    reactFamilyPackages.map((packageName) => [packageName, []]),
  )

  for (const [lockPath, metadata] of Object.entries(
    candidatePackageLock.packages ?? {},
  )) {
    const packageName = reactFamilyPackages.find((candidate) => {
      const packagePath = `node_modules/${candidate}`
      return lockPath === packagePath || lockPath.endsWith(`/${packagePath}`)
    })

    if (packageName) {
      collected[packageName].push({ path: lockPath, version: metadata?.version })
    }
  }

  for (const packageName of reactFamilyPackages) {
    assert.notEqual(
      collected[packageName].length,
      0,
      `${packageName} must be present in package-lock.json`,
    )

    for (const { path, version } of collected[packageName]) {
      assert.equal(
        releaseLine(version),
        '19.2',
        `${packageName} at ${path} must lock React 19.2.x`,
      )
    }
  }

  const exactVersions = Object.fromEntries(
    exactVersionReactPackages.map((packageName) => {
      const versions = [
        ...new Set(collected[packageName].map(({ version }) => version)),
      ]
      assert.equal(
        versions.length,
        1,
        `${packageName} must lock exactly one version`,
      )
      return [packageName, versions[0]]
    }),
  )

  assert.equal(
    exactVersions['react-dom'],
    exactVersions.react,
    'react-dom must lock exactly the same version as react',
  )
  assert.equal(
    exactVersions['react-test-renderer'],
    exactVersions.react,
    'react-test-renderer must lock exactly the same version as react',
  )
}

test('recognizes enabled npm install bypasses across npmrc syntax', async (t) => {
  const cases = [
    ['plain true', 'force=true', true],
    ['double-quoted true', 'legacy-peer-deps="true"', true],
    ["single-quoted true", "force='true'", true],
    ['true with hash comment', 'force=true # explanation', true],
    [
      'true with semicolon comment',
      'legacy-peer-deps=true ; explanation',
      true,
    ],
    ['whitespace and case variants', '  FoRcE = TrUe  ', true],
    ['false value', 'force=false', false],
    ['hash-commented setting', '# force=true', false],
    ['semicolon-commented setting', '; legacy-peer-deps=true', false],
    ['unrelated key', 'audit=true', false],
    ['value containing true', 'force=truely', false],
    ['quoted string not exactly true', 'force="true enough"', false],
  ]

  for (const [name, npmrc, expected] of cases) {
    await t.test(name, () => {
      assert.equal(hasEnabledInstallBypass(npmrc), expected)
    })
  }
})

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
  assert.equal(
    hasEnabledInstallBypass(npmrc),
    false,
    'React alignment must not rely on npm install bypasses',
  )
})

test('rejects a nested conflicting React lockfile version', () => {
  const nestedConflictLock = {
    packages: {
      'node_modules/react': { version: '19.2.8' },
      'node_modules/react-dom': { version: '19.2.8' },
      'node_modules/react-test-renderer': { version: '19.2.8' },
      'node_modules/@types/react': { version: '19.2.17' },
      'node_modules/@types/react-dom': { version: '19.2.3' },
      'node_modules/example/node_modules/react': { version: '18.3.1' },
    },
  }

  assert.throws(
    () => assertReactFamilyLockAlignment(nestedConflictLock),
    /node_modules\/example\/node_modules\/react/,
  )
})

test('locks the React runtime and type packages to one 19.2 release line', () => {
  assertReactFamilyLockAlignment(packageLock)
})

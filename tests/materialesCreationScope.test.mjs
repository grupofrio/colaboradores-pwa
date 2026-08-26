import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const issueSource = fs.readFileSync(new URL('../src/modules/almacen-pt/ScreenMaterialesIssue.jsx', import.meta.url), 'utf8')

test('ScreenMaterialesIssue only enables create CTA for almacen pt materiales base', () => {
  assert.equal(
    issueSource.includes("const canCreateIssue = String(materialesBasePath || '').startsWith('/almacen-pt/materiales')"),
    true,
  )
})

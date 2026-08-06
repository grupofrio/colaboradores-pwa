import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('gasoline form keeps generic expense flow and resets mode and route only after success', async () => {
  const source = await readFile(new URL('../src/modules/admin/forms/AdminGastosForm.jsx', import.meta.url), 'utf8')
  assert.match(source, /createFuelExpense\(/)
  assert.match(source, /getFuelRoutes\(date\)/)
  assert.match(source, /setExpenseMode\('general'\)/)
  assert.match(source, /setFuelRouteId\(''\)/)
  assert.match(source, /route_plan_id: Number\(fuelRouteId\)/)
  assert.match(source, /\/pwa-admin\/fuel-evidence-upload/)
  assert.match(source, /evidence_token: uploadedFuelEvidenceToken/)
  assert.match(source, /No hay rutas elegibles con vehículo y operador/)
})

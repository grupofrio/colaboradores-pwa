// KOLD OS · M7 — Loader del fixture demo (DEV/Preview). Este archivo SÍ importa
// el fixture; `virtual:m7-demo-fixture` resuelve aquí SÓLO en dev/test/preview.
// En build de producción resuelve a demoFixtureLoader.prod.js (sin este import),
// de modo que el fixture financiero jamás entra al bundle productivo.
import { M7_API_FIXTURE_PROVENANCE, M7_API_LATEST_FIXTURE } from './fixtures/apiLatestFixture'

export const demoFixtureAvailable = true

export async function loadM7DemoFixture() {
  return { payload: M7_API_LATEST_FIXTURE, provenance: M7_API_FIXTURE_PROVENANCE }
}

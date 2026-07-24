import {
  M4_API_FIXTURE_PROVENANCE,
  M4_API_LATEST_FIXTURE,
} from './fixtures/apiLatestFixture'

export const demoFixtureAvailable = true

export async function loadM4DemoFixture() {
  return {
    payload: M4_API_LATEST_FIXTURE,
    provenance: M4_API_FIXTURE_PROVENANCE,
  }
}

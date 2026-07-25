// KOLD OS · M7 — Loader del fixture demo (PRODUCCIÓN). NO importa el fixture: el
// módulo del fixture queda fuera del grafo de producción y no viaja en el bundle.
// `virtual:m7-demo-fixture` resuelve aquí en build de producción.
export const demoFixtureAvailable = false

export async function loadM7DemoFixture() {
  return null
}

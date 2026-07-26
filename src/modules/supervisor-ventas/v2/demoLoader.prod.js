// ─── Supervisor V2 · stub de DEMO para PRODUCCIÓN ────────────────────────────
// El alias `virtual:supervisor-v2-demo` apunta aquí en build de prod: los
// fixtures sintéticos quedan FUERA del bundle. En producción la experiencia solo
// muestra datos LIVE del backend (#220) o estados de error honestos.
export const demoAvailable = false

export async function loadSupervisorV2Demo() {
  return null
}

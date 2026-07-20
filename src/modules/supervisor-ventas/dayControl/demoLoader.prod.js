// ─── Day Control · stub de DEMO para PRODUCCIÓN ──────────────────────────────
// El alias `virtual:supervisor-daycontrol-demo` apunta aquí en build de prod, de
// modo que los fixtures sintéticos quedan FUERA del bundle de producción. En
// producción no hay demo: la home solo muestra datos LIVE del backend (#220) o
// un estado de error honesto.
export const demoAvailable = false

export async function loadDayControlDemo() {
  return null
}

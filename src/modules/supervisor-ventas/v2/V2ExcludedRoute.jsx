// ─── Supervisor V2 · ruta EXCLUIDA de V2 (Codex §2/§3) ───────────────────────
// Para pantallas legacy que NO deben ser navegables con Supervisor V2 ON porque
// su backend es inseguro o no está auditado (Tareas/Notas/Nota rápida/Bajas):
//   · V2 ON  → pantalla "no disponible en la nueva experiencia" SIN montar la
//     pantalla legacy y SIN ejecutar ningún fetch legacy (deep-link seguro).
//   · V2 OFF → se renderiza la pantalla legacy intacta (experiencia legacy).
import StateScreen from '../../../components/kold/StateScreen'
import { isV2Active } from './gateAccess.js'

export default function V2ExcludedRoute({ legacy, title = 'No disponible en la nueva experiencia' }) {
  if (isV2Active()) {
    // NO se monta la pantalla legacy (no hay fetch): solo un estado seguro.
    return (
      <StateScreen
        testid="v2-excluded"
        title={title}
        detail="Esta función aún no está migrada a la experiencia nueva del supervisor. Usa el menú para volver."
        tone="warning"
        actionLabel="Ir a Hoy"
        actionHref="/equipo"
      />
    )
  }
  return legacy
}

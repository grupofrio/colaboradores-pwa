// ─── Supervisor V2 · ruta EXCLUIDA de V2 (Codex §2/§3) ───────────────────────
// Para pantallas legacy que NO deben ser navegables con Supervisor V2 ON porque
// su backend es inseguro o no está auditado (Tareas/Notas/Nota rápida/Bajas):
//   · V2 ON  → pantalla "no disponible en la nueva experiencia" SIN montar la
//     pantalla legacy y SIN ejecutar ningún fetch legacy (deep-link seguro).
//   · V2 OFF → se renderiza la pantalla legacy intacta (experiencia legacy).
//
// RED Codex P1 (MGR-05): estas pantallas legacy ESCRIBEN por endpoints inseguros
// (auth="api_key" + sudo, sin rol/scope). La pestaña Equipo del shell del
// gerente (EquipoGerenteTab) enlaza a estas MISMAS rutas /equipo/*; si algún
// día el guard de esas rutas se amplía a gerente_sucursal, el gerente NO debe
// montar estas superficies de escritura por deep-link cuando el flag del
// supervisor está OFF. La rama legacy se reserva al supervisor REAL (job_key
// supervisor_ventas): cualquier otro rol —gerente incluido— cae SIEMPRE al
// estado seguro, sin importar el flag del supervisor.
import StateScreen from '../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../theme/brandTokens'
import { useSession } from '../../../App'
import { getEffectiveJobKeys } from '../../../lib/roleContext'
import { isV2Active } from './gateAccess.js'

export default function V2ExcludedRoute({ legacy, title = 'No disponible en la nueva experiencia' }) {
  const { session } = useSession()
  const isRealSupervisor = getEffectiveJobKeys(session).includes('supervisor_ventas')
  if (isV2Active() || !isRealSupervisor) {
    // NO se monta la pantalla legacy (no hay fetch): solo un estado seguro.
    return (
      <StateScreen tokens={BRAND_TOKENS}
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

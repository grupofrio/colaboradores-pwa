import { ScreenShell, EmptyState } from '../entregas/components'

export default function ScreenBajasSugey() {
  return (
    <ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas">
      <EmptyState icon="📋" title="Verificacion Sugey" subtitle="Modulo en preparacion" />
    </ScreenShell>
  )
}

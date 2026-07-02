import { ScreenShell, EmptyState } from '../entregas/components'

export default function ScreenBajasSugeyDetail() {
  return (
    <ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas/sugey">
      <EmptyState icon="📋" title="Verificacion Sugey" subtitle="Modulo en preparacion" />
    </ScreenShell>
  )
}

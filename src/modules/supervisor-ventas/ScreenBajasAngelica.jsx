import { ScreenShell, EmptyState } from '../entregas/components'

export default function ScreenBajasAngelica() {
  return (
    <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas">
      <EmptyState icon="📋" title="Visto bueno Angelica" subtitle="Modulo en preparacion" />
    </ScreenShell>
  )
}

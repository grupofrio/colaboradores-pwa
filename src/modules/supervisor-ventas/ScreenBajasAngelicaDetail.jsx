import { ScreenShell, EmptyState } from '../entregas/components'

export default function ScreenBajasAngelicaDetail() {
  return (
    <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas/angelica">
      <EmptyState icon="📋" title="Visto bueno Angelica" subtitle="Modulo en preparacion" />
    </ScreenShell>
  )
}

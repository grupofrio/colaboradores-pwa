import { ScreenShell, EmptyState } from '../entregas/components'

export default function ScreenBajasHub() {
  return (
    <ScreenShell title="Bajas controladas" backTo="/equipo">
      <EmptyState icon="📋" title="Bajas controladas" subtitle="Modulo en preparacion" />
    </ScreenShell>
  )
}

// ─── Supervisor V2 · MasTab (contenedor) ─────────────────────────────────────
// Contenedor mínimo de la superficie "Más": no carga datos (los accesos son
// estáticos), solo inyecta la navegación del router en la vista PURA MasView.
import { useNavigate } from 'react-router-dom'
import MasView from '../mas/MasView'

export default function MasTab() {
  const navigate = useNavigate()
  return <MasView onNavigate={navigate} />
}

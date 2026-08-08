// ─── ScreenGastos — un solo formulario de gastos, para todos ────────────────
// Antes esta ruta bifurcaba por ancho de ventana (umbral 1024px): en escritorio
// servía `AdminGastosForm` (con analítica, almacén y adjunto) y en móvil
// `GastosScreenBase`, una versión degradada SIN analítica, SIN almacén, SIN
// adjunto y con la lista rota. Esa versión degradada era además la única que
// veía el gerente en /gerente/gastos, en cualquier tamaño de pantalla.
//
// De ahí salen los gastos sin clasificar: la capturista que trabaja desde el
// teléfono no tenía forma de clasificar aunque quisiera.
//
// Ahora hay UN formulario responsive para las dos rutas y los dos tamaños.
import { useNavigate } from 'react-router-dom'
import { AdminProvider } from './AdminContext'
import AdminShell from './components/AdminShell'
import AdminGastosForm from './forms/AdminGastosForm'

export default function ScreenGastos({ title = 'Gastos', backRoute = null }) {
  const navigate = useNavigate()
  return (
    <AdminProvider>
      <AdminShell
        activeBlock="gastos"
        title={title}
        onBack={backRoute ? () => navigate(backRoute) : undefined}
      >
        <AdminGastosForm />
      </AdminShell>
    </AdminProvider>
  )
}

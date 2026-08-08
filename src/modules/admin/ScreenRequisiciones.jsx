// ─── ScreenRequisiciones — una sola captura, con producto de catálogo ───────
// Antes esta ruta bifurcaba por ancho de ventana (umbral 1024px). La rama móvil
// capturaba el producto como TEXTO LIBRE: mandaba el nombre escrito a mano y no
// el identificador real del catálogo. Una requisición así no se puede costear,
// no se puede recibir contra un producto real y no lleva analítica.
//
// Se elimina esa rama. `AdminRequisicionForm` ya usa `ProductPicker` (catálogo
// real) y ahora se sirve en los dos tamaños de pantalla.
import { AdminProvider } from './AdminContext'
import AdminShell from './components/AdminShell'
import AdminRequisicionForm from './forms/AdminRequisicionForm'

export default function ScreenRequisiciones() {
  return (
    <AdminProvider>
      <AdminShell activeBlock="requisiciones" title="Requisiciones" hideActivityFeed>
        <AdminRequisicionForm />
      </AdminShell>
    </AdminProvider>
  )
}

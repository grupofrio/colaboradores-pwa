// El gerente usa EXACTAMENTE el mismo formulario que el auxiliar. Antes veía
// `GastosScreenBase`, la versión degradada —sin analítica, sin almacén, sin
// adjunto y con la lista rota— en cualquier tamaño de pantalla.
import ScreenGastos from '../admin/ScreenGastos'

export default function ScreenGastosGerente() {
  return <ScreenGastos title="Gastos de Gerencia" backRoute="/gerente" />
}

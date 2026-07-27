import { getNightTodaySales } from './api'
import ScreenRestrictedPosSales, {
  formatRestrictedPosSaleTime,
} from './ScreenRestrictedPosSales'
import { NIGHT_POS_FLOW } from './posFlow'

// Compatibilidad para imports existentes; el formatter vive en la pantalla compartida.
// eslint-disable-next-line react-refresh/only-export-components
export const formatNightPosSaleTime = formatRestrictedPosSaleTime

export default function ScreenNightPosSales() {
  return (
    <ScreenRestrictedPosSales
      flow={NIGHT_POS_FLOW}
      loadSales={getNightTodaySales}
      screenName="POS nocturno"
    />
  )
}

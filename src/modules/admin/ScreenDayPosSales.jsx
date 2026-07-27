import { getDayTodaySales } from './api'
import ScreenRestrictedPosSales from './ScreenRestrictedPosSales'
import { DAY_POS_FLOW } from './posFlow'

export default function ScreenDayPosSales() {
  return (
    <ScreenRestrictedPosSales
      flow={DAY_POS_FLOW}
      loadSales={getDayTodaySales}
      screenName="POS día"
    />
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

import ScreenControlComercial from './ScreenControlComercial'
import ScreenSupervisorToday from './ScreenSupervisorToday'
import {
  SupervisorOperationsSwitch as PureSupervisorOperationsSwitch,
} from './dayControl/SupervisorOperationsSwitch'
import { loadSupervisorOperationDays } from './dayControl/controller.js'
import { stateCopy } from './dayControl/state.js'

const idleState = () => ({ kind: 'idle' })

export function SupervisorOperationsSwitch({
  todayState,
  yesterdayState,
  activeDay,
  onSelectDay,
  onRefresh,
  LegacyComponent = ScreenControlComercial,
  OperationsComponent = ScreenSupervisorToday,
}) {
  return (
    <PureSupervisorOperationsSwitch
      todayState={todayState}
      yesterdayState={yesterdayState}
      activeDay={activeDay}
      onSelectDay={onSelectDay}
      onRefresh={onRefresh}
      LegacyComponent={LegacyComponent}
      OperationsComponent={OperationsComponent}
    />
  )
}

export default function ScreenSupervisorOperationsEntry() {
  const [todayState, setTodayState] = useState(() => stateCopy('loading'))
  const [yesterdayState, setYesterdayState] = useState(idleState)
  const [activeDay, setActiveDay] = useState('today')
  const requestGenerationRef = useRef(0)

  const refresh = useCallback(() => {
    requestGenerationRef.current += 1
    const generation = requestGenerationRef.current

    setActiveDay('today')
    setTodayState(stateCopy('loading'))
    setYesterdayState({ kind: 'idle' })

    loadSupervisorOperationDays({
      onToday: (state) => {
        if (requestGenerationRef.current !== generation) return
        setTodayState(state)
      },
      onYesterdayLoading: (state) => {
        if (requestGenerationRef.current !== generation) return
        setYesterdayState(state)
      },
    }).then(({ today, yesterday }) => {
      if (requestGenerationRef.current !== generation) return
      setTodayState(today)
      setYesterdayState(yesterday)
    }).catch(() => {
      if (requestGenerationRef.current !== generation) return
      setTodayState(stateCopy('error'))
      setYesterdayState({ kind: 'idle' })
    })
  }, [])

  useEffect(() => {
    refresh()
    return () => {
      requestGenerationRef.current += 1
    }
  }, [refresh])

  const selectDay = useCallback((day) => {
    setActiveDay(day === 'yesterday' ? 'yesterday' : 'today')
  }, [])

  return (
    <SupervisorOperationsSwitch
      todayState={todayState}
      yesterdayState={yesterdayState}
      activeDay={activeDay}
      onSelectDay={selectDay}
      onRefresh={refresh}
    />
  )
}

import { useEffect, useState } from 'react'
import { useSession } from '../../App'
import { fetchCapacitacion, fetchMe, mergeCapacitacionAndMe } from './talentoApi.js'
import CapacitacionScreenView from './ScreenMiCapacitacionView.jsx'

export default function ScreenMiCapacitacion() {
  const { session } = useSession()
  const [result, setResult] = useState({ status: 'loading' })

  function load() {
    setResult({ status: 'loading' })
    Promise.allSettled([fetchCapacitacion(), fetchMe()]).then(([capRes, meRes]) => {
      setResult(mergeCapacitacionAndMe(capRes, meRes))
    })
  }

  useEffect(() => { load() }, [session?.employee_id])

  return <CapacitacionScreenView result={result} onRetry={load} />
}

import { useEffect, useState } from 'react'
import { getCapabilitiesRevision, subscribeCapabilitiesChanged } from './adminService'

/** Re-render when the capability singleton changes. Does not copy identity. */
export function useCapabilitiesRevision() {
  const [revision, setRevision] = useState(getCapabilitiesRevision)
  useEffect(() => subscribeCapabilitiesChanged(() => {
    setRevision(getCapabilitiesRevision())
  }), [])
  return revision
}

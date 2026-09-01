import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { resetLegacyPwaState } from './pwa/resetLegacyPwaState.js'
import { reloadOnceForStaleChunk } from './pwa/cachePolicy.js'

const buildId = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : ''

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('unhandledrejection', (event) => {
    reloadOnceForStaleChunk(globalThis, event?.reason, { buildId })
  })
}

resetLegacyPwaState(globalThis, { buildId }).then((result) => {
  if (result?.reloaded) return
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}).catch(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

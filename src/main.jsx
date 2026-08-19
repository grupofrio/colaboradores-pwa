import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { resetLegacyPwaState } from './pwa/resetLegacyPwaState.js'

const buildId = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : ''

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

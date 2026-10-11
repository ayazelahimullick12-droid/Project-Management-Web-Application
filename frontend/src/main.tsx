/**
 * Start-up: apply BRAC branding, load the demo data into the browser, start the simulated
 * background worker (reminders, lock timeouts), then show the app.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import { applyBrand } from './theme/brand'
import { initStore } from './demo/store'
import { startWorker } from './demo/worker'
import { App } from './App'

applyBrand()

initStore()
  .then(async () => {
    startWorker()
    if (import.meta.env.DEV) {
      // Development only: lets you try api calls from the browser console, e.g. __api.projects.dashboard()
      const [{ api }, store, session] = await Promise.all([import('./api'), import('./demo/store'), import('./demo/session')])
      Object.assign(window, { __api: api, __state: store.getState, __as: session.setSessionUserId })
    }
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((err) => {
    document.getElementById('root')!.innerHTML = `<pre style="padding:24px;color:#8a1c1c">Could not load the demo data: ${String(err)}</pre>`
    console.error(err)
  })

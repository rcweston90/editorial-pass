if ("serviceWorker" in navigator) { void navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { void r.unregister() }) }) }
if (typeof caches !== "undefined") { void caches.keys().then(function (keys) { keys.forEach(function (k) { void caches.delete(k) }) }) }

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

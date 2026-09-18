import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider"
import { redirectLegacyHashLocation } from "@/lib/legacyHash"
import './index.css'

// Hard-replace before createRoot so BrowserRouter never commits `/` + `#/...`
// as the public marketing homepage. Auth guards then see the history URL.
if (!redirectLegacyHashLocation()) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </React.StrictMode>,
  )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider"
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>,
)

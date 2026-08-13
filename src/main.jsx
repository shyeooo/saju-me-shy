import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SharedResult from './SharedResult.jsx'
import { isResultPath, parseShareIdFromLocation } from './share.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isResultPath() ? (
      <SharedResult shareId={parseShareIdFromLocation()} />
    ) : (
      <App />
    )}
  </StrictMode>,
)

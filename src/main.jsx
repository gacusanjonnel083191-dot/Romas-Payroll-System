import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './cashAdvanceCompactLayout.css'
import App from './App.jsx'
import { installCashAdvanceCompactLayout } from './cashAdvanceCompactLayout.js'
import { installApprovalProcessingGuard } from './approvalProcessingGuard.js'

installApprovalProcessingGuard()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

installCashAdvanceCompactLayout()

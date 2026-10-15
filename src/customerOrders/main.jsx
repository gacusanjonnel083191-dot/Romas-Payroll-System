import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import StaffOrderQueue from './StaffOrderQueue.jsx'
import './staff.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><StaffOrderQueue /></StrictMode>,
)

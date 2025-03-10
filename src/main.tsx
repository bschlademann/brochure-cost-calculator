import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BrochureCalculator from './BrochureCalculator.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrochureCalculator />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerOfflineApp } from './lib/pwa'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

if (import.meta.env.MODE !== 'test') registerOfflineApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><TooltipProvider><App /><Toaster position="bottom-right" closeButton richColors visibleToasts={4} /></TooltipProvider></ThemeProvider>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { NotificationProvider } from './components/NotificationProvider'
import { AuthProvider } from './auth/AuthContext'
import { AppearanceProvider } from './providers/AppearanceProvider'
import { AudioProvider } from './providers/AudioProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <AppearanceProvider>
            <AudioProvider>
              <App />
            </AudioProvider>
          </AppearanceProvider>
        </AuthProvider>
      </NotificationProvider>
    </AppErrorBoundary>
  </StrictMode>,
)

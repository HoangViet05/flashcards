import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Navbar from './components/Navbar'

const HomePage = lazy(() => import('./pages/HomePage'))
const DeckDetailPage = lazy(() => import('./pages/DeckDetailPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const ReaderListPage = lazy(() => import('./pages/ReaderListPage'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const ShadowingPage = lazy(() => import('./pages/ShadowingPage'))
const DailyPage = lazy(() => import('./pages/DailyPage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageFallback />
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
            <Route path="/decks/:id" element={<RequireAuth><DeckDetailPage /></RequireAuth>} />
            <Route path="/daily" element={<RequireAuth><DailyPage /></RequireAuth>} />
            <Route path="/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
            <Route path="/reader" element={<RequireAuth><ReaderListPage /></RequireAuth>} />
            <Route path="/reader/:id" element={<RequireAuth><ReaderPage /></RequireAuth>} />
            <Route path="/games" element={<Navigate to="/daily" replace />} />
            <Route path="/shadowing" element={<RequireAuth><ShadowingPage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Navbar from './components/Navbar'

const HomePage = lazy(() => import('./pages/HomePage'))
const DeckDetailPage = lazy(() => import('./pages/DeckDetailPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const DocumentListPage = lazy(() => import('./pages/DocumentListPage'))
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const ReaderListPage = lazy(() => import('./pages/ReaderListPage'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))
const GamesPage = lazy(() => import('./pages/GamesPage'))

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
            <Route path="/decks/:id" element={<RequireAuth><DeckDetailPage /></RequireAuth>} />
            <Route path="/review" element={<RequireAuth><ReviewPage /></RequireAuth>} />
            <Route path="/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
            <Route path="/documents" element={<RequireAuth><DocumentListPage /></RequireAuth>} />
            <Route path="/documents/:id" element={<RequireAuth><DocumentDetailPage /></RequireAuth>} />
            <Route path="/reader" element={<RequireAuth><ReaderListPage /></RequireAuth>} />
            <Route path="/reader/:id" element={<RequireAuth><ReaderPage /></RequireAuth>} />
            <Route path="/games" element={<RequireAuth><GamesPage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

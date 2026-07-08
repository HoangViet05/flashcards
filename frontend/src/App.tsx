import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import DeckDetailPage from './pages/DeckDetailPage'
import ReviewPage from './pages/ReviewPage'
import StatsPage from './pages/StatsPage'
import DocumentListPage from './pages/DocumentListPage'
import DocumentDetailPage from './pages/DocumentDetailPage'
import AuthPage from './pages/AuthPage'
import AccountPage from './pages/AccountPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/decks/:id" element={<DeckDetailPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/documents" element={<DocumentListPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

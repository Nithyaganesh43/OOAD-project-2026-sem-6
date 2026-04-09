import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AdminDashboardPage from './pages/AdminDashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import UserDashboardPage from './pages/UserDashboardPage'

function App() {
  const { isAuthenticated, isAdmin, isUser } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to={isAdmin ? '/admin' : '/user'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute role="user" />}>
        <Route path="/user" element={<UserDashboardPage />} />
      </Route>

      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to={isUser ? '/user' : '/admin'} replace />
          ) : (
            <NotFoundPage />
          )
        }
      />
    </Routes>
  )
}

export default App

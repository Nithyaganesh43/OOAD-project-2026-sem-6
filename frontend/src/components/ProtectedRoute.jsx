import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ role }) => {
  const { isAuthenticated, isInitializing, user } = useAuth()

  if (isInitializing) {
    return <div className="screen-center">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace />
  }

  return <Outlet />
}

export default ProtectedRoute

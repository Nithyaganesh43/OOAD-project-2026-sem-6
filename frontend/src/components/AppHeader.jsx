import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AppHeader = ({ title, subtitle }) => {
  const { user, logout } = useAuth()

  return (
    <header className="app-header">
      <div className="header-copy">
        <p className="eyebrow">Task Allocation Platform</p>
        <h1>{title || 'Task Allocation & Time Tracking'}</h1>
        <p className="header-subtitle">{subtitle || 'Operations dashboard for project delivery'}</p>
      </div>

      <nav className="header-nav">
        <div className="user-badge">
          <strong>{user?.name || 'Signed in'}</strong>
          <span>{user?.role === 'admin' ? 'Administrator' : 'Team member'}</span>
        </div>
        {user?.role === 'admin' ? (
          <NavLink to="/admin" className="nav-chip">
            Admin Dashboard
          </NavLink>
        ) : (
          <NavLink to="/user" className="nav-chip">
            User Dashboard
          </NavLink>
        )}

        <button className="btn btn-secondary" onClick={logout}>
          Logout
        </button>
      </nav>
    </header>
  )
}

export default AppHeader

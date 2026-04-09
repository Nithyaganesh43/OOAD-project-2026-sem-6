import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
  const { login, isAuthenticated, isAdmin, isUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const redirectPath = useMemo(() => {
    if (isAdmin) return '/admin'
    if (isUser) return '/user'
    return '/login'
  }, [isAdmin, isUser])

  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const response = await login({ email, password })

    if (!response.ok) {
      setError(response.message)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="screen-center login-shell">
      <section className="panel login-panel">
        <div>
          <p className="eyebrow">Secure Access</p>
          <h2>Task Allocation Platform</h2>
          <p className="muted">
            Sign in with admin or user credentials to access your dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@email.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="hint-box">
          <p className="small muted">Default admin for demo</p>
          <p className="small">admin@email.com / admin@123</p>
        </div>
      </section>
    </div>
  )
}

export default LoginPage

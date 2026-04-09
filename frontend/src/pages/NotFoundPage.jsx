import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <div className="screen-center">
      <div className="panel">
        <h2>Page not found</h2>
        <p className="muted">The page you requested does not exist.</p>
        <Link className="btn btn-primary" to="/login">
          Go to login
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage

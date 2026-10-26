import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

export default function RequireAuth({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

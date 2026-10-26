import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'

export default function Login() {
  const { status, signIn, completeNewPassword } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'signedIn') {
    return <Navigate to={location.state?.from?.pathname ?? '/recipes'} replace />
  }

  const submit = (action) => async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await action()
    } catch (err) {
      setError(err.message ?? 'Sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  const needsNewPassword = status === 'newPasswordRequired'

  return (
    <div className="mx-auto grid min-h-svh max-w-sm content-center px-4">
      <h1 className="mb-6 text-center text-3xl font-bold tracking-tight">Rolodex</h1>

      {needsNewPassword ? (
        <form className="card grid gap-4" onSubmit={submit(() => completeNewPassword(newPassword))}>
          <p className="text-sm">Choose a new password to finish signing in.</p>
          <label className="grid gap-1 text-sm font-medium">
            New password
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn btn-primary justify-center" disabled={submitting}>
            Set password
          </button>
        </form>
      ) : (
        <form className="card grid gap-4" onSubmit={submit(() => signIn(email, password))}>
          <label className="grid gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              className="input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary justify-center"
            disabled={submitting}
          >
            Sign in
          </button>
        </form>
      )}
    </div>
  )
}

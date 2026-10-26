import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// Wraps a CognitoAuth instance (from @rolodex/client) for React.
// status: 'signedOut' | 'newPasswordRequired' | 'signedIn'
export function AuthProvider({ auth, client, children }) {
  const [status, setStatus] = useState(() => (auth.isSignedIn ? 'signedIn' : 'signedOut'))
  const [email, setEmail] = useState(() => auth.email)

  const apply = ({ status }) => {
    setStatus(status)
    setEmail(auth.email)
  }

  const value = {
    status,
    email,
    client,
    signIn: async (username, password) => apply(await auth.signIn(username, password)),
    completeNewPassword: async (newPassword) =>
      apply(await auth.completeNewPassword(newPassword)),
    signOut: async () => {
      await auth.signOut()
      apply({ status: 'signedOut' })
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

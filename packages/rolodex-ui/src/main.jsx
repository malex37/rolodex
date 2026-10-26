import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { createServices } from './client.js'
import { loadConfig } from './config.js'

const root = createRoot(document.getElementById('root'))

try {
  const { auth, client } = createServices(await loadConfig())

  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider auth={auth} client={client}>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
} catch (error) {
  console.error(error)
  root.render(
    <p className="p-8 text-center text-red-600">Rolodex failed to start: {error.message}</p>,
  )
}

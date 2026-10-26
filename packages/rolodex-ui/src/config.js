const KEYS = ['region', 'apiUrl', 'userPoolId', 'userPoolClientId', 'identityPoolId']

// Deployed builds read /config.json, written by the CDK stack next to the site.
// Local dev reads VITE_* variables from packages/rolodex-ui/.env.local instead.
export async function loadConfig() {
  const config = import.meta.env.DEV
    ? {
        region: import.meta.env.VITE_REGION,
        apiUrl: import.meta.env.VITE_API_URL,
        userPoolId: import.meta.env.VITE_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
        identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
      }
    : await fetch('/config.json').then((res) => {
        if (!res.ok) throw new Error(`Could not load /config.json (${res.status})`)
        return res.json()
      })

  const missing = KEYS.filter((key) => !config[key])
  if (missing.length > 0) {
    throw new Error(`Missing config: ${missing.join(', ')}`)
  }
  return config
}

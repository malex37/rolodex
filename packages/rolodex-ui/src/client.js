import { CognitoAuth, RolodexClient } from '@rolodex/client'

function browserStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined // private mode / blocked storage: fall back to in-memory
  }
}

export function createServices(config) {
  const auth = new CognitoAuth({
    region: config.region,
    userPoolId: config.userPoolId,
    userPoolClientId: config.userPoolClientId,
    identityPoolId: config.identityPoolId,
    storage: browserStorage(),
  })

  const client = new RolodexClient({
    baseUrl: config.apiUrl,
    region: config.region,
    getCredentials: () => auth.getCredentials(),
  })

  return { auth, client }
}

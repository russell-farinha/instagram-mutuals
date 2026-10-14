const key = 'mutuals.apify-token'
let memoryToken: string | undefined

export function getToken(): string | undefined {
  try {
    return localStorage.getItem(key) ?? memoryToken
  } catch {
    return memoryToken
  }
}

export function setToken(token: string, remember: boolean): void {
  memoryToken = token
  try {
    if (remember) localStorage.setItem(key, token)
    else localStorage.removeItem(key)
  } catch {
    /* private browsing can block storage */
  }
}

export function clearToken(): void {
  memoryToken = undefined
  try {
    localStorage.removeItem(key)
  } catch {
    /* private browsing can block storage */
  }
}

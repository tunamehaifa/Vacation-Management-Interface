import axios, { AxiosError } from 'axios'

const TOKEN_KEY = 'vacation.token'

/** The JWT lives in localStorage (see README, "Technical decisions"). */
export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** One Axios instance for the whole app: base URL, token, error handling. */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8888',
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onSessionExpired: () => void = () => {}

/** Called by the auth store, so this module does not depend on the store or the router. */
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // A 401 on a request that carried a token means the session is over.
    // A 401 from the login form itself (no token) is just a wrong password.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      onSessionExpired()
    }
    return Promise.reject(error)
  },
)

/** The API answers errors as { error: { code, message, details? } }. */
export const errorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the server. Is the API running?'
    const message = (error.response.data as { error?: { message?: string } })?.error?.message
    if (message) return message
  }
  return fallback
}

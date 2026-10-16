import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { authApi, type User } from '@/api/auth'
import { setSessionExpiredHandler, tokenStorage } from '@/api/http'

/**
 * The signed-in user. The token is kept in localStorage; the user object is
 * not stored, it is fetched from GET /auth/me when the app starts.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  /** Set when the API rejected our token, so the login page can say why. */
  const sessionExpired = ref(false)
  const isAuthenticated = computed(() => user.value !== null)

  let restoring: Promise<void> | null = null

  /** Restores the session after a page reload. Runs once; later calls reuse it. */
  function restoreSession(): Promise<void> {
    restoring ??= (async () => {
      if (!tokenStorage.get()) return
      try {
        user.value = await authApi.me()
      } catch (error) {
        // Only a 401 means the token is bad. If the API is unreachable, keep
        // the token: the next reload restores the session once it is back.
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          expireSession()
        }
      }
    })()
    return restoring
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await authApi.login(email, password)
    tokenStorage.set(response.token)
    user.value = response.user
    sessionExpired.value = false
  }

  function logout(): void {
    tokenStorage.clear()
    user.value = null
  }

  function expireSession(): void {
    logout()
    sessionExpired.value = true
  }

  return { user, sessionExpired, isAuthenticated, restoreSession, login, logout, expireSession }
})

/** Wires the Axios 401 hook to the store; `onExpired` decides where to go next. */
export const handleExpiredSessions = (onExpired: () => void) => {
  setSessionExpiredHandler(() => {
    const auth = useAuthStore()
    // During restoreSession() nobody is signed in yet; the router guard handles that case.
    if (!auth.isAuthenticated) return
    auth.expireSession()
    onExpired()
  })
}

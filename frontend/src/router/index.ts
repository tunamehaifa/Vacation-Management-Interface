import { createRouter, createWebHistory } from 'vue-router'
import type { UserRole } from '@/api/auth'
import { handleExpiredSessions, useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'
import LoginView from '@/views/LoginView.vue'
import HomeView from '@/views/HomeView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for signed-out users (the login page). */
    guestOnly?: boolean
    /** Needs a signed-in user; with `roles`, one of these roles. */
    requiresAuth?: boolean
    roles?: UserRole[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [{ path: '', name: 'home', component: HomeView }],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.restoreSession()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    const query: Record<string, string> = {}
    if (to.fullPath !== '/') query.redirect = to.fullPath
    if (auth.sessionExpired) query.expired = '1'
    return { name: 'login', query }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }
  const roles = to.matched.flatMap((record) => record.meta.roles ?? [])
  if (roles.length && auth.user && !roles.includes(auth.user.role)) {
    return { name: 'home' }
  }
})

// Token expired while using the app: back to the login page, then back to where the user was.
handleExpiredSessions(() => {
  const redirect = router.currentRoute.value.fullPath
  router.replace({ name: 'login', query: { expired: '1', ...(redirect !== '/' && { redirect }) } })
})

export default router

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseButton from './BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()

/** Each role sees only the pages it can open. */
const links = computed(() =>
  auth.user?.role === 'Validator'
    ? [
        { to: { name: 'dashboard' }, label: 'Dashboard' },
        { to: { name: 'team' }, label: 'Team' },
      ]
    : [
        { to: { name: 'my-requests' }, label: 'My requests' },
        { to: { name: 'team' }, label: 'Team' },
      ],
)

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <div class="flex min-w-0 items-center gap-6">
        <RouterLink to="/" class="shrink-0 text-lg font-semibold text-gray-900">
          <span class="sm:hidden">Vacations</span>
          <span class="hidden sm:inline">Vacation Management</span>
        </RouterLink>
        <nav v-if="auth.user" class="hidden gap-1 sm:flex" aria-label="Main">
          <RouterLink
            v-for="link in links"
            :key="link.label"
            :to="link.to"
            class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            active-class="bg-gray-100 text-gray-900"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>

      <div v-if="auth.user" class="flex min-w-0 items-center gap-3">
        <div class="min-w-0 text-right leading-tight">
          <p class="truncate text-sm font-medium text-gray-900">{{ auth.user.name }}</p>
          <p class="hidden text-xs text-gray-500 sm:block">{{ auth.user.role }}</p>
        </div>
        <BaseButton variant="secondary" class="whitespace-nowrap" @click="logout">Log out</BaseButton>
      </div>
    </div>

    <!-- On phones the links get their own row under the bar. -->
    <nav v-if="auth.user" class="flex gap-1 border-t border-gray-100 px-4 py-2 sm:hidden" aria-label="Main">
      <RouterLink
        v-for="link in links"
        :key="link.label"
        :to="link.to"
        class="flex-1 rounded-md px-3 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100"
        active-class="bg-gray-100 text-gray-900"
      >
        {{ link.label }}
      </RouterLink>
    </nav>
  </header>
</template>

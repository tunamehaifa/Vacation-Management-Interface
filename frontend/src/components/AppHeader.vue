<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseButton from './BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <RouterLink to="/" class="shrink-0 text-lg font-semibold text-gray-900">
        <span class="sm:hidden">Vacations</span>
        <span class="hidden sm:inline">Vacation Management</span>
      </RouterLink>

      <div v-if="auth.user" class="flex min-w-0 items-center gap-3">
        <div class="min-w-0 text-right leading-tight">
          <p class="truncate text-sm font-medium text-gray-900">{{ auth.user.name }}</p>
          <p class="hidden text-xs text-gray-500 sm:block">{{ auth.user.role }}</p>
        </div>
        <BaseButton variant="secondary" class="whitespace-nowrap" @click="logout">Log out</BaseButton>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <h1 class="text-2xl font-semibold text-gray-900">Welcome, {{ auth.user?.name }}</h1>
  <p class="mt-2 text-gray-600">Vacation requests will appear here.</p>
</template>

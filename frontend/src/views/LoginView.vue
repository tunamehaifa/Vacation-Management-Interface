<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import AlertMessage from '@/components/AlertMessage.vue'
import BaseButton from '@/components/BaseButton.vue'
import FormField from '@/components/FormField.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (err) {
    error.value = errorMessage(err, 'Could not sign in')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-center text-2xl font-semibold text-gray-900">Vacation Management</h1>
      <p class="mt-1 text-center text-sm text-gray-600">Sign in to your account</p>

      <form class="mt-8 space-y-5 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200" @submit.prevent="submit">
        <AlertMessage v-if="route.query.expired" variant="info">
          Your session has expired. Please sign in again.
        </AlertMessage>
        <AlertMessage v-if="error">{{ error }}</AlertMessage>

        <FormField v-model="email" label="Email" type="email" autocomplete="username" required />
        <FormField
          v-model="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          required
        />

        <BaseButton type="submit" :loading="submitting" class="w-full">Sign in</BaseButton>
      </form>
    </div>
  </div>
</template>

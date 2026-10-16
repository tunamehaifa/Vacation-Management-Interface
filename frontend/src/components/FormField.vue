<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  label: string
  type?: string
  required?: boolean
  autocomplete?: string
  error?: string
}>()

const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div>
    <label :for="id" class="block text-sm font-medium text-gray-900">
      {{ label }}
      <span v-if="required" class="text-red-600" aria-hidden="true">*</span>
    </label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :required="required"
      :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined"
      class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset sm:text-sm"
      :class="{ 'ring-red-500': error }"
    />
    <p v-if="error" class="mt-1 text-sm text-red-600">{{ error }}</p>
  </div>
</template>

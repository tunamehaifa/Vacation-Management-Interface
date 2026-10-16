<script setup lang="ts">
import { useId } from 'vue'

/**
 * A labelled input (or textarea) with an error message. Any other attribute
 * (min, max, maxlength, placeholder...) is passed to the input itself.
 */
defineOptions({ inheritAttrs: false })

defineProps<{
  label: string
  type?: string
  required?: boolean
  autocomplete?: string
  error?: string
  hint?: string
  multiline?: boolean
}>()

const model = defineModel<string>({ default: '' })
const id = useId()

const controlClass =
  'mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset sm:text-sm'
</script>

<template>
  <div>
    <label :for="id" class="block text-sm font-medium text-gray-900">
      {{ label }}
      <span v-if="required" class="text-red-600" aria-hidden="true">*</span>
    </label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
      rows="3"
      :class="[controlClass, { 'ring-red-500': error }]"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :type="type ?? 'text'"
      :required="required"
      :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
      :class="[controlClass, { 'ring-red-500': error }]"
    />
    <p v-if="error" :id="`${id}-help`" class="mt-1 text-sm text-red-600">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-help`" class="mt-1 text-sm text-gray-500">{{ hint }}</p>
  </div>
</template>

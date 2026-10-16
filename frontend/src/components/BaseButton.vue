<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger'
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', type: 'button', loading: false, disabled: false },
)

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600',
  secondary:
    'bg-white text-gray-700 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus-visible:outline-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600',
}

const classes = computed(() => variants[props.variant])
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="classes"
    class="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'error' | 'info' | 'success' }>(), { variant: 'error' })

const variants = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
  success: 'bg-green-50 text-green-800 ring-green-200',
}
</script>

<template>
  <div
    :role="variant === 'error' ? 'alert' : 'status'"
    :class="variants[variant]"
    class="rounded-md px-4 py-3 text-sm ring-1 ring-inset"
  >
    <slot />
  </div>
</template>

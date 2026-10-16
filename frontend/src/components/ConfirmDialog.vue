<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseDialog from './BaseDialog.vue'
import AlertMessage from './AlertMessage.vue'

/** "Are you sure?" with a confirm and a back button. */
withDefaults(
  defineProps<{
    title: string
    confirmLabel?: string
    variant?: 'primary' | 'danger'
    loading?: boolean
    error?: string
  }>(),
  { confirmLabel: 'Confirm', variant: 'primary', loading: false, error: '' },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <BaseDialog v-model:open="open" :title="title">
    <div class="text-sm text-gray-600"><slot /></div>
    <AlertMessage v-if="error" class="mt-4">{{ error }}</AlertMessage>
    <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <BaseButton variant="secondary" :disabled="loading" @click="open = false">Back</BaseButton>
      <BaseButton :variant="variant" :loading="loading" @click="emit('confirm')">
        {{ confirmLabel }}
      </BaseButton>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue'

/**
 * A modal dialog on the native <dialog> element, which already handles focus,
 * Esc to close and the backdrop. Open/close it with v-model:open.
 */
defineProps<{ title: string }>()

const open = defineModel<boolean>('open', { default: false })
const dialog = ref<HTMLDialogElement>()
const titleId = useId()

watch(open, (isOpen) => {
  if (isOpen && !dialog.value?.open) dialog.value?.showModal()
  if (!isOpen && dialog.value?.open) dialog.value.close()
})

// Esc or form[method=dialog] closes the element itself: keep the model in sync.
const onClose = () => (open.value = false)

// A click on the backdrop (the dialog element itself, outside its panel) closes it.
const onClick = (event: MouseEvent) => {
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-gray-900/50"
    :aria-labelledby="titleId"
    @close="onClose"
    @click="onClick"
  >
    <div class="p-6">
      <h2 :id="titleId" class="text-lg font-semibold text-gray-900">{{ title }}</h2>
      <div class="mt-4">
        <slot v-if="open" />
      </div>
    </div>
  </dialog>
</template>

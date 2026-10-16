<script setup lang="ts">
import { computed } from 'vue'

/**
 * "Showing 11–20 of 37 requests" with ‹ 1 2 3 … 8 › buttons.
 * Bind the current page with v-model:page. Hidden when everything fits on one page.
 */
const props = withDefaults(
  defineProps<{
    total: number
    limit: number
    /** What is being counted, plural: "requests", "people". */
    noun?: string
  }>(),
  { noun: 'items' },
)

const page = defineModel<number>('page', { required: true })

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)))
const firstShown = computed(() => (props.total === 0 ? 0 : (page.value - 1) * props.limit + 1))
const lastShown = computed(() => Math.min(page.value * props.limit, props.total))

/** Pages to show: first, last, and two around the current one; gaps become "…". */
const pages = computed<(number | '…')[]>(() => {
  const keep = new Set([1, totalPages.value, page.value - 1, page.value, page.value + 1])
  const result: (number | '…')[] = []
  for (let n = 1; n <= totalPages.value; n++) {
    if (keep.has(n)) result.push(n)
    else if (result.at(-1) !== '…') result.push('…')
  }
  return result
})

const go = (target: number) => {
  if (target >= 1 && target <= totalPages.value) page.value = target
}

const buttonClass =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40'
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="flex flex-col items-center justify-between gap-3 sm:flex-row"
    aria-label="Pagination"
  >
    <p class="text-sm text-gray-600">
      Showing <span class="font-medium">{{ firstShown }}–{{ lastShown }}</span> of
      <span class="font-medium">{{ total }}</span> {{ noun }}
    </p>

    <div class="flex items-center gap-1">
      <button
        type="button"
        :class="buttonClass"
        class="text-gray-700 hover:bg-gray-100"
        :disabled="page <= 1"
        aria-label="Previous page"
        @click="go(page - 1)"
      >
        ‹
      </button>
      <template v-for="(item, index) in pages" :key="`${item}-${index}`">
        <span v-if="item === '…'" class="px-1 text-gray-400" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          :class="[buttonClass, item === page ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100']"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="`Page ${item}`"
          @click="go(item)"
        >
          {{ item }}
        </button>
      </template>
      <button
        type="button"
        :class="buttonClass"
        class="text-gray-700 hover:bg-gray-100"
        :disabled="page >= totalPages"
        aria-label="Next page"
        @click="go(page + 1)"
      >
        ›
      </button>
    </div>
  </nav>
</template>

import { ref, type Ref } from 'vue'
import { errorMessage } from '@/api/http'
import type { Page } from '@/api/vacationRequests'

/**
 * Loads one page of a list and keeps its items, total, loading state and error.
 *
 * - When requests are answered out of order (quick clicks), only the latest counts.
 * - A page past the end (the last item of the last page was removed, or an old
 *   link) moves to the last real page through `goToPage`.
 */
export function usePagedList<T>(options: {
  fetch: () => Promise<Page<T>>
  page: Ref<number>
  goToPage: (page: number) => void
  errorText: string
}) {
  const items = ref([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(true)
  const error = ref('')

  let latest = 0
  async function load() {
    const request = ++latest
    loading.value = true
    error.value = ''
    try {
      const result = await options.fetch()
      if (request !== latest) return
      if (result.items.length === 0 && options.page.value > 1) {
        options.goToPage(Math.max(1, result.totalPages))
        return
      }
      items.value = result.items
      total.value = result.total
    } catch (failure) {
      if (request === latest) error.value = errorMessage(failure, options.errorText)
    } finally {
      if (request === latest) loading.value = false
    }
  }

  return { items, total, loading, error, load }
}

import { onBeforeUnmount, ref } from 'vue'

/**
 * A success message that disappears after a few seconds, so an old one never
 * sits next to a new error.
 */
export function useNotice(durationMs = 4000) {
  const notice = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(message: string) {
    notice.value = message
    clearTimeout(timer)
    timer = setTimeout(() => (notice.value = ''), durationMs)
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { notice, show }
}

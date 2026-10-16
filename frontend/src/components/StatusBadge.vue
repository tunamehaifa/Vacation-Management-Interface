<script setup lang="ts">
import type { VacationRequestStatus } from '@/api/vacationRequests'

defineProps<{ status: VacationRequestStatus }>()

const styles: Record<VacationRequestStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  Approved: 'bg-green-50 text-green-700 ring-green-600/20',
  Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
}
</script>

<template>
  <span
    :class="styles[status]"
    class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
  >
    {{ status }}
  </span>
</template>

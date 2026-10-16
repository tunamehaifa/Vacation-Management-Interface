<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { errorMessage } from '@/api/http'
import { teamApi } from '@/api/team'
import type { VacationRequest } from '@/api/vacationRequests'
import { useAuthStore } from '@/stores/auth'
import { addMonths, daysInclusive, formatDate, formatMonth, monthEnd, monthStart, todayIso } from '@/utils/dates'
import AlertMessage from '@/components/AlertMessage.vue'
import BaseButton from '@/components/BaseButton.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import VacationTimeline from '@/components/VacationTimeline.vue'

/** Team planning (both roles): who is away when, one month at a time. */

const auth = useAuthStore()
const isValidator = computed(() => auth.user?.role === 'Validator')

const month = ref(monthStart(todayIso()))
const from = computed(() => month.value)
const to = computed(() => monthEnd(month.value))

const vacations = ref<VacationRequest[]>([])
const loading = ref(true)
const loadError = ref('')
const selected = ref<VacationRequest | null>(null)

// Requests can be answered out of order when clicking quickly; only the latest counts.
let latest = 0
async function load() {
  const request = ++latest
  loading.value = true
  loadError.value = ''
  try {
    const result = await teamApi.vacations(from.value, to.value)
    if (request === latest) vacations.value = result.items
  } catch (error) {
    if (request === latest) loadError.value = errorMessage(error, 'Could not load the team calendar')
  } finally {
    if (request === latest) loading.value = false
  }
}

watch(
  month,
  () => {
    selected.value = null
    load()
  },
  { immediate: true },
)

const goTo = (offset: number) => (month.value = addMonths(month.value, offset))
const goToday = () => (month.value = monthStart(todayIso()))
const isCurrentMonth = computed(() => month.value === monthStart(todayIso()))

function select(vacation: VacationRequest) {
  selected.value = selected.value?.id === vacation.id ? null : vacation
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Team planning</h1>
        <p class="mt-1 text-sm text-gray-600">Who is away when — approved and pending vacations.</p>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="secondary" aria-label="Previous month" @click="goTo(-1)">‹ Prev</BaseButton>
        <BaseButton variant="secondary" :disabled="isCurrentMonth" @click="goToday">Today</BaseButton>
        <BaseButton variant="secondary" aria-label="Next month" @click="goTo(1)">Next ›</BaseButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-gray-900" aria-live="polite">{{ formatMonth(month) }}</h2>
      <div class="flex items-center gap-4 text-sm text-gray-600">
        <span class="flex items-center gap-1.5">
          <span class="h-3 w-5 rounded-sm bg-green-500" aria-hidden="true" /> Approved
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="h-3 w-5 rounded-sm ring-1 ring-amber-400 ring-inset"
            style="background: repeating-linear-gradient(135deg, rgb(251 191 36) 0 4px, rgb(254 243 199) 4px 8px)"
            aria-hidden="true"
          />
          Pending
        </span>
      </div>
    </div>

    <AlertMessage v-if="loadError">{{ loadError }}</AlertMessage>

    <div :class="{ 'opacity-60 transition-opacity': loading }" :aria-busy="loading">
      <VacationTimeline
        :from="from"
        :to="to"
        :vacations="vacations"
        :selected-id="selected?.id"
        @select="select"
      />
    </div>

    <!-- Details of the bar that was clicked or tapped -->
    <section
      v-if="selected"
      class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
      aria-live="polite"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="font-semibold text-gray-900">{{ selected.user?.name }}</h3>
        <StatusBadge :status="selected.status" />
      </div>
      <p class="mt-1 text-sm text-gray-700">
        {{ formatDate(selected.startDate) }} – {{ formatDate(selected.endDate) }} ·
        {{ daysInclusive(selected.startDate, selected.endDate) }} days
      </p>
      <p v-if="selected.reason" class="mt-1 text-sm break-words text-gray-600">{{ selected.reason }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <RouterLink
          v-if="isValidator && selected.status === 'Pending'"
          :to="{ name: 'dashboard', query: { request: selected.id } }"
          class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Review on dashboard
        </RouterLink>
        <BaseButton variant="secondary" @click="selected = null">Close</BaseButton>
      </div>
    </section>
  </div>
</template>

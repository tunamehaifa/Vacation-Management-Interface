<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/http'
import { teamApi } from '@/api/team'
import type { VacationRequest } from '@/api/vacationRequests'
import { useAuthStore } from '@/stores/auth'
import { addMonths, daysInclusive, formatDate, formatMonth, monthEnd, monthStart, todayIso } from '@/utils/dates'
import AlertMessage from '@/components/AlertMessage.vue'
import BaseButton from '@/components/BaseButton.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import VacationTimeline from '@/components/VacationTimeline.vue'

/**
 * Team planning (both roles): who is away when, one month at a time.
 * The month and the page live in the URL (/team?month=2026-11&page=2),
 * so a reload, the back button and a shared link all show the same view.
 */

const auth = useAuthStore()
const isValidator = computed(() => auth.user?.role === 'Validator')
const route = useRoute()
const router = useRouter()

const PEOPLE_PER_PAGE = 10
const currentMonth = () => monthStart(todayIso())

/** "2026-11" from the URL → "2026-11-01"; anything else → null. */
function monthFromQuery(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  return `${value}-01`
}

function pageFromQuery(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  return Number(value)
}

const month = computed(() => monthFromQuery(route.query.month) ?? currentMonth())
const page = computed(() => pageFromQuery(route.query.page) ?? 1)
const from = computed(() => month.value)
const to = computed(() => monthEnd(month.value))

/** Moves to another month or page; a new history entry, so Back returns to the previous view. */
function show(target: { month?: string; page?: number }, replace = false) {
  const query = {
    ...route.query,
    month: (target.month ?? month.value).slice(0, 7),
    page: String(target.page ?? page.value),
  }
  return replace ? router.replace({ query }) : router.push({ query })
}

// Missing or broken keys (e.g. /team from the header) are filled in, without an extra history entry.
watch(
  () => [route.query.month, route.query.page],
  () => {
    if (route.name !== 'team') return // leaving the page
    if (monthFromQuery(route.query.month) && pageFromQuery(route.query.page)) return
    show({}, true)
  },
  { immediate: true },
)

const vacations = ref<VacationRequest[]>([])
const totalPeople = ref(0)
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
    const result = await teamApi.vacations(from.value, to.value, { page: page.value, limit: PEOPLE_PER_PAGE })
    if (request !== latest) return
    // A page past the end (an old link, fewer people now): show the last real one.
    if (result.items.length === 0 && page.value > 1) {
      show({ page: Math.max(1, result.totalPages) }, true)
      return
    }
    vacations.value = result.items
    totalPeople.value = result.total
  } catch (error) {
    if (request === latest) loadError.value = errorMessage(error, 'Could not load the team calendar')
  } finally {
    if (request === latest) loading.value = false
  }
}

watch(
  [month, page],
  () => {
    if (route.name !== 'team') return
    selected.value = null
    load()
  },
  { immediate: true },
)

// A new month starts again at its first page of people.
const goTo = (offset: number) => show({ month: addMonths(month.value, offset), page: 1 })
const goToday = () => show({ month: currentMonth(), page: 1 })
const isCurrentMonth = computed(() => month.value === currentMonth())
const changePage = (target: number) => show({ page: target })

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
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
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
        <span class="flex items-center gap-1.5">
          <span
            class="h-3 w-5 bg-gray-400"
            style="clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 50%, calc(100% - 5px) 100%, 0 100%)"
            aria-hidden="true"
          />
          Continues next / previous month
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
      <PaginationBar
        :page="page"
        class="mt-4"
        :total="totalPeople"
        :limit="PEOPLE_PER_PAGE"
        noun="people away this month"
        @update:page="changePage"
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

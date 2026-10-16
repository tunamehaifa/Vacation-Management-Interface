<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { errorMessage } from '@/api/http'
import { usersApi, type UserSummary } from '@/api/users'
import {
  vacationRequestsApi,
  type VacationRequest,
  type VacationRequestStatus,
} from '@/api/vacationRequests'
import { daysInclusive, formatDate } from '@/utils/dates'
import AlertMessage from '@/components/AlertMessage.vue'
import BaseButton from '@/components/BaseButton.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ReviewDialog, { type ReviewMode } from '@/components/ReviewDialog.vue'
import StatusBadge from '@/components/StatusBadge.vue'

/**
 * Validator dashboard: every request, filtered by status and employee, with
 * Approve / Reject. The filters, the page and an opened request live in the URL
 * (/dashboard?status=Pending&user=…&page=2&request=…), so a reload, the back
 * button and links from other pages (Team) all work.
 */

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 10
const STATUSES = ['Pending', 'Approved', 'Rejected', 'All'] as const
type StatusFilter = (typeof STATUSES)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (value: unknown) => (typeof value === 'string' ? value : null)

const statusFromQuery = (value: unknown) =>
  STATUSES.find((status) => status === value) ?? null
const pageFromQuery = (value: unknown) => {
  const raw = text(value)
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : null
}
const idFromQuery = (value: unknown) => {
  const raw = text(value)
  return raw && UUID.test(raw) ? raw : null
}

// The Pending ones are the validator's to-do list, so they come first.
const status = computed<StatusFilter>(() => statusFromQuery(route.query.status) ?? 'Pending')
const userId = computed(() => idFromQuery(route.query.user))
const page = computed(() => pageFromQuery(route.query.page) ?? 1)
const openedId = computed(() => idFromQuery(route.query.request))

/** Changes the URL keys given; null removes one. */
function show(changes: Record<string, string | number | null>, replace = false) {
  const query: LocationQueryRaw = { ...route.query }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete query[key]
    else query[key] = String(value)
  }
  return replace ? router.replace({ query }) : router.push({ query })
}

// Missing or broken keys are filled in or dropped, without an extra history entry.
watch(
  () => route.query,
  (query) => {
    if (route.name !== 'dashboard') return // leaving the page
    const fixes: Record<string, string | number | null> = {}
    if (!statusFromQuery(query.status)) fixes.status = status.value
    if (!pageFromQuery(query.page)) fixes.page = page.value
    if (query.user !== undefined && !userId.value) fixes.user = null
    if (query.request !== undefined && !openedId.value) fixes.request = null
    if (Object.keys(fixes).length) show(fixes, true)
  },
  { immediate: true },
)

// --- the list ---

const requests = ref<VacationRequest[]>([])
const total = ref(0)
const loading = ref(true)
const loadError = ref('')

// Requests can be answered out of order when clicking quickly; only the latest counts.
let latest = 0
async function load() {
  const request = ++latest
  loading.value = true
  loadError.value = ''
  try {
    const result = await vacationRequestsApi.list(
      {
        status: status.value === 'All' ? undefined : (status.value as VacationRequestStatus),
        userId: userId.value ?? undefined,
      },
      { page: page.value, limit: PAGE_SIZE },
    )
    if (request !== latest) return
    // A page past the end (the last Pending one was just decided, or an old link): show the last real one.
    if (result.items.length === 0 && page.value > 1) {
      show({ page: Math.max(1, result.totalPages) }, true)
      return
    }
    requests.value = result.items
    total.value = result.total
  } catch (error) {
    if (request === latest) loadError.value = errorMessage(error, 'Could not load the requests')
  } finally {
    if (request === latest) loading.value = false
  }
}

watch(
  [status, userId, page],
  () => {
    if (route.name === 'dashboard') load()
  },
  { immediate: true },
)

// A new filter starts again at page 1.
const setStatus = (value: StatusFilter) => show({ status: value, page: 1 })
const setUser = (value: string) => show({ user: value || null, page: 1 })
const changePage = (target: number) => show({ page: target })

// The employee filter lists requesters; without it the dashboard still works.
const people = ref<UserSummary[]>([])
usersApi
  .list('Requester')
  .then((users) => (people.value = users))
  .catch(() => {})

// --- decisions ---

const reviewing = ref<VacationRequest | null>(null)
const reviewMode = ref<ReviewMode>('view')
const reviewOpen = ref(false)
const reviewError = ref('')

function review(request: VacationRequest, mode: ReviewMode) {
  reviewing.value = request
  reviewMode.value = mode
  reviewOpen.value = true
}

// ?request=<id> (e.g. "Review on dashboard" on the Team page) opens that request,
// wherever it is in the list.
watch(
  openedId,
  async (id) => {
    if (!id || reviewing.value?.id === id) return
    reviewError.value = ''
    try {
      review(await vacationRequestsApi.get(id), 'view')
    } catch (error) {
      reviewError.value = errorMessage(error, 'Could not open that request')
      show({ request: null }, true)
    }
  },
  { immediate: true },
)

// Closing always refreshes the list: it shows the decision, or one another validator made meanwhile.
watch(reviewOpen, (isOpen) => {
  if (isOpen) return
  reviewing.value = null
  if (openedId.value) show({ request: null }, true)
  load()
})

const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function onDecided(message: string) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4000)
}
onBeforeUnmount(() => clearTimeout(noticeTimer))

// --- display ---

const period = (request: VacationRequest) =>
  `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`
const days = (request: VacationRequest) => daysInclusive(request.startDate, request.endDate)

const emptyText = computed(() =>
  status.value === 'Pending' && !userId.value
    ? 'No pending requests — all caught up.'
    : 'No requests match these filters.',
)

const tabClass = (value: StatusFilter) =>
  value === status.value
    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
    : 'text-gray-600 hover:text-gray-900'
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Vacation requests</h1>
      <p class="mt-1 text-sm text-gray-600">Approve or reject what your team has asked for.</p>
    </div>

    <!-- Filters -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex overflow-x-auto rounded-lg bg-gray-100 p-1" role="group" aria-label="Status">
        <button
          v-for="value in STATUSES"
          :key="value"
          type="button"
          :class="tabClass(value)"
          class="rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap"
          :aria-pressed="value === status"
          @click="setStatus(value)"
        >
          {{ value }}
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-700">
        <span class="shrink-0">Employee</span>
        <select
          :value="userId ?? ''"
          class="block w-full rounded-md border-0 py-2 pr-8 pl-3 text-sm text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 sm:w-56"
          @change="setUser(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Everyone</option>
          <option v-for="person in people" :key="person.id" :value="person.id">{{ person.name }}</option>
        </select>
      </label>
    </div>

    <AlertMessage v-if="notice" variant="success">{{ notice }}</AlertMessage>
    <AlertMessage v-if="reviewError">{{ reviewError }}</AlertMessage>
    <AlertMessage v-if="loadError">{{ loadError }}</AlertMessage>

    <div :class="{ 'opacity-60 transition-opacity': loading }" :aria-busy="loading">
      <p v-if="loading && requests.length === 0" class="text-sm text-gray-500">Loading…</p>
      <p v-else-if="!loadError && requests.length === 0" class="text-sm text-gray-500">{{ emptyText }}</p>

      <template v-else>
        <!-- Phones: one card per request -->
        <ul class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 md:hidden">
          <li v-for="request in requests" :key="request.id" class="space-y-2 p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-gray-900">{{ request.user?.name }}</span>
              <StatusBadge :status="request.status" />
            </div>
            <p class="text-sm text-gray-700">{{ period(request) }} · {{ days(request) }} days</p>
            <p v-if="request.reason" class="text-sm break-words text-gray-600">{{ request.reason }}</p>
            <p v-if="request.comments" class="text-sm break-words text-gray-600">
              <span class="font-medium">Comment:</span> {{ request.comments }}
            </p>
            <div v-if="request.status === 'Pending'" class="flex gap-2 pt-1">
              <BaseButton class="flex-1" @click="review(request, 'approve')">Approve</BaseButton>
              <BaseButton class="flex-1" variant="secondary" @click="review(request, 'reject')">Reject</BaseButton>
            </div>
          </li>
        </ul>

        <!-- Wider screens: a table -->
        <div class="hidden overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 md:block">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              <tr>
                <th scope="col" class="px-4 py-3">Employee</th>
                <th scope="col" class="px-4 py-3">Period</th>
                <th scope="col" class="px-4 py-3 text-right">Days</th>
                <th scope="col" class="px-4 py-3">Reason</th>
                <th scope="col" class="px-4 py-3">Status</th>
                <th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="request in requests" :key="request.id" class="align-top">
                <td class="px-4 py-3 font-medium whitespace-nowrap text-gray-900">{{ request.user?.name }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-gray-700">{{ period(request) }}</td>
                <td class="px-4 py-3 text-right text-gray-700 tabular-nums">{{ days(request) }}</td>
                <td class="max-w-xs px-4 py-3 break-words text-gray-600">{{ request.reason || '—' }}</td>
                <td class="max-w-xs px-4 py-3">
                  <StatusBadge :status="request.status" />
                  <p v-if="request.comments" class="mt-1 break-words text-gray-600">{{ request.comments }}</p>
                </td>
                <td class="px-4 py-3">
                  <div v-if="request.status === 'Pending'" class="flex justify-end gap-2">
                    <BaseButton @click="review(request, 'approve')">Approve</BaseButton>
                    <BaseButton variant="secondary" @click="review(request, 'reject')">Reject</BaseButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <PaginationBar
        :page="page"
        class="mt-4"
        :total="total"
        :limit="PAGE_SIZE"
        noun="requests"
        @update:page="changePage"
      />
    </div>

    <ReviewDialog v-model:open="reviewOpen" :request="reviewing" :mode="reviewMode" @decided="onDecided" />
  </div>
</template>
